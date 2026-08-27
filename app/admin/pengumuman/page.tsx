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

  // PENAMBALAN MULTI-TENANT: Tarik rt_id admin dari database
  const { data: profilAdmin } = await supabaseAdmin
    .from("pengurus_rt")
    .select("rt_id")
    .eq("id", adminAktif.id)
    .single();

  const rtIdAktif = adminAktif.rt_id || profilAdmin?.rt_id;
  
  if (!rtIdAktif) redirect("/admin");

  // Tarik daftar pengumuman milik RT ini
  const { data: pengumumanRes } = await supabaseAdmin
    .from("pengumuman_rt")
    .select("*")
    .eq("rt_id", rtIdAktif)
    .order("tanggal_publikasi", { ascending: false });

  // 1. ACTION: SIMPAN BARU
  async function simpanPengumuman(judul: string, deskripsi: string, linkDokumen: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { error } = await supabase.from("pengumuman_rt").insert([
      { judul, deskripsi, link_dokumen: linkDokumen, rt_id: rtIdAktif }
    ]);
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: "Buat Pengumuman Baru",
      tabel_target: "pengumuman_rt",
      detail: `Judul: ${judul}`,
      rt_id: rtIdAktif
    }]);
  }

  // 2. ACTION: EDIT / UPDATE
  async function editPengumuman(id: string, judul: string, deskripsi: string, linkDokumen: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { error } = await supabase.from("pengumuman_rt").update({ 
      judul, deskripsi, link_dokumen: linkDokumen 
    }).eq("id", id).eq("rt_id", rtIdAktif); // Validasi keamanan ganda (hanya RT yang sama)
    
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: "Edit Pengumuman",
      tabel_target: "pengumuman_rt",
      detail: `Memperbarui pengumuman: ${judul}`,
      rt_id: rtIdAktif
    }]);
  }

  // 3. ACTION: HAPUS
  async function hapusPengumuman(id: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: target } = await supabase.from("pengumuman_rt").select("judul").eq("id", id).single();
    
    const { error } = await supabase.from("pengumuman_rt").delete().eq("id", id).eq("rt_id", rtIdAktif);
    
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: "Hapus Pengumuman",
      tabel_target: "pengumuman_rt",
      detail: `Menghapus siaran: ${target?.judul}`,
      rt_id: rtIdAktif
    }]);
  }

  return <PengumumanAdminClient 
            adminAktif={adminAktif} 
            pengumumanList={pengumumanRes || []} 
            aksiSimpan={simpanPengumuman} 
            aksiEdit={editPengumuman}
            aksiHapus={hapusPengumuman}
         />;
}