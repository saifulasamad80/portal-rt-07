import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import LaporClient from "./LaporClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function LaporRTPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;

  if (!token) redirect("/login");

  let wargaAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    wargaAktif = payload;
  } catch (error) {
    redirect("/login");
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // FAKTA: Server mengeksekusi penarikan data secara simultan menembus RLS
  const [wargaRes, laporanRes] = await Promise.all([
    supabaseAdmin.from("warga").select("*").eq("id", wargaAktif.id).single(),
    supabaseAdmin.from("laporan_warga").select("*").eq("warga_id", wargaAktif.id).order("created_at", { ascending: false })
  ]);

  if (!wargaRes.data) redirect("/login");

  // FAKTA: Ini adalah "Server Action". Fungsi ini dieksekusi secara buta dari klien, 
  // lalu menembus database via server dengan keamanan absolut (Bypass RLS).
  async function kirimLaporan(judul: string, deskripsi: string) {
    "use server";
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { error } = await supabaseAdmin.from("laporan_warga").insert([{
      warga_id: wargaAktif.id,
      judul_laporan: judul,
      deskripsi: deskripsi,
      status: "Menunggu"
    }]);

    if (error) throw new Error(error.message);
  }

  return <LaporClient warga={wargaRes.data} initialLaporan={laporanRes.data || []} kirimLaporan={kirimLaporan} />;
}