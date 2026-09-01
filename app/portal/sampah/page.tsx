import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import SampahClient from "./SampahClient"; // Kita pisah Client Component-nya

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

async function pastikanOtentikasiWarga() {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;
  if (!token) throw new Error("Akses Ditolak: Sesi tidak valid.");
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload; 
  } catch (error) { throw new Error("Akses Ditolak: Token rusak."); }
}

export default async function PortalSampahPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;

  if (!token) redirect("/login");

  let wargaAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    wargaAktif = payload;
  } catch (error) { redirect("/login"); }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Tarik Data Sampah Kiloan (Tabungan Tradisional)
  const { data: kiloanRes } = await supabaseAdmin
    .from("transaksi_sampah")
    .select("berat_kg, jenis_transaksi, nominal_warga, tanggal_transaksi, keterangan")
    .eq("warga_id", wargaAktif.id)
    .order("tanggal_transaksi", { ascending: false });

  const riwayatKiloan = kiloanRes || [];
  const totalSetorWarga = riwayatKiloan.filter(t => t.jenis_transaksi === "Setor").reduce((sum, t) => sum + t.nominal_warga, 0);
  const totalTarikWarga = riwayatKiloan.filter(t => t.jenis_transaksi === "Tarik").reduce((sum, t) => sum + t.nominal_warga, 0);
  const saldoKiloan = totalSetorWarga - totalTarikWarga;
  const totalBeratKiloan = riwayatKiloan.filter(t => t.jenis_transaksi === "Setor").reduce((sum, t) => sum + (t.berat_kg || 0), 0);

  // 2. Tarik Data Limbah Ekonomis (Rak Bin)
  // Perhatikan: Kita join ke tabel lapak_warga untuk narik nama Teknisi (Jika sudah di-assign RT)
  const { data: rakBinRes } = await supabaseAdmin
    .from("limbah_ekonomis")
    .select("*, lapak_warga(nama_usaha, nomor_wa)")
    .eq("warga_id", wargaAktif.id)
    .order("created_at", { ascending: false });

  const riwayatRakBin = rakBinRes || [];

  // FAKTA: Server Action untuk melempar barang ke Rak Bin
  async function laporLimbahEkonomis(payload: any) {
    "use server";
    const sesi = await pastikanOtentikasiWarga(); // BARRIER AKTIF

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { error } = await supabase.from("limbah_ekonomis").insert([{
      warga_id: sesi.id,
      rt_id: sesi.rt_id,
      nama_barang: payload.nama_barang,
      kategori: payload.kategori,
      opsi_tujuan: payload.opsi_tujuan,
      deskripsi: payload.deskripsi,
      status: "Menunggu Verifikasi"
    }]);

    if (error) throw new Error(error.message);
  }

  return (
    <SampahClient 
      wargaAktif={wargaAktif}
      saldo={saldoKiloan}
      totalKg={totalBeratKiloan}
      riwayatKiloan={riwayatKiloan}
      riwayatRakBin={riwayatRakBin}
      aksiLaporLimbah={laporLimbahEkonomis}
    />
  );
}