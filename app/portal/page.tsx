import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function PortalWarga() {
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
  
  // 1. Tarik Data Utama Warga
  const { data: profilWarga } = await supabaseAdmin
    .from("warga")
    .select("*")
    .eq("id", wargaAktif.id)
    .single();

  // 2. INJEKSI MUTLAK: Pengecekan Status Sensus Kesejahteraan (Anti-Crash)
  const { data: sensusWarga } = await supabaseAdmin
    .from("sensus_kesejahteraan")
    .select("id")
    .eq("warga_id", wargaAktif.id)
    .maybeSingle();

  const isSensusLengkap = !!sensusWarga;

  const handleLogout = async () => {
    "use server";
    const cookieStore = await cookies();
    cookieStore.delete("warga_session");
    redirect("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12 font-sans">
      <nav className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center">
        <div className="font-bold text-lg ml-2 md:ml-4 tracking-wide">Portal Warga</div>
        <form action={handleLogout} className="mr-2 md:mr-4">
          <button type="submit" className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2.5 px-5 rounded-lg transition-colors shadow">Keluar Sesi</button>
        </form>
      </nav>

      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 mt-6">
        
        {/* KARTU SAMBUTAN */}
        <div className="bg-white p-8 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-2xl font-black text-slate-800">Halo, {profilWarga?.nama_lengkap || wargaAktif.nama}!</h1>
            <p className="text-sm text-slate-500 mt-2">NIK: <span className="font-mono text-slate-700 font-bold">{wargaAktif.nik}</span> <span className="mx-2 text-slate-300">•</span> Status: <span className="font-bold text-slate-700">{profilWarga?.status_tinggal || "Warga"}</span></p>
          </div>
          <div className="bg-slate-50 border border-slate-200 text-slate-700 py-3 px-6 rounded-lg text-center w-full md:w-auto shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1 text-slate-500">Status Akun</div>
            <div className="font-black text-sm text-emerald-600">{profilWarga?.status_verifikasi || "Disetujui"}</div>
          </div>
        </div>

        {/* INJEKSI MUTLAK: BLOK UI FOMO SENSUS (Hanya muncul jika belum mengisi) */}
        {!isSensusLengkap && (
          <div className="bg-rose-50 p-6 rounded-xl border border-rose-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden transition-all hover:shadow-md hover:border-rose-300">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
            <div className="flex items-start md:items-center gap-4 w-full">
              <div className="text-3xl animate-pulse hidden md:block">⚠️</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <h2 className="font-black text-rose-800 text-sm uppercase tracking-widest">Sensus Profil Keluarga</h2>
                  <span className="bg-rose-200 text-rose-800 text-[9px] px-2 py-0.5 rounded font-black shadow-sm">BELUM LENGKAP (0%)</span>
                </div>
                <p className="text-xs text-rose-700 font-medium leading-relaxed max-w-2xl">
                  Segera lengkapi Sensus Demografi ini untuk membuka kunci kelayakan Anda dalam menerima <strong>Bantuan Sosial (Bansos), Fasilitas Posyandu, dan Program Kelurahan</strong>.
                </p>
              </div>
            </div>
            <Link href="/portal/sensus" className="w-full md:w-auto bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] px-6 py-3.5 rounded-lg shadow-md transition-all active:scale-95 text-center shrink-0 uppercase tracking-widest">
              Isi Sensus Sekarang
            </Link>
          </div>
        )}

        {/* MENU DASHBOARD UTAMA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/portal/keuangan" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 transition-all duration-300 hover:border-slate-300 hover:shadow-lg hover:-translate-y-1 block">
            <h2 className="font-bold text-slate-800 mb-2">💰 Transparansi & Iuran</h2><p className="text-xs text-slate-500 leading-relaxed">Cek saldo kas RT dan riwayat pembayaran.</p>
          </Link>
          <Link href="/portal/surat" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 transition-all duration-300 hover:border-slate-300 hover:shadow-lg hover:-translate-y-1 block">
            <h2 className="font-bold text-slate-800 mb-2">📄 Layanan Surat</h2><p className="text-xs text-slate-500 leading-relaxed">Cetak surat pengantar RT secara mandiri.</p>
          </Link>
          
          <Link href="/portal/lapak" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 transition-all duration-300 hover:border-orange-300 hover:shadow-lg hover:-translate-y-1 block">
            <h2 className="font-bold text-slate-800 mb-2">🏪 Pasar Warga (UMKM)</h2><p className="text-xs text-slate-500 leading-relaxed">Katalog jasa & dagangan tetangga. Pesan langsung via WhatsApp.</p>
          </Link>
          
          <Link href="/portal/inventaris" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 transition-all duration-300 hover:border-slate-300 hover:shadow-lg hover:-translate-y-1 block">
            <h2 className="font-bold text-slate-800 mb-2">🎪 Kalender Inventaris</h2><p className="text-xs text-slate-500 leading-relaxed">Booking tenda, kursi, atau perlengkapan RT.</p>
          </Link>

          <Link href="/portal/sampah" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 transition-all duration-300 hover:border-slate-300 hover:shadow-lg hover:-translate-y-1 block">
            <h2 className="font-bold text-slate-800 mb-2">♻️ Tabungan Sampah</h2><p className="text-xs text-slate-500 leading-relaxed">Pantau saldo hasil setor sampah anorganik.</p>
          </Link>
          <Link href="/portal/kurban" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 transition-all duration-300 hover:border-slate-300 hover:shadow-lg hover:-translate-y-1 block">
            <h2 className="font-bold text-slate-800 mb-2">🐄 Tabungan Kurban</h2><p className="text-xs text-slate-500 leading-relaxed">Pantau persiapan dana kurban Idul Adha.</p>
          </Link>
          
          <Link href="/portal/voting" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 transition-all duration-300 hover:border-slate-300 hover:shadow-lg hover:-translate-y-1 block md:col-span-2">
            <h2 className="font-bold text-slate-800 mb-2">📊 E-Voting Warga</h2><p className="text-xs text-slate-500 leading-relaxed">Pemungutan suara digital untuk keputusan RT. Transparan & anti-curang.</p>
          </Link>

          <Link href="/portal/lapor" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 transition-all duration-300 hover:border-slate-300 hover:shadow-lg hover:-translate-y-1 block md:col-span-2">
            <h2 className="font-bold text-slate-800 mb-2">🚨 Sistem Lapor Warga</h2><p className="text-xs text-slate-500 leading-relaxed">Buat tiket laporan fasilitas rusak dengan sistem tracking otomatis.</p>
          </Link>
          
          <Link href="/portal/ronda" className="bg-slate-900 p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-800 transition-all duration-300 hover:border-slate-700 hover:shadow-lg hover:-translate-y-1 block md:col-span-2">
            <h2 className="font-bold text-white mb-2 flex items-center gap-2">🔦 Jadwal Siskamling</h2><p className="text-xs text-slate-400 leading-relaxed">Cek jadwal tugas ronda malam Anda dan konfirmasi kehadiran.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}