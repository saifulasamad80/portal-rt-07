import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";

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

  const [kasRes, kurbanRes, sampahRes] = await Promise.all([
    supabaseAdmin.from('v_rekap_kas_rt').select('*').limit(1).single(),
    supabaseAdmin.from('v_saldo_kurban_warga').select('*').eq('warga_id', wargaAktif.id).maybeSingle(),
    supabaseAdmin.from('v_saldo_sampah_warga').select('*').eq('warga_id', wargaAktif.id).maybeSingle(),
  ]);

  const saldoKasGlobal = kasRes.data?.saldo_akhir || kasRes.data?.total_saldo || 0;
  const saldoKurban = kurbanRes.data?.saldo_akhir || kurbanRes.data?.total_kurban || 0;
  const saldoSampah = sampahRes.data?.saldo_akhir || sampahRes.data?.total_sampah || 0;

  const formatRp = (angka: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka);

  // FAKTA: Ini adalah "Server Action". Sebuah fungsi yang hidup murni di server.
  // Tidak butuh API route terpisah atau fetch onClick!
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
           
           {/* FAKTA: Tombol onClick diubah menjadi elemen Form yang mengeksekusi Server Action */}
           <form action={handleLogout} className="mt-4 md:mt-0">
             <button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md active:scale-95">
               Tutup Sesi
             </button>
           </form>
        </div>
        
        {/* DASHBOARD AGREGASI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-blue-500">
            <p className="text-sm font-bold text-slate-500 mb-1 uppercase tracking-wider">Total Kas RT</p>
            <h2 className="text-3xl font-black text-slate-800">{formatRp(saldoKasGlobal)}</h2>
            <p className="text-xs text-slate-400 mt-2">*Saldo transparan kas lingkungan</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-emerald-500">
            <p className="text-sm font-bold text-slate-500 mb-1 uppercase tracking-wider">Tabungan Kurban Anda</p>
            <h2 className="text-3xl font-black text-slate-800">{formatRp(saldoKurban)}</h2>
            <p className="text-xs text-slate-400 mt-2">*Data ditarik otomatis dari sistem</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-4 border-amber-500">
            <p className="text-sm font-bold text-slate-500 mb-1 uppercase tracking-wider">Saldo Bank Sampah</p>
            <h2 className="text-3xl font-black text-slate-800">{formatRp(saldoSampah)}</h2>
            <p className="text-xs text-slate-400 mt-2">*Dapat dicairkan atau dialihkan</p>
          </div>
        </div>

      </div>
    </div>
  );
}