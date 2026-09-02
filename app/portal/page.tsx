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
  
  // -------------------------------------------------------------------------
  // INJEKSI MUTLAK: MESIN WAKTU & RADAR PERINGATAN DINI (WIB - Jakarta)
  // -------------------------------------------------------------------------
  const currDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const currentMonth = currDate.getMonth() + 1;
  const currentDay = currDate.getDate();
  const todayStr = `${currDate.getFullYear()}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
  
  const threeDaysAgo = new Date(currDate);
  threeDaysAgo.setDate(currDate.getDate() - 3);
  const threeDaysAgoStr = `${threeDaysAgo.getFullYear()}-${String(threeDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(threeDaysAgo.getDate()).padStart(2, '0')}`;

  // 1. Tarik Data Utama Warga + Anggota Keluarga (Untuk Cek Ultah)
  const { data: profilWarga } = await supabaseAdmin
    .from("warga")
    .select("*, anggota_keluarga(*)")
    .eq("id", wargaAktif.id)
    .single();

  // 2. Tarik Status Verifikasi Carik
  const { data: statusCarik } = await supabaseAdmin
    .from("sensus_kesejahteraan")
    .select("id")
    .eq("warga_id", wargaAktif.id)
    .maybeSingle();

  // 3. Tarik Jadwal Ronda (Filter: Mulai hari ini ke depan)
  const { data: jadwalRonda } = await supabaseAdmin
    .from("jadwal_ronda")
    .select("*")
    .eq("warga_id", wargaAktif.id)
    .gte("tanggal_tugas", todayStr)
    .order("tanggal_tugas", { ascending: true })
    .limit(1)
    .maybeSingle();

  // 4. Tarik Pengumuman Terbaru (Filter: 3 Hari Terakhir)
  const { data: pengumumanBaru } = await supabaseAdmin
    .from("pengumuman_rt")
    .select("id, judul, tanggal_publikasi")
    .gte("tanggal_publikasi", threeDaysAgoStr)
    .order("tanggal_publikasi", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isDataTervalidasiWarga = !!statusCarik;

  // MESIN PENGECEKAN ULANG TAHUN (KK & Anggota)
  let birthdayNames: string[] = [];
  
  if (profilWarga?.tanggal_lahir) {
    const bdate = new Date(profilWarga.tanggal_lahir);
    if (bdate.getMonth() + 1 === currentMonth && bdate.getDate() === currentDay) {
      birthdayNames.push(`Anda (${profilWarga.nama_lengkap})`);
    }
  }
  
  if (profilWarga?.anggota_keluarga) {
    profilWarga.anggota_keluarga.forEach((ak: any) => {
      if (ak.tanggal_lahir) {
        const bdate = new Date(ak.tanggal_lahir);
        if (bdate.getMonth() + 1 === currentMonth && bdate.getDate() === currentDay) {
          birthdayNames.push(ak.nama_lengkap);
        }
      }
    });
  }
  // -------------------------------------------------------------------------

  const handleLogout = async () => {
    "use server";
    const cookieStore = await cookies();
    cookieStore.delete("warga_session");
    redirect("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 mt-2">
        
        {/* HEADER UTAMA */}
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

        {/* ------------------------------------------------------------- */}
        {/* WADAH NOTIFIKASI & PERINGATAN DINI (SMART ALERTS)           */}
        {/* ------------------------------------------------------------- */}
        <div className="space-y-4">
          
          {/* RADAR 1: ULANG TAHUN */}
          {birthdayNames.length > 0 && (
            <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-5 rounded-2xl shadow-lg flex items-center gap-4 text-white relative overflow-hidden animate-in fade-in slide-in-from-top-4">
              <div className="absolute -right-4 -top-6 text-7xl opacity-20">🎂</div>
              <div className="text-4xl animate-bounce">🎉</div>
              <div className="relative z-10">
                <h3 className="font-black text-sm md:text-base uppercase tracking-widest mb-1 text-pink-100">Selamat Ulang Tahun!</h3>
                <p className="text-xs md:text-sm font-medium leading-relaxed">
                  Segenap Pengurus RT 07 mengucapkan selamat bertambah usia untuk: <strong className="bg-white/20 px-2 py-0.5 rounded">{birthdayNames.join(", ")}</strong>. Semoga senantiasa diberikan kesehatan, keberkahan, dan perlindungan.
                </p>
              </div>
            </div>
          )}

          {/* RADAR 2: JADWAL RONDA / SISKAMLING */}
          {jadwalRonda && (
            <div className={`p-5 md:p-6 rounded-2xl shadow-sm border flex items-start md:items-center justify-between gap-4 flex-col md:flex-row transition-all animate-in fade-in slide-in-from-top-4 ${jadwalRonda.tanggal_tugas === todayStr ? 'bg-rose-50 border-rose-300 shadow-rose-100' : 'bg-amber-50 border-amber-300'}`}>
              <div className="flex items-start md:items-center gap-4">
                <div className={`text-4xl mt-1 md:mt-0 ${jadwalRonda.tanggal_tugas === todayStr ? 'animate-pulse' : ''}`}>🔦</div>
                <div>
                  <h3 className={`font-black text-sm uppercase tracking-widest mb-1 flex items-center gap-2 ${jadwalRonda.tanggal_tugas === todayStr ? 'text-rose-800' : 'text-amber-800'}`}>
                    {jadwalRonda.tanggal_tugas === todayStr ? 'Panggilan Tugas Malam Ini!' : 'Panggilan Tugas Siskamling'}
                    {jadwalRonda.status === 'Menunggu Konfirmasi' && <span className="bg-rose-600 text-white text-[8px] px-1.5 py-0.5 rounded-full animate-pulse">ACTION REQUIRED</span>}
                  </h3>
                  <p className={`text-xs md:text-sm font-medium leading-relaxed ${jadwalRonda.tanggal_tugas === todayStr ? 'text-rose-700' : 'text-amber-700'}`}>
                    Anda dijadwalkan bertugas jaga malam pada <strong className="underline decoration-2 underline-offset-2">{new Date(jadwalRonda.tanggal_tugas).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>. Status Anda saat ini: <strong className="uppercase bg-white/50 px-1.5 py-0.5 rounded">{jadwalRonda.status || 'Menunggu Konfirmasi'}</strong>.
                  </p>
                </div>
              </div>
              <Link href="/portal/ronda" className={`w-full md:w-auto px-6 py-3.5 rounded-xl font-black text-xs text-center shadow-md whitespace-nowrap active:scale-95 transition-all uppercase tracking-widest shrink-0 ${jadwalRonda.tanggal_tugas === todayStr ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
                Konfirmasi Sekarang
              </Link>
            </div>
          )}

          {/* RADAR 3: PENGUMUMAN BARU */}
          {pengumumanBaru && (
            <div className="bg-blue-50 p-5 rounded-2xl shadow-sm border border-blue-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-start md:items-center gap-4 w-full">
                <div className="text-3xl mt-1 md:mt-0">📢</div>
                <div className="flex-1">
                  <h3 className="font-black text-blue-800 text-xs uppercase tracking-widest mb-1 flex items-center gap-2">
                    Siaran Pengurus RT
                    <span className="bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-full animate-pulse">BARU</span>
                  </h3>
                  <p className="text-xs text-blue-700 font-bold truncate max-w-[280px] md:max-w-2xl">{pengumumanBaru.judul}</p>
                </div>
              </div>
              <Link href="/" className="w-full md:w-auto bg-white border-2 border-blue-600 text-blue-700 px-6 py-3 rounded-xl text-xs font-black whitespace-nowrap shadow-sm hover:bg-blue-50 active:scale-95 transition-all uppercase tracking-widest text-center">
                Baca di Beranda
              </Link>
            </div>
          )}

          {/* RADAR 4: SENSUS CARIK (EXISTING) */}
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
        </div>
        {/* ------------------------------------------------------------- */}

        {/* MENU DASHBOARD UTAMA - KLONING BENTO BOX APPLE/ADMIN STYLE */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-4">
          
          <Link href="/portal/keuangan" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block group">
            <div className="text-3xl mb-3 text-amber-500 group-hover:scale-110 transition-transform origin-left">💰</div>
            <h2 className="font-black text-slate-800 text-sm">Transparansi Kas</h2>
            <p className="text-[10px] text-slate-500 mt-1">Cek tagihan & riwayat</p>
          </Link>

          <Link href="/portal/surat" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block group">
            <div className="text-3xl mb-3 text-blue-500 group-hover:scale-110 transition-transform origin-left">📄</div>
            <h2 className="font-black text-slate-800 text-sm">Layanan Surat</h2>
            <p className="text-[10px] text-slate-500 mt-1">Cetak pengantar mandiri</p>
          </Link>
          
          <Link href="/portal/lapak" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block group">
            <div className="text-3xl mb-3 text-orange-500 group-hover:scale-110 transition-transform origin-left">🏪</div>
            <h2 className="font-black text-slate-800 text-sm">Pasar Warga</h2>
            <p className="text-[10px] text-slate-500 mt-1">Katalog jasa & UMKM</p>
          </Link>
          
          <Link href="/portal/inventaris" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block group">
            <div className="text-3xl mb-3 text-purple-500 group-hover:scale-110 transition-transform origin-left">🎪</div>
            <h2 className="font-black text-slate-800 text-sm">Inventaris RT</h2>
            <p className="text-[10px] text-slate-500 mt-1">Booking tenda & kursi</p>
          </Link>

          <Link href="/portal/sampah" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block group">
            <div className="text-3xl mb-3 text-emerald-500 group-hover:scale-110 transition-transform origin-left">♻️</div>
            <h2 className="font-black text-slate-800 text-sm">Tabungan Sampah</h2>
            <p className="text-[10px] text-slate-500 mt-1">Saldo setor anorganik</p>
          </Link>

          <Link href="/portal/kurban" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block group">
            <div className="text-3xl mb-3 text-pink-500 group-hover:scale-110 transition-transform origin-left">🐄</div>
            <h2 className="font-black text-slate-800 text-sm">Tabungan Kurban</h2>
            <p className="text-[10px] text-slate-500 mt-1">Persiapan Idul Adha</p>
          </Link>
          
          <Link href="/portal/voting" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block group">
            <div className="text-3xl mb-3 text-indigo-500 group-hover:scale-110 transition-transform origin-left">📊</div>
            <h2 className="font-black text-slate-800 text-sm">E-Voting Warga</h2>
            <p className="text-[10px] text-slate-500 mt-1">Suara digital transparan</p>
          </Link>

          <Link href="/portal/ronda" className="bg-slate-900 p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-800 hover:shadow-lg hover:-translate-y-1 transition-all block group">
            <div className="text-3xl mb-3 text-yellow-400 group-hover:scale-110 transition-transform origin-left">🔦</div>
            <h2 className="font-black text-white text-sm">Siskamling</h2>
            <p className="text-[10px] text-slate-400 mt-1">Jadwal ronda Anda</p>
          </Link>

          {FITUR_LAPOR_AKTIF && (
            <Link href="/portal/lapor" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block col-span-2 md:col-span-4 group">
              <div className="text-3xl mb-3 text-rose-500 group-hover:scale-110 transition-transform origin-left">🚨</div>
              <h2 className="font-black text-slate-800 text-sm">Sistem Lapor Warga</h2>
              <p className="text-[10px] text-slate-500 mt-1">Tiket kerusakan fasilitas & keamanan</p>
            </Link>
          )}

        </div>
      </div>
    </div>
  );
}