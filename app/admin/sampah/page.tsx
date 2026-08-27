import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import SampahAdminClient from "./SampahAdminClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// SECURITY FIX: Hapus fallback rawan. 
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// INJEKSI MUTLAK: Gembok Keamanan Zero-Trust untuk Endpoint Admin
async function pastikanOtentikasiAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) throw new Error("Akses Ilegal: Sesi tidak valid atau telah berakhir.");
  
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload; // Lolos verifikasi, kembalikan payload admin
  } catch (error) {
    throw new Error("Akses Ilegal: Token keamanan rusak atau dimanipulasi.");
  }
}

export default async function AdminSampahPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) redirect("/admin");

  let adminAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    adminAktif = payload;
  } catch (error) { redirect("/admin"); }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // OPTIMASI LIMITASI: Batasi output maksimal 500 baris
  const { data: transaksiRes } = await supabaseAdmin.from("transaksi_sampah").select("*, warga(nama_lengkap)").order("tanggal_transaksi", { ascending: false }).limit(500);
  const { data: wargaRes } = await supabaseAdmin.from("warga").select("id, nama_lengkap").eq("status_verifikasi", "Disetujui").order("nama_lengkap", { ascending: true });

  // REFACTOR: Kunci Server Action dengan Barrier Otentikasi
  async function simpanTransaksiSampah(wargaId: string, jenis: string, keterangan: string, beratKg: number | null, nominalWarga: number, nominalKasRt: number, tanggal: string) {
    "use server";
    const sesi = await pastikanOtentikasiAdmin(); // BARRIER KEAMANAN AKTIF

    try {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      
      // Validasi Saldo Murni di Server
      if (jenis === "Tarik") {
        const { data: riwayat } = await supabase.from("transaksi_sampah").select("jenis_transaksi, nominal_warga").eq("warga_id", wargaId);
        let saldoAktual = 0;
        riwayat?.forEach(r => {
          if (r.jenis_transaksi === "Setor") saldoAktual += r.nominal_warga;
          if (r.jenis_transaksi === "Tarik") saldoAktual -= r.nominal_warga;
        });
        
        if (nominalWarga > saldoAktual) {
          return { success: false, message: `SERVER BLOCKED: Saldo tidak mencukupi. Saldo aktual: Rp${saldoAktual}` };
        }
      }

      const { error } = await supabase.from("transaksi_sampah").insert([{
        warga_id: wargaId, jenis_transaksi: jenis, keterangan, berat_kg: beratKg, nominal_warga: nominalWarga, nominal_kas_rt: nominalKasRt, tanggal_transaksi: tanggal
      }]);
      if (error) return { success: false, message: error.message };

      const { data: targetWarga } = await supabase.from("warga").select("nama_lengkap").eq("id", wargaId).single();
      
      // Ambil nama dari token yang tervalidasi, BUKAN closure luar
      await supabase.from("audit_log").insert([{
        aktor: sesi.nama, aksi: `Input Transaksi Sampah: ${jenis}`, tabel_target: "transaksi_sampah",
        detail: `${targetWarga?.nama_lengkap} - Warga: Rp${nominalWarga} | Kas RT: Rp${nominalKasRt}`
      }]);
      
      return { success: true };
    } catch (err: any) { return { success: false, message: err.message }; }
  }

  return <SampahAdminClient adminAktif={adminAktif} transaksiList={transaksiRes || []} wargaList={wargaRes || []} aksiSimpan={simpanTransaksiSampah} />;
}