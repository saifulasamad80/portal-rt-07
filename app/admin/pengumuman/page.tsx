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

  // FAKTA: Tarik seluruh pengumuman RT langsung dari server
  const { data: pengumumanRes } = await supabaseAdmin
    .from("pengumuman_rt")
    .select("*")
    .order("tanggal_publikasi", { ascending: false });

  // FAKTA: Server Action untuk Rilis Pengumuman
  async function simpanPengumuman(judul: string, deskripsi: string, linkDokumen: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { error } = await supabase.from("pengumuman_rt").insert([
      { judul, deskripsi, link_dokumen: linkDokumen }
    ]);
    if (error) throw new Error(error.message);

    // Rekam di Log Audit
    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: "Buat Pengumuman Baru",
      tabel_target: "pengumuman_rt",
      detail: `Judul: ${judul}`
    }]);
  }

  return <PengumumanAdminClient adminAktif={adminAktif} pengumumanList={pengumumanRes || []} aksiSimpan={simpanPengumuman} />;
}