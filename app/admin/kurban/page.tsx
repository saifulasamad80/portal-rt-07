import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import KurbanAdminClient from "./KurbanClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// SECURITY FIX: Hapus fallback string. Paksa server melempar error jika ENV bocor!
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// INJEKSI MUTLAK: Gembok Keamanan Zero-Trust
async function pastikanOtentikasiAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) throw new Error("Akses Ilegal: Sesi tidak valid atau telah berakhir.");
  
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload; // Identitas admin tervalidasi
  } catch (error) {
    throw new Error("Akses Ilegal: Token keamanan rusak atau dimanipulasi.");
  }
}

export default async function AdminKurbanPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) redirect("/admin");

  let adminAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    adminAktif = payload;
  } catch (error) { redirect("/admin"); }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // OPTIMASI LIMITASI: Batasi output agar tidak OOM
  const { data: kurbanRes } = await supabaseAdmin.from("transaksi_kurban").select("*, warga(nama_lengkap)").order("tanggal_transaksi", { ascending: false }).limit(500);
  const { data: wargaRes } = await supabaseAdmin.from("warga").select("id, nama_lengkap").eq("status_verifikasi", "Disetujui").order("nama_lengkap", { ascending: true });
  const { data: sampahRes } = await supabaseAdmin.from("transaksi_sampah").select("warga_id, jenis_transaksi, nominal_warga");

  async function simpanTransaksiKurban(wargaId: string, jenis: string, sumber: string, nominal: number, keterangan: string, tanggal: string) {
    "use server";
    // REFACTOR: Verifikasi JWT di dalam Action (Mencegah IDOR via Postman)
    const sesiAsli = await pastikanOtentikasiAdmin(); 

    try {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      
      // ---------------------------------------------------------------------
      // EKSEKUSI RPC: Transaksi Finansial Atomik (Auto-Debet Sampah)
      // ---------------------------------------------------------------------
      if (sumber === "Saldo Tabungan Sampah" && jenis === "Setoran (+)") {
        const { error: errRpc } = await supabase.rpc('proses_autodebet_kurban', {
          p_warga_id: wargaId,
          p_nominal: nominal,
          p_keterangan: keterangan,
          p_tanggal: tanggal,
          p_aktor: sesiAsli.nama
        });

        if (errRpc) throw new Error("Gagal mengeksekusi Auto-Debet: " + errRpc.message);
        return { success: true };
      }

      // ---------------------------------------------------------------------
      // TRANSAKSI NORMAL (Penarikan Kurban / Setoran Tunai & Transfer)
      // ---------------------------------------------------------------------
      if (jenis === "Tarikan (-)") {
        const { data: riwayat } = await supabase.from("transaksi_kurban").select("jenis_transaksi, nominal").eq("warga_id", wargaId);
        let saldoKurban = 0;
        riwayat?.forEach(r => {
          if (r.jenis_transaksi === "Setoran (+)") saldoKurban += r.nominal;
          if (r.jenis_transaksi === "Tarikan (-)") saldoKurban -= r.nominal;
        });
        if (nominal > saldoKurban) return { success: false, message: `SERVER BLOCKED: Saldo kurban tidak mencukupi!` };
      }

      const { error } = await supabase.from("transaksi_kurban").insert([{
        warga_id: wargaId, jenis_transaksi: jenis, sumber_dana: sumber, nominal: nominal, keterangan: keterangan, tanggal_transaksi: tanggal
      }]);

      if (error) return { success: false, message: error.message };

      const { data: targetWarga } = await supabase.from("warga").select("nama_lengkap").eq("id", wargaId).single();
      await supabase.from("audit_log").insert([{
        aktor: sesiAsli.nama, aksi: `Input Transaksi Kurban: ${jenis}`, tabel_target: "transaksi_kurban",
        detail: `${targetWarga?.nama_lengkap} - Rp${nominal} via ${sumber}`
      }]);
      
      return { success: true };
    } catch (err: any) { return { success: false, message: err.message }; }
  }

  return <KurbanAdminClient adminAktif={adminAktif} transaksiList={kurbanRes || []} wargaList={wargaRes || []} sampahList={sampahRes || []} aksiSimpan={simpanTransaksiKurban} />;
}