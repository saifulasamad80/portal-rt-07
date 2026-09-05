import { redirect } from "next/navigation";
import LaporAdminClient from "./LaporAdminClient";
import { adminUntukKlien, otentikasiAdminAktif, wajibOtentikasiAdmin } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminLaporPage() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) redirect("/admin");
  const adminAktif = adminUntukKlien(otentikasi.sesi);

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);

  // FAKTA: Tarik daftar laporan beserta nama warga pelapornya
  let queryLaporan = supabaseAdmin
    .from("laporan_warga")
    .select("id, warga_id, judul_laporan, deskripsi, status, tanggapan_rt, created_at, warga(nama_lengkap)")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (otentikasi.sesi.role !== "webmaster") queryLaporan = queryLaporan.eq("rt_id", otentikasi.sesi.rtId);
  const { data: laporanRes } = await queryLaporan;

  // FAKTA: Server Action untuk menanggapi dan update status laporan
  async function tanggapiLaporan(laporanId: string, statusBaru: string, tanggapanTeks: string) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();
    const idBersih = String(laporanId || "").trim();
    const statusBersih = String(statusBaru || "").trim();
    const tanggapanBersih = String(tanggapanTeks || "").trim().slice(0, 5000);
    if (!POLA_UUID.test(idBersih) || !["Menunggu", "Diproses", "Selesai", "Ditolak"].includes(statusBersih) || !tanggapanBersih) {
      return { success: false, message: "Data tanggapan tidak valid." };
    }
    const supabase = await buatKlienTerautentikasi(sesi);
    let queryTarget = supabase
      .from("laporan_warga")
      .select("id, judul_laporan, rt_id")
      .eq("id", idBersih);
    if (sesi.role !== "webmaster") queryTarget = queryTarget.eq("rt_id", sesi.rtId);
    const { data: targetLaporan, error: errTarget } = await queryTarget.maybeSingle();
    if (errTarget || !targetLaporan) return { success: false, message: "Laporan tidak berada dalam cakupan RT Anda." };

    let queryUpdate = supabase
      .from("laporan_warga")
      .update({ 
        status: statusBersih,
        tanggapan_rt: tanggapanBersih
      })
      .eq("id", idBersih);
    if (sesi.role !== "webmaster") queryUpdate = queryUpdate.eq("rt_id", sesi.rtId);
    const { data: diperbarui, error } = await queryUpdate.select("id").maybeSingle();

    if (error || !diperbarui) return { success: false, message: "Laporan berubah atau gagal diperbarui." };

    await supabase.from("audit_log").insert([{
      aktor: sesi.nama,
      aksi: `Tanggapan Laporan: ${statusBersih}`,
      tabel_target: "laporan_warga",
      detail: `Merespons tiket: ${targetLaporan.judul_laporan}`,
      rt_id: targetLaporan.rt_id,
    }]);
    return { success: true };
  }

  return <LaporAdminClient 
            adminAktif={adminAktif} 
            laporanList={laporanRes || []} 
            aksiTanggapi={tanggapiLaporan} 
         />;
}
