import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import SampahAdminClient from "./SampahAdminClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

async function pastikanOtentikasiAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) throw new Error("Akses Ilegal: Sesi tidak valid atau telah berakhir.");
  
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload; 
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

  // 1. Tarik Data Sampah Kiloan
  const { data: transaksiRes } = await supabaseAdmin.from("transaksi_sampah").select("*, warga(nama_lengkap)").order("tanggal_transaksi", { ascending: false }).limit(500);
  const { data: wargaRes } = await supabaseAdmin.from("warga").select("id, nama_lengkap").eq("status_verifikasi", "Disetujui").order("nama_lengkap", { ascending: true });

  // 2. Tarik Data Rak Bin
  const { data: rakBinRes } = await supabaseAdmin
    .from("limbah_ekonomis")
    .select("*, warga(nama_lengkap), lapak_warga(nama_usaha)")
    .order("created_at", { ascending: false });

  // 3. Tarik Daftar Teknisi / Jasa Profesional dari Tabel Lapak (Untuk Dropdown Penugasan)
  const { data: teknisiRes } = await supabaseAdmin
    .from("lapak_warga")
    .select("id, nama_usaha, warga(nama_lengkap)")
    .eq("kategori", "Jasa & Servis") // Hanya ambil yang kategori Jasa
    .eq("status", "Aktif");

  // SERVER ACTION 1: SIMPAN SAMPAH KILOAN (Tetap sama)
  async function simpanTransaksiSampah(wargaId: string, jenis: string, keterangan: string, beratKg: number | null, nominalWarga: number, nominalKasRt: number, tanggal: string) {
    "use server";
    const sesi = await pastikanOtentikasiAdmin(); 

    try {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      
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
      
      await supabase.from("audit_log").insert([{
        aktor: sesi.nama, aksi: `Input Transaksi Sampah: ${jenis}`, tabel_target: "transaksi_sampah",
        detail: `${targetWarga?.nama_lengkap} - Warga: Rp${nominalWarga} | Kas RT: Rp${nominalKasRt}`
      }]);
      
      return { success: true };
    } catch (err: any) { return { success: false, message: err.message }; }
  }

  // SERVER ACTION 2: UPDATE STATUS RAK BIN (Tugaskan Teknisi)
  async function updateStatusRakBin(idRakBin: string, statusBaru: string, idTeknisi: string | null) {
    "use server";
    const sesi = await pastikanOtentikasiAdmin(); // BARRIER AKTIF

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Update status barang, dan jika ada idTeknisi (di-assign), masukkan ke kolom teknisi_id
    const payloadUpdate: any = { status: statusBaru };
    if (idTeknisi) {
      payloadUpdate.teknisi_id = idTeknisi;
    }

    const { error } = await supabase.from("limbah_ekonomis").update(payloadUpdate).eq("id", idRakBin);
    if (error) throw new Error(error.message);

    // Ambil nama barang untuk Audit Log
    const { data: targetBarang } = await supabase.from("limbah_ekonomis").select("nama_barang").eq("id", idRakBin).single();

    await supabase.from("audit_log").insert([{
      aktor: sesi.nama,
      aksi: `Update Rak Bin: ${statusBaru}`,
      tabel_target: "limbah_ekonomis",
      detail: `Barang: ${targetBarang?.nama_barang} ${idTeknisi ? '(Telah ditugaskan ke Teknisi)' : ''}`
    }]);
  }

  return (
    <SampahAdminClient 
      adminAktif={adminAktif} 
      transaksiList={transaksiRes || []} 
      wargaList={wargaRes || []} 
      rakBinList={rakBinRes || []}
      teknisiList={teknisiRes || []}
      aksiSimpan={simpanTransaksiSampah} 
      aksiUpdateRakBin={updateStatusRakBin}
    />
  );
}