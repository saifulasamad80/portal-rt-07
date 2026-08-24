import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import PengurusAdminClient from "./PengurusAdminClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function AdminPengurusPage() {
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

  // FAKTA: Tarik daftar pengurus (password tidak ditarik untuk keamanan)
  const { data: pengurusRes } = await supabaseAdmin
    .from("pengurus_rt")
    .select("id, nama_lengkap, jabatan, email, created_at")
    .order("created_at", { ascending: true });

  // FAKTA: Server Action untuk insert Pengurus Baru
  async function tambahPengurus(nama: string, jabatan: string, email: string, pass: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Karena lu pakai raw password di database (sesuai skema lu: kolom 'password' teks biasa)
    const { error } = await supabase.from("pengurus_rt").insert([{
      nama_lengkap: nama,
      jabatan: jabatan,
      email: email,
      username: email.split('@')[0], // Generate username otomatis dari email
      password: pass
    }]);

    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: "Registrasi Pengurus Baru",
      tabel_target: "pengurus_rt",
      detail: `Memberikan akses admin kepada ${nama} (${jabatan})`
    }]);
  }

  return <PengurusAdminClient pengurusList={pengurusRes || []} aksiTambah={tambahPengurus} />;
}