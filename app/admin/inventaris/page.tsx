import { redirect } from "next/navigation";
import InventarisClient from "./InventarisClient";
import { otentikasiAdminAktif, wajibOtentikasiAdmin } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminInventarisPage() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) redirect("/admin");

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);

  let queryMaster = supabaseAdmin.from("master_inventaris").select("*").order("nama_barang", { ascending: true }).limit(500);
  let queryPinjam = supabaseAdmin.from("peminjaman_inventaris").select("*, warga(nama_lengkap)").order("tanggal_pinjam", { ascending: false }).limit(1000);
  if (otentikasi.sesi.role !== "webmaster") {
    queryMaster = queryMaster.eq("rt_id", otentikasi.sesi.rtId);
    queryPinjam = queryPinjam.eq("rt_id", otentikasi.sesi.rtId);
  }
  const [{ data: masterData }, { data: pinjamData }] = await Promise.all([queryMaster, queryPinjam]);

  async function tambahBarang(nama: string, deskripsi: string, total: number) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();
    const namaBersih = String(nama || "").trim().slice(0, 200);
    const deskripsiBersih = String(deskripsi || "").trim().slice(0, 2000);
    const totalBersih = Number(total);
    if (!namaBersih || !Number.isInteger(totalBersih) || totalBersih < 0 || totalBersih > 100000) return { success: false, message: "Data inventaris tidak valid." };
    const supabase = await buatKlienTerautentikasi(sesi);
    const { error } = await supabase.from("master_inventaris").insert([{ nama_barang: namaBersih, deskripsi: deskripsiBersih || null, total_unit: totalBersih, rt_id: sesi.rtId }]);
    if (error) return { success: false, message: "Inventaris gagal ditambahkan." };
    await supabase.from("audit_log").insert([{ aktor: sesi.nama, aksi: "Tambah Master Inventaris", tabel_target: "master_inventaris", detail: `${totalBersih} Unit ${namaBersih}`, rt_id: sesi.rtId }]);
    return { success: true };
  }

  async function updateStatus(id: string, statusBaru: string) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();
    const idBersih = String(id || "").trim();
    const statusBersih = String(statusBaru || "").trim();
    if (!POLA_UUID.test(idBersih) || !["Menunggu", "Disetujui", "Ditolak", "Dikembalikan"].includes(statusBersih)) return { success: false, message: "ID atau status peminjaman tidak valid." };
    const supabase = await buatKlienTerautentikasi(sesi);
    let query = supabase.from("peminjaman_inventaris").update({ status: statusBersih }).eq("id", idBersih);
    if (sesi.role !== "webmaster") query = query.eq("rt_id", sesi.rtId);
    const { data: diperbarui, error } = await query.select("id").maybeSingle();
    if (error || !diperbarui) return { success: false, message: "Status peminjaman gagal diperbarui." };
    await supabase.from("audit_log").insert([{ aktor: sesi.nama, aksi: `Update Status Pinjam: ${statusBersih}`, tabel_target: "peminjaman_inventaris", detail: `ID Peminjaman: ${idBersih}`, rt_id: sesi.rtId }]);
    return { success: true };
  }

  return <InventarisClient masterList={masterData || []} pinjamList={pinjamData || []} aksiTambah={tambahBarang} aksiStatus={updateStatus} />;
}
