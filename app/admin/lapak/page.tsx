import { redirect } from "next/navigation";
import LapakAdminClient from "./LapakAdminClient";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";
import {
  adminBolehMengaksesRt,
  adminUntukKlien,
  otentikasiAdminAktif,
  wajibOtentikasiAdmin,
} from "@/lib/session-security";
import { POLA_UUID } from "@/lib/uuid-tenant";

export default async function AdminLapakPage() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) redirect("/admin");
  const adminAktif = adminUntukKlien(otentikasi.sesi);

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);

  // OPTIMASI: Pemasangan Limit(200) Mencegah Memory Leak (OOM)
  let queryLapak = supabaseAdmin
    .from("lapak_warga")
    .select("*, warga(nama_lengkap)")
  if (otentikasi.sesi.role !== "webmaster") queryLapak = queryLapak.eq("rt_id", otentikasi.sesi.rtId);
  const { data: lapakRes } = await queryLapak.order("created_at", { ascending: false }).limit(200);

  // REFACTOR: Server Action Diamankan
  async function validasiLapak(idLapak: string, statusBaru: string) {
    "use server";
    try {
      const sesi = await wajibOtentikasiAdmin();
      const idBersih = String(idLapak || "").trim();
      const statusBersih = String(statusBaru || "").trim();
      if (!POLA_UUID.test(idBersih) || !["Aktif", "Ditolak", "Menunggu"].includes(statusBersih)) {
        return { success: false, message: "ID atau status lapak tidak valid." };
      }

    const supabase = await buatKlienTerautentikasi(sesi);
    const { data: target, error: errTarget } = await supabase
      .from("lapak_warga")
      .select("id, nama_usaha, rt_id")
      .eq("id", idBersih)
      .maybeSingle();
    if (errTarget || !target || !adminBolehMengaksesRt(sesi, target.rt_id)) {
      return { success: false, message: "Lapak tidak berada dalam cakupan RT Anda." };
    }
    let queryUpdate = supabase.from("lapak_warga").update({ status: statusBersih }).eq("id", idBersih);
    if (sesi.role !== "webmaster") queryUpdate = queryUpdate.eq("rt_id", sesi.rtId);
    const { data: diperbarui, error } = await queryUpdate.select("id").maybeSingle();
    if (error) return { success: false, message: "Status lapak gagal diperbarui." };
    if (!diperbarui) return { success: false, message: "Lapak berubah; muat ulang halaman." };

    await supabase.from("audit_log").insert([{
      aktor: sesi.nama,
      aksi: `Validasi UMKM: ${statusBersih}`,
      tabel_target: "lapak_warga",
      detail: `Lapak: ${target.nama_usaha}`,
      rt_id: target.rt_id,
    }]);
      return { success: true, message: "Status lapak berhasil diperbarui." };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : "Aksi lapak gagal." };
    }
  }

  return <LapakAdminClient adminAktif={adminAktif} daftarLapak={lapakRes || []} aksiValidasi={validasiLapak} />;
}
