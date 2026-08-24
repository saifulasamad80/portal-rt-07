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

  // FAKTA: Tarik status profil langsung di server. Query Pengumuman Dihapus untuk efisiensi!
  const { data: profilWarga } = await supabaseAdmin
    .from("warga")
    .select("*")
    .eq("id", wargaAktif.id)
    .single();

  const handleLogout = async () => {
    "use server";
    const cookieStore = await cookies();
    cookieStore.delete("warga_session");
    redirect("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* NAVBAR BIRU PENUH */}
      <nav className="bg-blue-700 text-white p-4 shadow-md flex justify-between items-center">
        <div className="font-bold text-lg ml-2 md:ml-4">Portal RT 07</div>
        <form action={handleLogout} className="mr-2 md:mr-4">
          <button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold py-2 px-5 rounded transition-colors shadow">
            Keluar Sesi
          </button>
        </form>
      </nav>

      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 mt-4">
        
        {/* KARTU PROFIL LAMA */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Halo, {profilWarga?.nama_lengkap || wargaAktif.nama}!</h1>
            <p className="text-sm text-slate-500 mt-1">NIK: <span className="font-mono">{wargaAktif.nik}</span> | Status: <span className="font-bold text-blue-700">{profilWarga?.status_tinggal || "Warga"}</span></p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 py-2 px-4 rounded-lg text-center shadow-sm w-full md:w-auto">
            <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5">Status Akun</div>
            <div className="font-black text-sm">{profilWarga?.status_verifikasi || "Disetujui"}</div>
          </div>
        </div>

        {/* MENU GRID LAMA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/portal/keuangan" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all border-l-4 border-l-emerald-500 block">
            <h2 className="font-bold text-slate-800 mb-2">💰 Transparansi & Iuran</h2>
            <p className="text-xs text-slate-500 leading-relaxed">Cek saldo kas RT dan riwayat pembayaran.</p>
          </Link>
          <Link href="/portal/surat" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all border-l-4 border-l-blue-500 block">
            <h2 className="font-bold text-slate-800 mb-2">📄 Layanan Surat</h2>
            <p className="text-xs text-slate-500 leading-relaxed">Cetak surat pengantar RT secara mandiri.</p>
          </Link>
          <Link href="/portal/sampah" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-emerald-600 hover:shadow-md transition-all border-l-4 border-l-emerald-600 block">
            <h2 className="font-bold text-slate-800 mb-2">♻️ Tabungan Sampah</h2>
            <p className="text-xs text-slate-500 leading-relaxed">Pantau saldo hasil setor sampah anorganik.</p>
          </Link>
          <Link href="/portal/kurban" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-amber-700 hover:shadow-md transition-all border-l-4 border-l-amber-700 block">
            <h2 className="font-bold text-slate-800 mb-2">🐄 Tabungan Kurban</h2>
            <p className="text-xs text-slate-500 leading-relaxed">Pantau persiapan dana kurban Idul Adha.</p>
          </Link>
          
          <Link href="/portal/lapor" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-rose-500 hover:shadow-md transition-all border-l-4 border-l-rose-500 block md:col-span-2">
            <h2 className="font-bold text-slate-800 mb-2">🚨 Sistem Lapor Warga</h2>
            <p className="text-xs text-slate-500 leading-relaxed">Buat tiket laporan fasilitas rusak (lampu mati/selokan mampet) dengan auto-tracking dari Pak RT.</p>
          </Link>
          <Link href="/portal/inventaris" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-amber-600 hover:shadow-md transition-all border-l-4 border-l-amber-600 block">
            <h2 className="font-bold text-slate-800 mb-2">🎪 Kalender Inventaris</h2>
            <p className="text-xs text-slate-500 leading-relaxed">Booking tenda, kursi, atau sound system RT dengan sistem anti-bentrok jadwal.</p>
          </Link>
          <Link href="/portal/voting" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-indigo-500 hover:shadow-md transition-all border-l-4 border-l-indigo-500 block">
            <h2 className="font-bold text-slate-800 mb-2">📊 E-Voting Warga</h2>
            <p className="text-xs text-slate-500 leading-relaxed">Pemungutan suara digital untuk keputusan RT. Transparan & anti-curang.</p>
          </Link>
          <Link href="/portal/ronda" className="bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-700 hover:border-slate-500 hover:shadow-md transition-all border-l-4 border-l-slate-500 block md:col-span-2">
            <h2 className="font-bold text-white mb-2 flex items-center gap-2">🔦 Jadwal Siskamling</h2>
            <p className="text-xs text-slate-400 leading-relaxed">Cek jadwal tugas ronda malam Anda dan konfirmasi kehadiran secara digital.</p>
          </Link>
        </div>

        {/* LAYANAN EKSTRA (DIGEMBOK) */}
        <div className="pt-8 mt-10 border-t-2 border-dashed border-slate-300">
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
            <h2 className="text-xl font-black text-slate-700 flex items-center gap-2">🚀 Layanan Ekstra</h2>
            <span className="bg-slate-200 text-slate-500 text-[10px] font-black px-3 py-1 rounded uppercase tracking-wider w-fit">Butuh Dana Server</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-100 p-6 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-rose-100 text-rose-700 text-[10px] font-bold px-3 py-1.5 rounded-bl-lg flex items-center gap-1 shadow-sm border-b border-l border-rose-200">
                🔒 Upgrade Storage
              </div>
              <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2 text-base">💼 Buku Tamu</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Lapor tamu menginap dgn upload E-KTP.</p>
            </div>
            
            <div className="bg-slate-100 p-6 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-rose-100 text-rose-700 text-[10px] font-bold px-3 py-1.5 rounded-bl-lg flex items-center gap-1 shadow-sm border-b border-l border-rose-200">
                🔒 Upgrade Storage
              </div>
              <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2 text-base">🛒 Pasar Warga</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Jual-beli dengan foto resolusi tinggi.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}