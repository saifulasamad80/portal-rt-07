import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
// INJEKSI MUTLAK: Panggil nama file yang BENAR (KurbanClient.tsx)
import KurbanAdminClient from "./KurbanClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function AdminKurbanPage() {
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

  const { data: kurbanRes } = await supabaseAdmin
    .from("transaksi_kurban")
    .select("*, warga(nama_lengkap)")
    .order("tanggal_transaksi", { ascending: false });

  const { data: wargaRes } = await supabaseAdmin
    .from("warga")
    .select("id, nama_lengkap")
    .eq("status_verifikasi", "Disetujui")
    .order("nama_lengkap", { ascending: true });

  // INJEKSI MUTLAK: Ambil data sampah untuk kalkulasi radar anti-tekor di UI
  const { data: sampahRes } = await supabaseAdmin
    .from("transaksi_sampah")
    .select("warga_id, jenis_transaksi, nominal_warga");

  async function simpanTransaksiKurban(wargaId: string, jenis: string, sumber: string, nominal: number, keterangan: string, tanggal: string) {
    "use server";
    try {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      
      // EFEK DOMINO: Operasi Auto-Debet Lintas Tabel
      if (sumber === "Saldo Tabungan Sampah" && jenis === "Setoran (+)") {
        const { error: errSampah } = await supabase.from("transaksi_sampah").insert([{
          warga_id: wargaId,
          jenis_transaksi: "Tarik",
          keterangan: `Auto-Debet untuk Tabungan Kurban: ${keterangan}`,
          nominal_warga: nominal,
          nominal_kas_rt: 0,
          tanggal_transaksi: tanggal
        }]);
        if (errSampah) return { success: false, message: "Gagal memotong saldo sampah: " + errSampah.message };
      }

      // Operasi Normal Kurban
      const { error } = await supabase.from("transaksi_kurban").insert([{
        warga_id: wargaId,
        jenis_transaksi: jenis,
        sumber_dana: sumber,
        nominal: nominal,
        keterangan: keterangan,
        tanggal_transaksi: tanggal
      }]);

      if (error) return { success: false, message: error.message };

      const { data: targetWarga } = await supabase.from("warga").select("nama_lengkap").eq("id", wargaId).single();

      await supabase.from("audit_log").insert([{
        aktor: adminAktif.nama,
        aksi: `Input Transaksi Kurban: ${jenis}`,
        tabel_target: "transaksi_kurban",
        detail: `${targetWarga?.nama_lengkap} - Rp${nominal} via ${sumber}`
      }]);
      
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  return <KurbanAdminClient 
            adminAktif={adminAktif} 
            transaksiList={kurbanRes || []} 
            wargaList={wargaRes || []} 
            sampahList={sampahRes || []}
            aksiSimpan={simpanTransaksiKurban} 
         />;
}