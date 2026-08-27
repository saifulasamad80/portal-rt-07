import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import VotingClient from "./VotingClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

// INJEKSI MUTLAK: Gembok Keamanan Zero-Trust
async function pastikanOtentikasiWarga() {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;
  if (!token) throw new Error("Akses Ditolak: Sesi Anda tidak valid.");
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload; 
  } catch (error) { throw new Error("Akses Ditolak: Token keamanan rusak."); }
}

export default async function PortalVotingPage() {
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

  const { data: votingAktifList } = await supabaseAdmin
    .from("voting_rt")
    .select("*")
    .eq("status", "Aktif")
    .order("created_at", { ascending: false })
    .limit(1);

  const votingAktif = votingAktifList && votingAktifList.length > 0 ? votingAktifList[0] : null;

  let suaraKu = null;
  if (votingAktif) {
    const { data: cekSuara } = await supabaseAdmin
      .from("suara_voting")
      .select("*")
      .eq("voting_id", votingAktif.id)
      .eq("warga_id", wargaAktif.id);
      
    suaraKu = cekSuara && cekSuara.length > 0 ? cekSuara[0] : null;
  }

  // REFACTOR: Eksekusi Validasi Lapis Baja (Super Kritis untuk Mencegah Pemilu Curang)
  async function kirimSuara(votingId: string, pilihanTeks: string) {
    "use server";
    const sesi = await pastikanOtentikasiWarga(); // BARRIER AKTIF

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Validasi Ganda di Server menggunakan ID Asli Warga
    const { data: validasi } = await supabase.from("suara_voting").select("id").eq("voting_id", votingId).eq("warga_id", sesi.id);
    if (validasi && validasi.length > 0) throw new Error("Sistem mendeteksi anomali: Suara Anda sudah terekam sebelumnya. Tindakan diblokir!");

    const { error } = await supabase.from("suara_voting").insert([{
      voting_id: votingId,
      warga_id: sesi.id, // Gunakan ID asli
      pilihan: pilihanTeks
    }]);

    if (error) throw new Error(error.message);
  }

  return <VotingClient wargaAktif={wargaAktif} votingAktif={votingAktif} suaraKu={suaraKu} aksiPilih={kirimSuara} />;
}