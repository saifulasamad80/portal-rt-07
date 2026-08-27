import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import JalurDaruratClient from "./JalurDaruratClient";
// INJEKSI MUTLAK: Import modul Client Component yang baru dibuat
import PengumumanClient from "./PengumumanClient"; 

export const revalidate = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function LandingPage() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const [pengumumanRes, votingTerbaruRes, kasRes] = await Promise.all([
    supabase.from("pengumuman_rt").select("*").order("tanggal_publikasi", { ascending: false }).limit(7),
    supabase.from("voting_rt").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("kas_rt").select("tipe_transaksi, nominal") 
  ]);

  const pengumumanReguler = pengumumanRes.data;
  const votingTerbaru = votingTerbaruRes.data;
  const kasData = kasRes.data;

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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 md:px-0 font-sans">
      
      <div className="text-center mb-10">
        <span className="bg-slate-800 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">Sistem Kependudukan & Lingkungan</span>
        <h1 className="text-3xl md:text-4xl font-black text-slate-800 mt-5 mb-3">Portal Digital <span className="text-blue-600">Warga & RT</span></h1>
        <p className="text-slate-500 text-sm max-w-lg mx-auto leading-relaxed">Platform terpadu untuk pelayanan surat, pelaporan darurat, manajemen fasilitas, dan pencatatan kas lingkungan secara transparan.</p>
      </div>

      <div className="w-full max-w-4xl space-y-6">
        
        {/* INJEKSI MUTLAK: Blok kode UI Galeri Lama DIBUANG, diganti Component Baru yang bersih */}
        <PengumumanClient pengumumanReguler={pengumumanReguler || []} rekapVoting={rekapVoting} />

        <div className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
          <h2 className="font-black text-slate-800 text-sm text-center mb-1">Transparansi Kas RT 07</h2>
          <p className="text-[10px] text-slate-400 text-center font-bold mb-6">Rekapitulasi keuangan lingkungan secara real-time.</p>
          
          <div className="grid grid-cols-3 gap-4 md:gap-6">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center shadow-sm">
              <div className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Pemasukan</div>
              <div className="font-black text-slate-800 text-sm md:text-xl tabular-nums">{formatRp(pemasukan)}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center shadow-sm">
              <div className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Pengeluaran</div>
              <div className="font-black text-slate-800 text-sm md:text-xl tabular-nums">{formatRp(pengeluaran)}</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center shadow-sm">
              <div className="text-[8px] md:text-[9px] font-black text-blue-700 uppercase tracking-widest mb-2">Saldo Akhir Kas</div>
              <div className="font-black text-blue-700 text-sm md:text-xl tabular-nums">{formatRp(saldoAkhir)}</div>
            </div>
          </div>
        </div>

        <JalurDaruratClient />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="bg-white p-8 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 text-center flex flex-col transition-all duration-300 hover:border-blue-300 hover:shadow-lg hover:-translate-y-1">
            <div className="w-16 h-16 bg-slate-50 border border-slate-100 text-blue-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-6 shadow-sm">👤</div>
            <h3 className="font-black text-slate-800 text-lg mb-3">Portal Warga</h3>
            <p className="text-xs text-slate-500 mb-8 flex-1 leading-relaxed px-2">Cek tagihan iuran, cetak surat pengantar, lapor kejadian darurat, dan ikut serta dalam e-voting RT.</p>
            <Link href="/login" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg text-sm transition-colors block shadow-md">Masuk Portal Warga</Link>
          </div>
          
          <div className="bg-white p-8 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 text-center flex flex-col transition-all duration-300 hover:border-emerald-300 hover:shadow-lg hover:-translate-y-1">
            <div className="w-16 h-16 bg-slate-50 border border-slate-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-6 shadow-sm">🏛️</div>
            <h3 className="font-black text-slate-800 text-lg mb-3">Pengurus RT</h3>
            <p className="text-xs text-slate-500 mb-8 flex-1 leading-relaxed px-2">Pusat komando admin untuk validasi warga baru, akses buku induk demografi, dan manajemen informasi lingkungan.</p>
            <Link href="/admin" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-lg text-sm transition-colors block shadow-md">Masuk Dasbor Admin</Link>
          </div>
        </div>

      </div>

      <p className="text-[10px] text-slate-400 mt-14 font-bold uppercase tracking-widest opacity-80">© 2026 - Sistem Manajemen RT 07.</p>
    </div>
  );
}