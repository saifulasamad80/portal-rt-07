import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import RondaAdminClient from "./RondaAdminClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function AdminRondaPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) redirect("/admin");

  let adminAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    adminAktif = payload;
  } catch (error) {
    redirect("/admin");
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // FAKTA: Tarik Jadwal Ronda, JOIN dengan nama warga, urutkan dari tanggal terbaru
  const { data: jadwalRes } = await supabaseAdmin
    .from("jadwal_ronda")
    .select("*, warga(nama_lengkap)")
    .order("tanggal_tugas", { ascending: false });

  // FAKTA: Tarik daftar warga yang terverifikasi untuk dropdown petugas
  const { data: wargaRes } = await supabaseAdmin
    .from("warga")
    .select("id, nama_lengkap")
    .eq("status_verifikasi", "Disetujui")
    .order("nama_lengkap", { ascending: true });

  // FAKTA: Server Action untuk menetapkan jadwal ke database
  async function simpanJadwal(wargaId: string, tanggalTugas: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Status awal selalu "Menunggu Konfirmasi" sampai warga memvalidasinya di portal
    const { error } = await supabase.from("jadwal_ronda").insert([
      { warga_id: wargaId, tanggal_tugas: tanggalTugas, status: "Menunggu Konfirmasi" }
    ]);
    if (error) throw new Error(error.message);

    // Dapatkan nama warga untuk log audit
    const { data: targetWarga } = await supabase.from("warga").select("nama_lengkap").eq("id", wargaId).single();

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: "Menetapkan Jadwal Ronda",
      tabel_target: "jadwal_ronda",
      detail: `Menugaskan ${targetWarga?.nama_lengkap} untuk tanggal ${tanggalTugas}`
    }]);
  }

  // FAKTA: Server Action untuk membatalkan/menghapus jadwal
  async function hapusJadwal(idJadwal: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { error } = await supabase.from("jadwal_ronda").delete().eq("id", idJadwal);
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: "Membatalkan Jadwal Ronda",
      tabel_target: "jadwal_ronda",
      detail: `ID Jadwal: ${idJadwal} telah dihapus`
    }]);
  }

  return <RondaAdminClient 
            adminAktif={adminAktif} 
            jadwalList={jadwalRes || []} 
            wargaList={wargaRes || []} 
            aksiSimpan={simpanJadwal}
            aksiHapus={hapusJadwal}
         />;
}