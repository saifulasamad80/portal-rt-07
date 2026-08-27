import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import SensusClient from "./SensusClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

// INJEKSI MUTLAK: Mesin Gembok Zero-Trust Anti-IDOR
async function pastikanOtentikasiWarga() {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;
  if (!token) throw new Error("Akses Ditolak: Sesi Anda tidak valid.");
  
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload; // Lolos, identitas asli dikembalikan
  } catch (error) {
    throw new Error("Akses Ditolak: Token keamanan rusak atau dimanipulasi.");
  }
}

export default async function SensusPage() {
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
  
  const { data: cekSensus } = await supabaseAdmin
    .from("sensus_kesejahteraan")
    .select("id")
    .eq("warga_id", wargaAktif.id)
    .maybeSingle();

  if (cekSensus) {
    redirect("/portal"); 
  }

  // REFACTOR: Injeksi Eksekusi Validasi Lapis Baja
  async function submitSensus(payloadData: any) {
    "use server";
    const sesi = await pastikanOtentikasiWarga(); // BARRIER AKTIF: Tolak akses tanpa token valid!

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Gunakan sesi.id MURNI dari Token, BUKAN dari closure halaman
    const { data: verifikasi } = await supabase.from("sensus_kesejahteraan").select("id").eq("warga_id", sesi.id).maybeSingle();
    if (verifikasi) throw new Error("SISTEM MENOLAK: Anda sudah pernah mengirimkan data sensus!");

    const { error } = await supabase.from("sensus_kesejahteraan").insert([{
      warga_id: sesi.id, // Amankan relasi ID
      ...payloadData,
      status_validasi: "Menunggu"
    }]);

    if (error) throw new Error(error.message);
  }

  return <SensusClient aksiKirim={submitSensus} />;
}