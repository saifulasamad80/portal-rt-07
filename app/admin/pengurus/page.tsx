import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import PengurusAdminClient from "./PengurusAdminClient";
import bcrypt from "bcryptjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// SECURITY FIX: Hapus fallback hardcoded. Paksa server melempar error jika ENV tidak ada!
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET); 

// INJEKSI MUTLAK: Gembok Keamanan Zero-Trust untuk Endpoint Admin
async function pastikanOtentikasiAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) throw new Error("Akses Ilegal: Sesi tidak valid atau telah berakhir.");
  
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "webmaster") throw new Error("Akses Ditolak: Membutuhkan otorisasi Webmaster.");
    return payload; 
  } catch (error) {
    throw new Error("Akses Ilegal: Token keamanan rusak atau dimanipulasi.");
  }
}

export default async function AdminPengurusPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) redirect("/admin");

  let adminAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    adminAktif = JSON.parse(JSON.stringify(payload));
    if (adminAktif.role !== "webmaster") redirect("/admin");
  } catch (error) {
    redirect("/admin");
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // OPTIMASI: Batasi tarikan data maksimal 100 baris untuk mencegah Memory Leak
  const { data: pengurusRes } = await supabaseAdmin
    .from("pengurus_rt")
    .select("id, nama_lengkap, jabatan, email, created_at")
    .order("created_at", { ascending: true })
    .limit(100); 

  async function tambahPengurus(nama: string, jabatan: string, email: string, pass: string) {
    "use server";
    const sesiAsli = await pastikanOtentikasiAdmin(); // BARRIER KEAMANAN AKTIF

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const hashedPassword = await bcrypt.hash(pass, 10);

    const { error } = await supabase.from("pengurus_rt").insert([{
      nama_lengkap: nama, jabatan: jabatan, email: email, username: email.split('@')[0], password: hashedPassword
    }]);

    if (error) return { success: false, message: error.message };

    await supabase.from("audit_log").insert([{
      aktor: sesiAsli.nama, aksi: "Registrasi Pengurus Baru", tabel_target: "pengurus_rt", detail: `Memberikan akses admin kepada ${nama} (${jabatan})`
    }]);

    return { success: true };
  }

  async function hapusPengurus(idTarget: string) {
    "use server";
    const sesiAsli = await pastikanOtentikasiAdmin(); // BARRIER KEAMANAN AKTIF

    const idAktor = sesiAsli.sub || sesiAsli.id;
    if (idTarget === idAktor) throw new Error("PERINGATAN SISTEM: Anda tidak dapat menghapus akun Webmaster Anda sendiri!");

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: target } = await supabase.from("pengurus_rt").select("nama_lengkap").eq("id", idTarget).single();
    
    const { error } = await supabase.from("pengurus_rt").delete().eq("id", idTarget);
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert([{
      aktor: sesiAsli.nama, aksi: "Hapus Akun Pengurus", tabel_target: "pengurus_rt", detail: `Mencabut akses admin: ${target?.nama_lengkap}`
    }]);
  }

  async function resetSandiPengurus(idTarget: string, sandiBaru: string) {
    "use server";
    const sesiAsli = await pastikanOtentikasiAdmin(); // BARRIER KEAMANAN AKTIF

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const hashedPassword = await bcrypt.hash(sandiBaru, 10);

    const { data: target } = await supabase.from("pengurus_rt").select("nama_lengkap").eq("id", idTarget).single();
    
    const { error } = await supabase.from("pengurus_rt").update({ password: hashedPassword }).eq("id", idTarget);
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert([{
      aktor: sesiAsli.nama, aksi: "Reset Paksa Password Pengurus", tabel_target: "pengurus_rt", detail: `Merubah password milik: ${target?.nama_lengkap}`
    }]);
  }

  return <PengurusAdminClient pengurusList={pengurusRes || []} aksiTambah={tambahPengurus} aksiHapus={hapusPengurus} aksiReset={resetSandiPengurus} />;
}