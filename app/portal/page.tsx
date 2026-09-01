import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const FITUR_LAPOR_AKTIF = false;

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

  // 2. Pengecekan Status Verifikasi Carik
  const { data: statusCarik } = await supabaseAdmin
    .from("sensus_kesejahteraan")
    .select("id")
    .eq("warga_id", wargaAktif.id)
    .maybeSingle();

  const isDataTervalidasiWarga = !!statusCarik;

  const handleLogout = async () => {
    "use server";
    const cookieStore = await cookies();
    cookieStore.delete("warga_session");
    redirect("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 mt-2">
        
        <div className="bg-slate-900 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 gap-4 border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-xl font-black text-white uppercase shadow-inner shrink-0">
              {(profilWarga?.nama_lengkap || wargaAktif.nama).charAt(0)}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white mb-1">
                Halo, {profilWarga?.nama_lengkap || wargaAktif.nama}!
              </h1>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="text-blue-400 font-bold text-[10px] uppercase tracking-widest bg-slate-800 px-2.5 py-1 rounded border border-slate-700 shadow-sm">
                  NIK: {wargaAktif.nik}
                </span>
                <span className="text-emerald-400 font-bold text-[10px] uppercase tracking-widest bg-slate-800 px-2.5 py-1 rounded border border-slate-700 shadow-sm">
                  {profilWarga?.status_tinggal || "Warga Aktif"}
                </span>
              </div>
            </div>
          </div>
          <form action={handleLogout} className="w-full md:w-auto mt-2 md:mt-0">
            <button type="submit" className="w-full md:w-auto bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-3 px-6 rounded-lg transition-all shadow-md active:scale-95">
              Keluar Portal
            </button>
          </form>
        </div>

        {!isDataTervalidasiWarga && (
          <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden transition-all hover:shadow-md hover:border-amber-300">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
            <div className="flex items-start md:items-center gap-4 w-full">
              <div className="text-3xl animate-pulse hidden md:block">📋</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <h2 className="font-black text-amber-800 text-sm uppercase tracking-widest">Verifikasi Data Carik</h2>
                  <span className="bg-rose-600 text-white text-[9px] px-2 py-0.5 rounded font-black shadow-sm animate-pulse">WAJIB</span>
                </div>
                <p className="text-xs text-amber-900 font-medium leading-relaxed max-w-2xl">
                  Pengurus RT telah memperbarui data demografi Anda sesuai catatan <strong>Buku Carik Kelurahan</strong>. Mohon periksa dan verifikasi kesesuaian data keluarga Anda.
                </p>
              </div>
            </div>
            <Link href="/portal/profil" className="w-full md:w-auto bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] px-6 py-3.5 rounded-lg shadow-md transition-all active:scale-95 text-center shrink-0 uppercase tracking-widest">
              Cek & Verifikasi Data
            </Link>
          </div>
        )}

        {/* MENU DASHBOARD UTAMA - KLONING BENTO BOX APPLE/ADMIN STYLE */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-2">
          
          <Link href="/portal/keuangan" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-amber-500">💰</div>
            <h2 className="font-black text-slate-800 text-sm">Transparansi Kas</h2>
            <p className="text-[10px] text-slate-500 mt-1">Cek tagihan & riwayat</p>
          </Link>

          <Link href="/portal/surat" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-blue-500">📄</div>
            <h2 className="font-black text-slate-800 text-sm">Layanan Surat</h2>
            <p className="text-[10px] text-slate-500 mt-1">Cetak pengantar mandiri</p>
          </Link>
          
          <Link href="/portal/lapak" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-orange-500">🏪</div>
            <h2 className="font-black text-slate-800 text-sm">Pasar Warga</h2>
            <p className="text-[10px] text-slate-500 mt-1">Katalog jasa & UMKM</p>
          </Link>
          
          <Link href="/portal/inventaris" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-purple-500">🎪</div>
            <h2 className="font-black text-slate-800 text-sm">Inventaris RT</h2>
            <p className="text-[10px] text-slate-500 mt-1">Booking tenda & kursi</p>
          </Link>

          <Link href="/portal/sampah" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-emerald-500">♻️</div>
            <h2 className="font-black text-slate-800 text-sm">Tabungan Sampah</h2>
            <p className="text-[10px] text-slate-500 mt-1">Saldo setor anorganik</p>
          </Link>

          <Link href="/portal/kurban" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-pink-500">🐄</div>
            <h2 className="font-black text-slate-800 text-sm">Tabungan Kurban</h2>
            <p className="text-[10px] text-slate-500 mt-1">Persiapan Idul Adha</p>
          </Link>
          
          <Link href="/portal/voting" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-indigo-500">📊</div>
            <h2 className="font-black text-slate-800 text-sm">E-Voting Warga</h2>
            <p className="text-[10px] text-slate-500 mt-1">Suara digital transparan</p>
          </Link>

          <Link href="/portal/ronda" className="bg-slate-900 p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-800 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-yellow-400">🔦</div>
            <h2 className="font-black text-white text-sm">Siskamling</h2>
            <p className="text-[10px] text-slate-400 mt-1">Jadwal ronda Anda</p>
          </Link>

          {FITUR_LAPOR_AKTIF && (
            <Link href="/portal/lapor" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block col-span-2 md:col-span-4">
              <div className="text-3xl mb-3 text-rose-500">🚨</div>
              <h2 className="font-black text-slate-800 text-sm">Sistem Lapor Warga</h2>
              <p className="text-[10px] text-slate-500 mt-1">Tiket kerusakan fasilitas & keamanan</p>
            </Link>
          )}

        </div>
      </div>
    </div>
  );
}