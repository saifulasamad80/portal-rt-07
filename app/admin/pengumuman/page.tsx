import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import PengumumanAdminClient from "./PengumumanAdminClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function AdminPengumumanPage() {
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

  // INJEKSI MUTLAK (MULTI-TENANT): Tarik rt_id admin dari database sebagai pelampung
  // sebelum JWT kita update di tahap selanjutnya.
  const { data: profilAdmin } = await supabaseAdmin
    .from("pengurus_rt")
    .select("rt_id")
    .eq("id", adminAktif.id)
    .single();

  const rtIdAktif = adminAktif.rt_id || profilAdmin?.rt_id;
  
  if (!rtIdAktif) redirect("/admin"); // Tendang keluar kalau rt_id ga ketemu (Keamanan Absolut)

  // Tarik daftar pengumuman yang HANYA milik RT ini
  const { data: pengumumanRes } = await supabaseAdmin
    .from("pengumuman_rt")
    .select("*")
    .eq("rt_id", rtIdAktif)
    .order("tanggal_publikasi", { ascending: false });

  // Server Action untuk Rilis Pengumuman
  async function simpanPengumuman(judul: string, deskripsi: string, linkDokumen: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // PENAMBALAN MULTI-TENANT: Masukkan rt_id saat insert pengumuman
    const { error } = await supabase.from("pengumuman_rt").insert([
      { judul, deskripsi, link_dokumen: linkDokumen, rt_id: rtIdAktif }
    ]);
    if (error) throw new Error(error.message);

    // PENAMBALAN MULTI-TENANT: Masukkan rt_id saat insert audit log
    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: "Buat Pengumuman Baru",
      tabel_target: "pengumuman_rt",
      detail: `Judul: ${judul}`,
      rt_id: rtIdAktif
    }]);
  }

  // Catatan: File PengumumanAdminClient.tsx lu udah aman, gak perlu diubah.
  return <PengumumanAdminClient adminAktif={adminAktif} pengumumanList={pengumumanRes || []} aksiSimpan={simpanPengumuman} />;
}