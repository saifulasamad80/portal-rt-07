import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import RondaClient from "./RondaClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function RondaPage() {
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
  
  // Tarik Jadwal Ronda milik Warga yang login
  const { data: jadwalRes } = await supabaseAdmin
    .from("jadwal_ronda")
    .select("*")
    .eq("warga_id", wargaAktif.id)
    .order("tanggal_tugas", { ascending: true });

  // FAKTA: Server Action untuk Mengkonfirmasi Kehadiran secara Aman (Bypass RLS)
  async function konfirmasiKehadiran(idJadwal: string, aksi: string, alasan: string) {
    "use server";
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { error } = await supabaseAdmin
      .from("jadwal_ronda")
      .update({ status: aksi, alasan_izin: alasan })
      .eq("id", idJadwal)
      .eq("warga_id", wargaAktif.id);

    if (error) throw new Error(error.message);
  }

  // INJEKSI MUTLAK: generateTest dihapus total dari properti pemanggilan
  return <RondaClient jadwal={jadwalRes || []} konfirmasiKehadiran={konfirmasiKehadiran} />;
}