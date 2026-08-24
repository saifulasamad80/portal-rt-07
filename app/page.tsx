import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function LandingPage() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // FAKTA: Limit diubah jadi 7 agar konsep "Galeri" terpenuhi
  const { data: pengumumanReguler } = await supabase
    .from("pengumuman_rt")
    .select("*")
    .order("tanggal_publikasi", { ascending: false })
    .limit(7);

  const { data: votingTerbaru } = await supabase
    .from("voting_rt")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

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

  const { data: kasData } = await supabase.from("kas_rt").select("tipe_transaksi, nominal");
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

      <div className="w-full max-w-4xl space-y-5">
        
        {/* PAPAN PENGUMUMAN WARGA (KONSEP GRID/GALERI KOTAK) */}
        <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-slate-200 border-t-[5px] border-t-amber-500">
          <h2 className="font-black text-slate-800 text-sm flex items-center justify-center gap-2 mb-5">📢 Pengumuman & Galeri Warga</h2>
          
          {/* FAKTA: Grid 2 kolom di HP, 4 kolom di Laptop. Sesuai sketsa lu! */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            
            {/* KOTAK 1: HASIL VOTING (DIPRESS MENJADI BENTUK KOTAK PERSEGI) */}
            {rekapVoting && (
              <div className={`aspect-square ${rekapVoting.status === 'Aktif' ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-400' : 'bg-indigo-50 border-indigo-200 hover:border-indigo-400'} border p-3 rounded-xl shadow-sm flex flex-col justify-between transition-colors relative overflow-hidden group`}>
                
                <div className="absolute top-0 left-0 w-full text-center py-1 bg-white/50 backdrop-blur-sm border-b border-white/40">
                  <span className={`${rekapVoting.status === 'Aktif' ? 'text-emerald-700 animate-pulse' : 'text-indigo-700'} text-[8px] font-black uppercase tracking-widest`}>
                    {rekapVoting.status === 'Aktif' ? 'Pemilihan' : 'Ditetapkan'}
                  </span>
                </div>

                <div className="mt-5 text-center px-1">
                  <h3 className={`font-black text-[10px] md:text-xs leading-tight ${rekapVoting.status === 'Aktif' ? 'text-emerald-900' : 'text-indigo-900'} line-clamp-2`}>
                    {rekapVoting.judul}
                  </h3>
                </div>
                
                <div className="space-y-1.5 w-full">
                  <div>
                    <div className="flex justify-between text-[8px] font-bold text-slate-700 mb-0.5 px-1">
                      <span className="truncate pr-1">{rekapVoting.opsi_1}</span>
                      <span>{rekapVoting.statistik.opsi_1_pct}%</span>
                    </div>
                    <div className={`w-full ${rekapVoting.status === 'Aktif' ? 'bg-emerald-100' : 'bg-indigo-100'} rounded-full h-1`}>
                      <div className={`${rekapVoting.status === 'Aktif' ? 'bg-emerald-500' : 'bg-indigo-500'} h-1 rounded-full transition-all`} style={{ width: `${rekapVoting.statistik.opsi_1_pct}%` }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[8px] font-bold text-slate-700 mb-0.5 px-1">
                      <span className="truncate pr-1">{rekapVoting.opsi_2}</span>
                      <span>{rekapVoting.statistik.opsi_2_pct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1">
                      <div className="bg-slate-500 h-1 rounded-full transition-all" style={{ width: `${rekapVoting.statistik.opsi_2_pct}%` }}></div>
                    </div>
                  </div>
                </div>
                
                <div className="text-center mt-1">
                  {rekapVoting.status === 'Aktif' ? (
                    <Link href="/login" className="text-[8px] font-black text-emerald-700 underline decoration-emerald-300">
                      Login & Pilih
                    </Link>
                  ) : (
                    <span className="text-[8px] text-slate-500 font-bold">{rekapVoting.statistik.total} Suara</span> 
                  )}
                </div>
              </div>
            )}

            {/* KOTAK 2-N: PENGUMUMAN REGULER (DIPRESS JADI ICON-CENTRIC SEPERTI REQUEST LU) */}
            {pengumumanReguler && pengumumanReguler.length > 0 && pengumumanReguler.map((p) => (
              <a 
                key={p.id} 
                href={p.link_dokumen || "#"} 
                target={p.link_dokumen ? "_blank" : "_self"} 
                rel="noopener noreferrer"
                className="aspect-square bg-white border border-slate-200 p-3 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col items-center justify-center text-center cursor-pointer group"
              >
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xl md:text-2xl mb-2 group-hover:scale-110 transition-transform">
                  {p.link_dokumen?.includes("drive.google.com") ? '📂' : p.link_dokumen ? '🔗' : '📄'}
                </div>
                <h3 className="font-bold text-slate-800 text-[10px] md:text-[11px] leading-tight line-clamp-2 px-1">
                  {p.judul}
                </h3>
                <span className="text-[7px] text-slate-400 font-bold mt-2 uppercase tracking-widest">
                  {new Date(p.tanggal_publikasi).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                </span>
              </a>
            ))}

            {!rekapVoting && (!pengumumanReguler || pengumumanReguler.length === 0) && (
              <div className="col-span-2 md:col-span-4 text-center text-xs text-slate-400 font-bold italic py-8 border border-dashed border-slate-200 rounded-lg">
                Belum ada galeri informasi terbaru.
              </div>
            )}
          </div>
        </div>

        {/* TRANSPARANSI KAS RT 07 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-t-[5px] border-t-blue-600">
          <h2 className="font-black text-slate-800 text-sm text-center mb-1">Transparansi Kas RT 07</h2>
          <p className="text-[10px] text-slate-400 text-center font-bold mb-5">Rekapitulasi keuangan lingkungan secara real-time.</p>
          
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <div className="bg-emerald-50 border border-emerald-100 p-3 md:p-4 rounded-xl text-center shadow-sm">
              <div className="text-[8px] md:text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1.5">Total Pemasukan</div>
              <div className="font-black text-emerald-600 text-sm md:text-xl">{formatRp(pemasukan)}</div>
            </div>
            <div className="bg-rose-50 border border-rose-100 p-3 md:p-4 rounded-xl text-center shadow-sm">
              <div className="text-[8px] md:text-[9px] font-black text-rose-600 uppercase tracking-widest mb-1.5">Total Pengeluaran</div>
              <div className="font-black text-rose-600 text-sm md:text-xl">{formatRp(pengeluaran)}</div>
            </div>
            <div className="bg-blue-50 border border-blue-100 p-3 md:p-4 rounded-xl text-center shadow-sm">
              <div className="text-[8px] md:text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1.5">Saldo Akhir Kas</div>
              <div className="font-black text-blue-600 text-sm md:text-xl">{formatRp(saldoAkhir)}</div>
            </div>
          </div>
        </div>

        {/* JALUR DARURAT & KEAMANAN */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-rose-200 flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden border-l-[6px] border-l-rose-500">
          <div className="flex items-center gap-4">
            <div className="text-4xl animate-pulse">🚨</div>
            <div>
              <h3 className="font-black text-slate-800 text-sm mb-0.5">Jalur Darurat & Keamanan</h3>
              <p className="text-[10px] text-slate-500 font-bold">Akses langsung ke fasilitas keamanan lingkungan.</p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button className="flex-1 md:flex-none bg-rose-100 hover:bg-rose-200 text-rose-700 font-black text-[10px] py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors border border-rose-200 shadow-sm"><span className="text-rose-500">📞</span> Panic Button</button>
            <button className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-900 text-white font-black text-[10px] py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"><span className="text-slate-400">📹</span> Buka CCTV</button>
          </div>
        </div>

        {/* LOGIN CARDS PORTAL & ADMIN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center flex flex-col hover:border-blue-300 transition-colors">
            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-5">👤</div>
            <h3 className="font-black text-slate-800 text-base mb-2">Portal Warga</h3>
            <p className="text-[10px] text-slate-500 mb-8 flex-1 leading-relaxed px-2">Cek tagihan iuran, cetak surat pengantar, lapor kejadian darurat, dan ikut serta dalam e-voting RT.</p>
            <Link href="/login" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-lg text-xs transition-colors block shadow-md">Masuk Portal Warga</Link>
          </div>
          
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center flex flex-col hover:border-emerald-300 transition-colors">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-5">🏛️</div>
            <h3 className="font-black text-slate-800 text-base mb-2">Pengurus RT</h3>
            <p className="text-[10px] text-slate-500 mb-8 flex-1 leading-relaxed px-2">Pusat komando admin untuk validasi warga baru, akses buku induk demografi, dan manajemen informasi lingkungan.</p>
            <Link href="/admin" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-lg text-xs transition-colors block shadow-md">Masuk Dasbor Admin</Link>
          </div>
        </div>

      </div>

      <p className="text-[9px] text-slate-400 mt-12 font-black uppercase tracking-widest opacity-80">© 2026 - Sistem Manajemen RT 07.</p>
    </div>
  );
}