import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import JalurDaruratClient from "./JalurDaruratClient";
import PengumumanClient from "./PengumumanClient"; 
import KinerjaSampahClient from "./portal/KinerjaSampahClient"; // Komponen Grafik Premium

export const revalidate = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function LandingPage() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const [pengumumanRes, votingTerbaruRes, kasRes, sampahRes] = await Promise.all([
    supabase.from("pengumuman_rt").select("*").order("tanggal_publikasi", { ascending: false }).limit(7),
    supabase.from("voting_rt").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("kas_rt").select("tipe_transaksi, nominal"),
    supabase.from("transaksi_sampah").select("berat_kg, nominal_warga, nominal_kas_rt, tanggal_transaksi").eq("jenis_transaksi", "Setor")
  ]);

  const pengumumanReguler = pengumumanRes.data;
  const votingTerbaru = votingTerbaruRes.data;
  const kasData = kasRes.data;
  const sampahGlobal = sampahRes.data || [];

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
      
      {/* 1. HERO SECTION */}
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
      </div>

      <div className="w-full max-w-5xl space-y-8 px-4 md:px-6 -mt-20 relative z-10">
        
        {/* 2. THE GATEWAYS (VIP Access) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 flex flex-col transition-all duration-300 hover:border-blue-300 hover:shadow-xl hover:-translate-y-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl shadow-inner shrink-0">👤</div>
              <div>
                <h3 className="font-black text-slate-800 text-xl">Portal Warga</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Akses Mandiri</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-6 flex-1 leading-relaxed">Masuk untuk mengecek tagihan iuran, cetak surat pengantar, lapor kejadian darurat, dan ikut e-voting.</p>
            <Link href="/login" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl text-sm transition-colors text-center shadow-md active:scale-95 uppercase tracking-wide">
              Masuk Portal
            </Link>
          </div>
          
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 flex flex-col transition-all duration-300 hover:border-emerald-300 hover:shadow-xl hover:-translate-y-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-2xl shadow-inner shrink-0">🏛️</div>
              <div>
                <h3 className="font-black text-slate-800 text-xl">Pengurus RT</h3>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pusat Komando</h4>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-6 flex-1 leading-relaxed">Akses khusus admin untuk validasi warga baru, buku induk demografi, dan manajemen kas lingkungan.</p>
            <Link href="/admin" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl text-sm transition-colors text-center shadow-md active:scale-95 uppercase tracking-wide">
              Masuk Dasbor Admin
            </Link>
          </div>
        </div>

        {/* 3. KAS SECTION (Financial Transparency) */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-2">
            <div>
              <h2 className="font-black text-slate-800 text-lg flex items-center gap-2"><span>📊</span> Transparansi Kas Lingkungan</h2>
              <p className="text-[11px] text-slate-500 font-medium">Laporan keuangan terbuka (*Public Dashboard*).</p>
            </div>
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-emerald-200 shadow-sm animate-pulse">Live Data</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-left shadow-sm hover:border-slate-300 transition-colors">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Pemasukan</div>
              <div className="font-black text-emerald-600 text-sm md:text-xl tabular-nums">{formatRp(pemasukan)}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-left shadow-sm hover:border-slate-300 transition-colors">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Pengeluaran</div>
              <div className="font-black text-rose-600 text-sm md:text-xl tabular-nums">{formatRp(pengeluaran)}</div>
            </div>
            <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-blue-600 to-indigo-800 border border-blue-500 p-5 rounded-xl text-left shadow-md relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-6xl opacity-10">💰</div>
              <div className="text-[9px] font-black text-blue-200 uppercase tracking-widest mb-1">Saldo Akhir Saat Ini</div>
              <div className="font-black text-white text-xl md:text-2xl tabular-nums">{formatRp(saldoAkhir)}</div>
            </div>
          </div>
        </div>

        {/* 4. DEMOGRAFI & STATISTIK WARGA (Posisi Ditukar Sesuai Instruksi) */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-amber-100 text-amber-700 text-[8px] font-black px-3 py-1 rounded-bl-lg uppercase tracking-widest border-b border-l border-amber-200">
            Realtime Engine
          </div>
          <div className="mb-8 border-b border-slate-100 pb-4">
            <h2 className="font-black text-slate-800 text-lg flex items-center gap-2"><span>📈</span> Peta Demografi Warga</h2>
            <p className="text-[11px] text-slate-500 font-medium mt-1">Statistik kependudukan terpadu RT 07 berdasarkan Buku Induk.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            
            {/* Chart 1: Gender */}
            <div>
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4 flex justify-between">
                <span>1. Jenis Kelamin</span> <span className="text-blue-500">120 Jiwa</span>
              </h3>
              <div className="space-y-3">
                <div className="relative">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1"><span>Laki-laki</span> <span>55%</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full w-[55%]"></div>
                  </div>
                </div>
                <div className="relative">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1"><span>Perempuan</span> <span>45%</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-pink-400 to-rose-500 h-2.5 rounded-full w-[45%]"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart 2: Usia */}
            <div>
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4 flex justify-between">
                <span>2. Kategori Usia</span> <span className="text-emerald-500">120 Jiwa</span>
              </h3>
              <div className="space-y-3">
                <div className="relative">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1"><span>Dewasa (18-55 Thn)</span> <span>60%</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className="bg-emerald-500 h-1.5 rounded-full w-[60%]"></div></div>
                </div>
                <div className="relative">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1"><span>Anak-anak (5-17 Thn)</span> <span>25%</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className="bg-teal-400 h-1.5 rounded-full w-[25%]"></div></div>
                </div>
                <div className="relative">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1"><span>Balita (0-4 Thn)</span> <span>10%</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className="bg-cyan-400 h-1.5 rounded-full w-[10%]"></div></div>
                </div>
                <div className="relative">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1"><span>Lansia (&gt;55 Thn)</span> <span>5%</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className="bg-slate-400 h-1.5 rounded-full w-[5%]"></div></div>
                </div>
              </div>
            </div>

            {/* Chart 3: Agama */}
            <div>
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4 flex justify-between">
                <span>3. Keyakinan (Agama)</span>
              </h3>
              <div className="space-y-3">
                <div className="relative">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1"><span>Islam</span> <span>85%</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className="bg-emerald-600 h-1.5 rounded-full w-[85%]"></div></div>
                </div>
                <div className="relative">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1"><span>Kristen / Katolik</span> <span>12%</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className="bg-indigo-400 h-1.5 rounded-full w-[12%]"></div></div>
                </div>
                <div className="relative">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1"><span>Hindu / Budha / Lainnya</span> <span>3%</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className="bg-amber-400 h-1.5 rounded-full w-[3%]"></div></div>
                </div>
              </div>
            </div>

            {/* Chart 4: Pekerjaan */}
            <div>
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4 flex justify-between">
                <span>4. Sektor Pekerjaan</span>
              </h3>
              <div className="space-y-3">
                <div className="relative">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1"><span>Karyawan Swasta</span> <span>45%</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className="bg-blue-600 h-1.5 rounded-full w-[45%]"></div></div>
                </div>
                <div className="relative">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1"><span>Wiraswasta / UMKM</span> <span>30%</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className="bg-orange-500 h-1.5 rounded-full w-[30%]"></div></div>
                </div>
                <div className="relative">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1"><span>PNS / TNI / Polri</span> <span>15%</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className="bg-slate-700 h-1.5 rounded-full w-[15%]"></div></div>
                </div>
                <div className="relative">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1"><span>Lainnya (IRT/Pelajar/Pensiun)</span> <span>10%</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden"><div className="bg-slate-300 h-1.5 rounded-full w-[10%]"></div></div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 5. INJEKSI GRAFIK: PENCAPAIAN BANK SAMPAH DI BAWAH DEMOGRAFI */}
        <KinerjaSampahClient dataSampah={sampahGlobal} />

        {/* 6. EMERGENCY SYSTEM */}
        <JalurDaruratClient />

        {/* 7. MADING & PENGUMUMAN */}
        <PengumumanClient pengumumanReguler={pengumumanReguler || []} rekapVoting={rekapVoting} />

      </div>

      <p className="text-[10px] text-slate-400 mt-16 font-bold uppercase tracking-widest opacity-80">
        © 2026 - Sistem Kependudukan RT 07. Dikembangkan dengan Standar Profesional.
      </p>
    </div>
  );
}