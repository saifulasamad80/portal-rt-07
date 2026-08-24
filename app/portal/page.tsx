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
  try { const { payload } = await jwtVerify(token, JWT_SECRET); wargaAktif = payload; } 
  catch (error) { redirect("/login"); }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: profilWarga } = await supabaseAdmin.from("warga").select("*").eq("id", wargaAktif.id).single();

  // FAKTA: Tarik pengumuman RT reguler (opsional) dengan penjinak TypeScript
  const { data: dataPengumuman } = await supabaseAdmin.from("pengumuman_rt").select("*").order("tanggal_publikasi", { ascending: false }).limit(1);
  const pengumumanReguler = dataPengumuman || []; // Dijamin selalu berupa Array

  // FAKTA: Logika 7 Hari! Cari 1 voting terakhir yang sudah ditutup
  const { data: votingDitutup } = await supabaseAdmin
    .from("voting_rt")
    .select("*")
    .eq("status", "Ditutup")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  let rekapVoting: any = null;
  if (votingDitutup) {
    // Hitung selisih waktu dari saat voting dibuat/ditutup
    const tanggalTutup = new Date(votingDitutup.created_at); 
    const hariIni = new Date();
    const selisihHari = Math.floor((hariIni.getTime() - tanggalTutup.getTime()) / (1000 * 3600 * 24));
    
    // TAMPILKAN HANYA JIKA BELUM LEWAT 7 HARI
    if (selisihHari <= 7) {
      const { data: suaraRekap } = await supabaseAdmin.from("suara_voting").select("pilihan").eq("voting_id", votingDitutup.id);
      const dataSuara = suaraRekap || [];
      const suaraOpsi1 = dataSuara.filter(s => s.pilihan === votingDitutup.opsi_1).length;
      const suaraOpsi2 = dataSuara.filter(s => s.pilihan === votingDitutup.opsi_2).length;
      const total = suaraOpsi1 + suaraOpsi2;
      
      rekapVoting = {
        ...votingDitutup,
        statistik: {
          opsi_1_pct: total === 0 ? 0 : Math.round((suaraOpsi1 / total) * 100),
          opsi_2_pct: total === 0 ? 0 : Math.round((suaraOpsi2 / total) * 100),
          total: total
        }
      };
    }
  }

  const handleLogout = async () => {
    "use server";
    const cookieStore = await cookies();
    cookieStore.delete("warga_session");
    redirect("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <nav className="bg-blue-700 text-white p-4 shadow-md flex justify-between items-center">
        <div className="font-bold text-lg ml-2 md:ml-4">Portal RT 07</div>
        <form action={handleLogout} className="mr-2 md:mr-4">
          <button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold py-2 px-5 rounded transition-colors shadow">Keluar Sesi</button>
        </form>
      </nav>

      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 mt-4">
        
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

        {/* FAKTA: PAPAN PENGUMUMAN & REKAP KEPUTUSAN YANG RINGKAS */}
        {(pengumumanReguler.length > 0 || rekapVoting) && (
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-amber-500">
            <h2 className="font-black text-slate-800 text-sm flex items-center gap-2 mb-3">📢 Papan Informasi RT</h2>
            
            {/* Rekap Voting (Muncul Maks 7 Hari) */}
            {rekapVoting && (
              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg mb-3">
                <div className="flex items-center justify-between mb-3 border-b border-indigo-100 pb-2">
                  <h3 className="font-black text-indigo-900 text-xs uppercase tracking-wide">Hasil Keputusan: {rekapVoting.judul}</h3>
                  <span className="bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded">Resmi Ditetapkan</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-700 mb-1">
                      <span>{rekapVoting.opsi_1}</span>
                      <span>{rekapVoting.statistik.opsi_1_pct}%</span>
                    </div>
                    <div className="w-full bg-indigo-100 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${rekapVoting.statistik.opsi_1_pct}%` }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-700 mb-1">
                      <span>{rekapVoting.opsi_2}</span>
                      <span>{rekapVoting.statistik.opsi_2_pct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2"><div className="bg-slate-500 h-2 rounded-full" style={{ width: `${rekapVoting.statistik.opsi_2_pct}%` }}></div></div>
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 mt-3 text-right">Partisipasi: {rekapVoting.statistik.total} Suara Masuk</p>
              </div>
            )}
            
            {/* Pengumuman Biasa (Jika Ada) */}
            {pengumumanReguler.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <h3 className="font-bold text-slate-800 text-sm">{pengumumanReguler[0].judul}</h3>
                <p className="text-xs text-slate-600 mt-1">{pengumumanReguler[0].deskripsi}</p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/portal/keuangan" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all border-l-4 border-l-emerald-500 block">
            <h2 className="font-bold text-slate-800 mb-2">💰 Transparansi & Iuran</h2><p className="text-xs text-slate-500 leading-relaxed">Cek saldo kas RT dan riwayat pembayaran.</p>
          </Link>
          <Link href="/portal/surat" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all border-l-4 border-l-blue-500 block">
            <h2 className="font-bold text-slate-800 mb-2">📄 Layanan Surat</h2><p className="text-xs text-slate-500 leading-relaxed">Cetak surat pengantar RT secara mandiri.</p>
          </Link>
          <Link href="/portal/sampah" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-emerald-600 hover:shadow-md transition-all border-l-4 border-l-emerald-600 block">
            <h2 className="font-bold text-slate-800 mb-2">♻️ Tabungan Sampah</h2><p className="text-xs text-slate-500 leading-relaxed">Pantau saldo hasil setor sampah anorganik.</p>
          </Link>
          <Link href="/portal/kurban" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-amber-700 hover:shadow-md transition-all border-l-4 border-l-amber-700 block">
            <h2 className="font-bold text-slate-800 mb-2">🐄 Tabungan Kurban</h2><p className="text-xs text-slate-500 leading-relaxed">Pantau persiapan dana kurban Idul Adha.</p>
          </Link>
          <Link href="/portal/lapor" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-rose-500 hover:shadow-md transition-all border-l-4 border-l-rose-500 block md:col-span-2">
            <h2 className="font-bold text-slate-800 mb-2">🚨 Sistem Lapor Warga</h2><p className="text-xs text-slate-500 leading-relaxed">Buat tiket laporan fasilitas rusak (lampu mati/selokan mampet) dengan auto-tracking dari Pak RT.</p>
          </Link>
          <Link href="/portal/inventaris" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:border-amber-600 hover:shadow-md transition-all border-l-4 border-l-amber-600 block">
            <h2 className="font-bold text-slate-800 mb-2">🎪 Kalender Inventaris</h2><p className="text-xs text-slate-500 leading-relaxed">Booking tenda, kursi, atau sound system RT dengan sistem anti-bentrok jadwal.</p>
          </Link>
          <Link href="/portal/ronda" className="bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-700 hover:border-slate-500 hover:shadow-md transition-all border-l-4 border-l-slate-500 block md:col-span-2">
            <h2 className="font-bold text-white mb-2 flex items-center gap-2">🔦 Jadwal Siskamling</h2><p className="text-xs text-slate-400 leading-relaxed">Cek jadwal tugas ronda malam Anda dan konfirmasi kehadiran secara digital.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}