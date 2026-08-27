import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import SensusClient from "./SensusClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

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
  
  // PROTEKSI GANDA: Jika sudah pernah isi sensus, usir kembali ke Dasbor!
  const { data: cekSensus } = await supabaseAdmin
    .from("sensus_kesejahteraan")
    .select("id")
    .eq("warga_id", wargaAktif.id)
    .maybeSingle();

  if (cekSensus) {
    redirect("/portal"); 
  }

  // SERVER ACTION: Menerima muntahan data dari form Warga
  async function submitSensus(payloadData: any) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Verifikasi ulang di backend sebelum insert
    const { data: verifikasi } = await supabase.from("sensus_kesejahteraan").select("id").eq("warga_id", wargaAktif.id).maybeSingle();
    if (verifikasi) throw new Error("SISTEM MENOLAK: Anda sudah pernah mengirimkan data sensus!");

    const { error } = await supabase.from("sensus_kesejahteraan").insert([{
      warga_id: wargaAktif.id,
      ...payloadData,
      status_validasi: "Menunggu"
    }]);

    if (error) throw new Error(error.message);
  }

  return <SensusClient aksiKirim={submitSensus} />;
}