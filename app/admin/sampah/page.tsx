import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import SampahAdminClient from "./SampahAdminClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function AdminSampahPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) redirect("/admin");

  let adminAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    adminAktif = payload;
  } catch (error) {
    redirect("/admin");
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: transaksiRes } = await supabaseAdmin
    .from("transaksi_sampah")
    .select("*, warga(nama_lengkap)")
    .order("tanggal_transaksi", { ascending: false });

  const { data: wargaRes } = await supabaseAdmin
    .from("warga")
    .select("id, nama_lengkap")
    .eq("status_verifikasi", "Disetujui")
    .order("nama_lengkap", { ascending: true });

  // INJEKSI MUTLAK: Perbaikan pengembalian error agar React #441 musnah
  async function simpanTransaksiSampah(wargaId: string, jenis: string, keterangan: string, beratKg: number | null, nominalWarga: number, nominalKasRt: number, tanggal: string) {
    "use server";
    try {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      
      const { error } = await supabase.from("transaksi_sampah").insert([{
        warga_id: wargaId,
        jenis_transaksi: jenis, // Sekarang dikirim murni sebagai "Setor" atau "Tarik"
        keterangan: keterangan,
        berat_kg: beratKg,
        nominal_warga: nominalWarga,
        nominal_kas_rt: nominalKasRt,
        tanggal_transaksi: tanggal
      }]);

      if (error) return { success: false, message: error.message };

      const { data: targetWarga } = await supabase.from("warga").select("nama_lengkap").eq("id", wargaId).single();

      await supabase.from("audit_log").insert([{
        aktor: adminAktif.nama,
        aksi: `Input Transaksi Sampah: ${jenis}`,
        tabel_target: "transaksi_sampah",
        detail: `${targetWarga?.nama_lengkap} - Warga: Rp${nominalWarga} | Kas RT: Rp${nominalKasRt}`
      }]);
      
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  return <SampahAdminClient 
            adminAktif={adminAktif} 
            transaksiList={transaksiRes || []} 
            wargaList={wargaRes || []} 
            aksiSimpan={simpanTransaksiSampah} 
         />;
}