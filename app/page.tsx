import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import JalurDaruratClient from "./JalurDaruratClient";
import PengumumanClient from "./PengumumanClient"; 
import KinerjaSampahClient from "./portal/KinerjaSampahClient";
import DemografiClient from "./DemografiClient"; // Kembali ke Import Normal

export const revalidate = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function LandingPage() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const [pengumumanRes, votingTerbaruRes, kasRes, sampahRes, wargaRes] = await Promise.all([
    supabase.from("pengumuman_rt").select("*").order("tanggal_publikasi", { ascending: false }).limit(7),
    supabase.from("voting_rt").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("kas_rt").select("tipe_transaksi, nominal"),
    supabase.from("transaksi_sampah").select("berat_kg, nominal_warga, nominal_kas_rt, tanggal_transaksi").eq("jenis_transaksi", "Setor"),
    supabase.from("warga").select("tanggal_lahir, jenis_kelamin, agama, pekerjaan, anggota_keluarga(tanggal_lahir, jenis_kelamin, agama, pekerjaan)").eq("status_verifikasi", "Disetujui")
  ]);

  const pengumumanReguler = pengumumanRes.data;
  const votingTerbaru = votingTerbaruRes.data;
  const kasData = kasRes.data;
  const sampahGlobal = sampahRes.data || [];
  const dataDemografiReal = wargaRes.data || []; 

  let rekapVoting: any = null;
  if (votingTerbaru) {
    let tampilkan = false;
    if (votingTerbaru.status === "Aktif") {
      tampilkan = true; 
    } else if (votingTerbaru.status === "Ditutup") {
      const tanggalTutup = new Date(votingTerbaru.created_at); 
      const hariIni = new Date();
      const selisihHari = Math.floor((hariIni.getTime() - tanggalTutup.getTime()) / (1000 * 3600 * 24));
      if (selisihHari <= 7) tampilkan = true; 
    }

    if (tampilkan) {
      const { data: suaraRekap } = await supabase.from("suara_voting").select("pilihan").eq("voting_id", votingTerbaru.id);
      const dataSuara = suaraRekap || [];
      const suaraOpsi1 = dataSuara.filter(s => s.pilihan === votingTerbaru.opsi_1).length;
      const suaraOpsi2 = dataSuara.filter(s => s.pilihan === votingTerbaru.opsi_2).length;
      const total = suaraOpsi1 + suaraOpsi2;
      
      rekapVoting = {
        ...votingTerbaru,
        statistik: {
          opsi_1_pct: total === 0 ? 0 : Math.round((suaraOpsi1 / total) * 100),
          opsi_2_pct: total === 0 ? 0 : Math.round((suaraOpsi2 / total) * 100),
          total: total
        }
      };
    }
  }

  let pemasukan = 0;
  let pengeluaran = 0;
  if (kasData) {
    kasData.forEach(k => {
      if (k.tipe_transaksi === 'Pemasukan') pemasukan += k.nominal;
      if (k.tipe_transaksi === 'Pengeluaran') pengeluaran += k.nominal;
    });
  }
  const saldoAkhir = pemasukan - pengeluaran;
  const formatRp = (angka: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center font-sans pb-16">
      
      <div className="w-full bg-slate-900 pt-16 pb-32 px-4 text-center rounded-b-[2.5rem] md:rounded-b-[4rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500"></div>
        <span className="bg-slate-800 text-blue-400 border border-slate-700 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-inner inline-block mb-6">
          Sistem Kependudukan & Lingkungan
        </span>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
          Portal Digital <span className="text-blue-500">Warga & RT</span>
        </h1>
        <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
          Platform terpadu untuk pelayanan surat, pelaporan darurat, manajemen fasilitas, dan transparansi keuangan lingkungan.
        </p>

        <div className="mt-7 flex flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-sm transition-colors active:scale-95"
          >
            <span className="text-sm">👤</span> Login Warga
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-5 py-2.5 rounded-lg border border-slate-700 shadow-sm transition-colors active:scale-95"
          >
            <span className="text-sm">🏛️</span> Dasbor Admin
          </Link>
        </div>
      </div>

      <div className="w-full max-w-6xl space-y-8 px-4 md:px-6 -mt-20 relative z-10">
        
        <section>
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <h2 className="font-bold text-slate-800 text-sm tracking-tight flex items-center gap-2">
                <span>📊</span> Transparansi Kas Lingkungan
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Laporan keuangan terbuka, disegarkan otomatis tiap 60 detik.</p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 bg-white border border-slate-200 text-emerald-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Live Data
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Pemasukan</span>
                <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0">↑</span>
              </div>
              <div className="font-bold text-slate-900 text-sm md:text-lg tabular-nums tracking-tight">{formatRp(pemasukan)}</div>
              <p className="text-[10px] text-slate-400 mt-1">Akumulasi iuran &amp; donasi warga</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Pengeluaran</span>
                <span className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-xs shrink-0">↓</span>
              </div>
              <div className="font-bold text-slate-900 text-sm md:text-lg tabular-nums tracking-tight">{formatRp(pengeluaran)}</div>
              <p className="text-[10px] text-slate-400 mt-1">Belanja operasional lingkungan</p>
            </div>

            <div className="bg-white border border-slate-200 ring-1 ring-blue-100 rounded-xl p-4 shadow-sm hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Saldo Akhir</span>
                <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs shrink-0">💰</span>
              </div>
              <div className="font-bold text-blue-700 text-sm md:text-lg tabular-nums tracking-tight">{formatRp(saldoAkhir)}</div>
              <p className="text-[10px] text-slate-400 mt-1">Kas tersedia per hari ini</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Transaksi Tercatat</span>
                <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs shrink-0">🧾</span>
              </div>
              <div className="font-bold text-slate-900 text-sm md:text-lg tabular-nums tracking-tight">{kasData?.length || 0} entri</div>
              <p className="text-[10px] text-slate-400 mt-1">Seluruh mutasi masuk &amp; keluar</p>
            </div>
          </div>
        </section>

        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-end justify-between gap-3 mb-6 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-bold text-slate-800 text-sm tracking-tight flex items-center gap-2">
                <span>📈</span> Peta Demografi Warga
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Statistik kependudukan RT 07 ditarik otomatis dari Buku Induk yang sah.</p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 bg-white border border-slate-200 text-amber-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Realtime
            </span>
          </div>

          <DemografiClient dataWarga={dataDemografiReal} />
        </div>

        <KinerjaSampahClient dataSampah={sampahGlobal} />

        <JalurDaruratClient />

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <PengumumanClient pengumumanReguler={pengumumanReguler || []} rekapVoting={rekapVoting} />

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-3">
              <h2 className="font-black text-slate-800 text-sm tracking-wide">📸 Galeri Kegiatan Warga</h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dokumentasi</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {["Kerja Bakti", "Posyandu", "HUT Kemerdekaan", "Rapat Warga"].map((judul) => (
                <div
                  key={judul}
                  className="aspect-square rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-500 transition-colors"
                >
                  <span className="text-2xl">🖼️</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-center px-2 leading-tight">{judul}</span>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-100">
              Foto kegiatan akan tampil di sini setelah diunggah pengurus.
            </p>
          </div>
        </section>

      </div>

      <p className="text-[10px] text-slate-400 mt-16 font-bold uppercase tracking-widest opacity-80">
        © 2026 - Sistem Kependudukan RT 07. Dikembangkan dengan Standar Profesional.
      </p>
    </div>
  );
}