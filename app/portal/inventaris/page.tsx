import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import InventarisClient from "./InventarisClient";

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

export default async function InventarisPage() {
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
  
  const [masterRes, riwayatRes, semuaPinjamRes] = await Promise.all([
    supabaseAdmin.from("master_inventaris").select("*").order("nama_barang", { ascending: true }),
    supabaseAdmin.from("peminjaman_inventaris").select("*").eq("warga_id", wargaAktif.id).order("tanggal_pinjam", { ascending: true }),
    // FAKTA: Tarik jadwal barang yang sudah SUKSES DIPINJAM orang lain untuk dilempar ke kalender warga
    supabaseAdmin.from("peminjaman_inventaris").select("nama_barang, tanggal_pinjam").eq("status", "Disetujui")
  ]);

  // REFACTOR MUTLAK: Eksekusi Validasi Lapis Baja Anti Double-Booking
  async function ajukanBooking(namaBarang: string, tanggal: string, keterangan: string) {
    "use server";
    const sesi = await pastikanOtentikasiWarga(); // BARRIER AKTIF
    
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // ----------------------------------------------------------------------------------
    // PENGECEKAN DOUBLE-BOOKING DI BACKEND (Menahan serangan brutal / glitch)
    // ----------------------------------------------------------------------------------
    const { data: cekBentrok } = await supabaseAdmin
      .from("peminjaman_inventaris")
      .select("id")
      .eq("nama_barang", namaBarang)
      .eq("tanggal_pinjam", tanggal)
      .eq("status", "Disetujui"); // Hanya mengecek yang sudah beneran di-ACC Pak RT

    if (cekBentrok && cekBentrok.length > 0) {
      throw new Error(`PERINGATAN: Fasilitas "${namaBarang}" sudah di-Booking & Disetujui untuk warga lain pada tanggal tersebut. Silakan pilih tanggal lain.`);
    }
    // ----------------------------------------------------------------------------------

    const { error } = await supabaseAdmin.from("peminjaman_inventaris").insert([{
      warga_id: sesi.id, // Gunakan ID asli
      nama_barang: namaBarang,
      tanggal_pinjam: tanggal,
      keterangan: keterangan,
      status: "Menunggu"
    }]);

    if (error) throw new Error("Database Error: " + error.message);
  }

  return <InventarisClient 
           masterBarang={masterRes.data || []} 
           riwayat={riwayatRes.data || []} 
           jadwalTerisi={semuaPinjamRes.data || []} // Lemparkan jadwal yang bentrok ke Client
           ajukanBooking={ajukanBooking} 
         />;
}