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

  // 1. Cek apakah sudah pernah verifikasi
  const { data: cekSensus } = await supabaseAdmin
    .from("sensus_kesejahteraan")
    .select("id")
    .eq("warga_id", wargaAktif.id)
    .maybeSingle();

  if (cekSensus) {
    redirect("/portal"); 
  }

  // 2. Tarik Data Carik (Profil & Keluarga) untuk diverifikasi
  const { data: profilWarga } = await supabaseAdmin
    .from("warga")
    .select("*, anggota_keluarga(*)")
    .eq("id", wargaAktif.id)
    .single();

  if (!profilWarga) redirect("/login");

  // REFACTOR: Injeksi Eksekusi Validasi Lapis Baja dengan Dummy Anti-Crash
  async function submitVerifikasiCarik(catatanKoreksi: string) {
    "use server";
    const sesi = await pastikanOtentikasiWarga(); // BARRIER AKTIF

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: verifikasi } = await supabase.from("sensus_kesejahteraan").select("id").eq("warga_id", sesi.id).maybeSingle();
    if (verifikasi) throw new Error("SISTEM MENOLAK: Anda sudah pernah melakukan verifikasi data!");

    // FAKTA: Injeksi nilai default agar tabel sensus lama tidak crash (Not-Null Constraint)
    const { error } = await supabase.from("sensus_kesejahteraan").insert([{
      warga_id: sesi.id,
      catatan_tambahan: catatanKoreksi || "Data Carik Tervalidasi Warga",
      status_validasi: "Disetujui",
      // Bypass kolom lawas
      ada_ibu_hamil: false, ada_disabilitas: false, ada_ibu_menyusui: false,
      ada_ibu_meninggal: false, ada_bayi_meninggal: false, ada_balita_meninggal: false,
      ada_bayi_baru_lahir: false, bayi_tanpa_akta: false, ada_ibu_nifas: false,
      memiliki_mck: true, memiliki_tempat_sampah: true, memiliki_spal: true, memiliki_resapan_air: true,
      sumber_air_utama: "PAM / Leding", status_kesehatan_rumah: "Rumah Sehat", jenis_makanan_pokok: "Beras / Nasi"
    }]);

    if (error) throw new Error(error.message);
  }

  return <SensusClient warga={profilWarga} aksiKirim={submitVerifikasiCarik} />;
}