import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import AdminLogin from "./AdminLogin";
import AdminDashboardClient from "./AdminDashboardClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function AdminDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) return <AdminLogin />;

  let adminAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    adminAktif = payload;
  } catch (error) {
    return <AdminLogin />;
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // FAKTA: Tambahkan ktp_path & kk_path agar admin bisa melihat dokumen pendaftar
  const { data: wargaListRes } = await supabaseAdmin
    .from("warga")
    .select("id, nik, nama_lengkap, no_whatsapp, status_tinggal, detail_alamat, status_verifikasi, created_at, ktp_path, kk_path, anggota_keluarga(nama_lengkap, hubungan_keluarga)")
    .order("created_at", { ascending: false })
    .limit(10);

  async function prosesValidasi(idWarga: string, status: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: targetWarga } = await supabase.from("warga").select("nik").eq("id", idWarga).single();
    
    const { error } = await supabase.from("warga").update({ status_verifikasi: status }).eq("id", idWarga);
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: `Validasi Cepat: ${status}`,
      tabel_target: "warga",
      detail: `Memvalidasi NIK: ${targetWarga?.nik || idWarga}`
    }]);
  }

  const handleLogout = async () => {
    "use server";
    const cookieStore = await cookies();
    cookieStore.delete("admin_session");
    redirect("/");
  };

  return <AdminDashboardClient adminAktif={adminAktif} wargaList={wargaListRes || []} prosesValidasi={prosesValidasi} logoutAction={handleLogout} />;
}