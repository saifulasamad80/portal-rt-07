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

  if (!token) {
    redirect("/login");
  }

  let wargaAktif: any;
  
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    wargaAktif = payload;
  } catch (error) {
    redirect("/login");
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // EFEK DOMINO: Query v_rekap_kas_rt DIMATIKAN! Server jauh lebih ringan.
  const [kurbanRes, sampahRes] = await Promise.all([
    supabaseAdmin.from('v_saldo_kurban_warga').select('*').eq('warga_id', wargaAktif.id).maybeSingle(),
    supabaseAdmin.from('v_saldo_sampah_warga').select('*').eq('warga_id', wargaAktif.id).maybeSingle(),
  ]);

  const saldoKurban = kurbanRes.data?.saldo_akhir || kurbanRes.data?.total_kurban || 0;
  const saldoSampah = sampahRes.data?.saldo_akhir || sampahRes.data?.total_sampah || 0;

  const formatRp = (angka: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka);

  const handleLogout = async () => {
    "use server";
    const cookieStore = await cookies();
    cookieStore.delete("warga_session");
    redirect("/login");
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* HEADER PROFIL */}
        <div className="bg-blue-700 p-6 rounded-2xl shadow-xl text-white flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
           <div className="absolute top-0 right-0 bg-emerald-400 text-emerald-900 text-[10px] font-black px-3 py-1 rounded-bl-xl tracking-widest">
             WARGA TERVERIFIKASI
           </div>
           <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl font-black shadow-inner">
               {wargaAktif.nama?.toString().charAt(0)}
             </div>
             <div>
               <h1 className="text-3xl font-black mb-1">Halo, {wargaAktif.nama}!</h1>
               <p className="text-blue-200 font-mono text-sm tracking-wide">NIK: {wargaAktif.nik}</p>
             </div>
           </div>
           
           <form action={handleLogout} className="mt-4 md:mt-0">
             <button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md active:scale-95">
               Tutup Sesi
             </button>
           </form>
        </div>
        
        {/* DASHBOARD AGREGASI SALDO PERSONAL (GRID 2 KOLOM) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-emerald-500">
            <p className="text-sm font-bold text-slate-500 mb-1 uppercase tracking-wider">Tabungan Kurban Anda</p>
            <h2 className="text-3xl font-black text-slate-800">{formatRp(saldoKurban)}</h2>
            <p className="text-xs text-slate-400 mt-2">*Data ditarik otomatis</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-amber-500">
            <p className="text-sm font-bold text-slate-500 mb-1 uppercase tracking-wider">Saldo Bank Sampah</p>
            <h2 className="text-3xl font-black text-slate-800">{formatRp(saldoSampah)}</h2>
            <p className="text-xs text-slate-400 mt-2">*Dapat dicairkan/dialihkan</p>
          </div>
        </div>

        {/* MENU LAYANAN WARGA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <Link href="/portal/keuangan" className="bg-white p-5 rounded-xl shadow hover:shadow-lg transition-all border-l-4 border-emerald-500 block">
            <h2 className="font-bold text-slate-800 mb-2">💰 Transparansi & Iuran</h2>
            <p className="text-sm text-slate-500">Cek saldo kas RT dan riwayat pembayaran.</p>
          </Link>
          <Link href="/portal/surat" className="bg-white p-5 rounded-xl shadow hover:shadow-lg transition-all border-l-4 border-blue-500 block">
            <h2 className="font-bold text-slate-800 mb-2">📄 Layanan Surat</h2>
            <p className="text-sm text-slate-500">Cetak surat pengantar RT secara mandiri.</p>
          </Link>
          <Link href="/portal/lapor" className="bg-white p-5 rounded-xl shadow hover:shadow-lg transition-all border-l-4 border-rose-500 block md:col-span-2">
            <h2 className="font-bold text-slate-800 mb-2">🚨 Sistem Lapor Warga</h2>
            <p className="text-sm text-slate-500">Buat tiket laporan fasilitas rusak dengan auto-tracking dari Pak RT.</p>
          </Link>
          <Link href="/portal/inventaris" className="bg-white p-5 rounded-xl shadow hover:shadow-lg transition-all border-l-4 border-amber-600 block">
            <h2 className="font-bold text-slate-800 mb-2">🎪 Kalender Inventaris</h2>
            <p className="text-sm text-slate-500">Booking tenda, kursi, atau sound system RT dengan sistem anti-bentrok jadwal.</p>
          </Link>
          <Link href="/portal/voting" className="bg-white p-5 rounded-xl shadow hover:shadow-lg transition-all border-l-4 border-indigo-500 block">
            <h2 className="font-bold text-slate-800 mb-2">📊 E-Voting Warga</h2>
            <p className="text-sm text-slate-500">Pemungutan suara digital untuk keputusan RT. Transparan & anti-curang.</p>
          </Link>
          <Link href="/portal/ronda" className="bg-slate-800 p-5 rounded-xl shadow hover:shadow-lg transition-all border-l-4 border-slate-500 block md:col-span-2">
            <h2 className="font-bold text-white mb-2 flex items-center gap-2">🔦 Jadwal Siskamling</h2>
            <p className="text-sm text-slate-400">Cek jadwal tugas ronda malam Anda dan konfirmasi kehadiran secara digital.</p>
          </Link>
        </div>

      </div>
    </div>
  );
}