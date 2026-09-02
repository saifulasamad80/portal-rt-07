"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function SampahClient({ wargaAktif, saldo, totalKg, riwayatKiloan, riwayatRakBin, aksiLaporLimbah }: { wargaAktif: any, saldo: number, totalKg: number, riwayatKiloan: any[], riwayatRakBin: any[], aksiLaporLimbah: any }) {
  const router = useRouter();
  const [tabAktif, setTabAktif] = useState("kiloan"); 
  const [isFormOpen, setIsFormOpen] = useState(false); 
  const [loading, setLoading] = useState(false);

  const [namaBarang, setNamaBarang] = useState("");
  const [kategori, setKategori] = useState("Elektronik");
  const [opsiTujuan, setOpsiTujuan] = useState("Hibah ke RT");
  const [deskripsi, setDeskripsi] = useState("");
  const [isSetuju, setIsSetuju] = useState(false);

  const formatRp = (angka: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
  const formatWA = (nomor: string) => { if (!nomor) return ""; let bersih = nomor.replace(/\D/g, ''); if (bersih.startsWith('0')) bersih = '62' + bersih.slice(1); return bersih; };

  // ------------------------------------------------------------------
  // CHART.JS ENGINE
  // ------------------------------------------------------------------
  const chartDataRaw = useMemo(() => {
    const data: { label: string, setor: number }[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('id-ID', { month: 'short' }).toUpperCase();
      data.push({ label, setor: 0 });
    }

    riwayatKiloan.forEach(trx => {
      if (trx.jenis_transaksi === 'Setor') {
        const trxDate = new Date(trx.tanggal_transaksi);
        const labelBulan = trxDate.toLocaleDateString('id-ID', { month: 'short' }).toUpperCase();
        const targetNode = data.find(d => d.label === labelBulan);
        if (targetNode) targetNode.setor += trx.nominal_warga;
      }
    });

    return data;
  }, [riwayatKiloan]);

  // Warna-warni Tiang Sesuai Request
  const bgColors = ['#38bdf8', '#fbbf24', '#84cc16', '#fb923c', '#14b8a6', '#f43f5e'];

  const chartData = {
    labels: chartDataRaw.map(d => d.label),
    datasets: [
      {
        label: 'Pemasukan Warga (Rp)',
        data: chartDataRaw.map(d => d.setor),
        backgroundColor: bgColors,
        borderColor: bgColors,
        borderWidth: 1,
        borderRadius: 4,
        barThickness: 35,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: '#64748b',
        bodyColor: '#0f172a',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        titleFont: { size: 11 },
        bodyFont: { size: 14, weight: 'bold' as const },
        padding: 10,
        displayColors: false,
        callbacks: {
          label: function (context: any) { return formatRp(context.raw); }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: {
          color: '#64748b', font: { size: 11, weight: 'bold' as const },
          callback: function(value: any) {
            if (value === 0) return 'Rp 0';
            return `Rp ${value / 1000}k`;
          }
        }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#475569', font: { size: 11, weight: 'bold' as const } }
      }
    }
  };
  // ------------------------------------------------------------------

  const handleLapor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSetuju) return alert("Anda harus mencentang Surat Pernyataan Digital!");
    
    setLoading(true);
    try {
      await aksiLaporLimbah({ nama_barang: namaBarang, kategori, opsi_tujuan: opsiTujuan, deskripsi });
      alert("Sempurna! Barang berhasil masuk antrean Rak Bin RT.");
      setIsFormOpen(false);
      setNamaBarang(""); setDeskripsi(""); setIsSetuju(false);
      router.refresh();
    } catch (error: any) { alert("Gagal melapor: " + error.message); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans relative">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center hover:bg-slate-200 font-black transition-colors active:scale-90">←</Link>
            <div><h1 className="font-black text-slate-800 text-lg leading-tight">Sirkular Ekonomi</h1><p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Bank Sampah & Rak Bin</p></div>
          </div>
          <div className="text-2xl">♻️</div>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 mt-2">
        
        <div className="bg-slate-200 p-1.5 rounded-xl flex gap-1 shadow-inner">
          <button onClick={() => setTabAktif("kiloan")} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${tabAktif === 'kiloan' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>⚖️ Kiloan</button>
          <button onClick={() => setTabAktif("ekonomis")} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${tabAktif === 'ekonomis' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>📺 Rak Bin</button>
        </div>

        {tabAktif === "kiloan" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
             <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-2xl p-6 shadow-lg text-white relative overflow-hidden">
              <div className="absolute -right-4 -top-8 text-8xl opacity-10">🌿</div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
                <div><p className="text-emerald-100 text-[10px] font-black uppercase tracking-widest mb-1">Total Saldo Ditimbang</p><h2 className="text-4xl font-black tabular-nums tracking-tight">{formatRp(saldo)}</h2></div>
                <div className="bg-black/20 backdrop-blur p-4 rounded-xl border border-white/10 text-center min-w-[120px]"><p className="text-emerald-100 text-[9px] font-black uppercase tracking-widest mb-1">Total Disetor</p><div className="text-xl font-black text-white">{totalKg.toFixed(1)} <span className="text-sm">Kg</span></div></div>
              </div>
            </div>

            {/* CHART.JS RENDER AREA */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <div className="text-center mb-8">
                <h3 className="font-black text-slate-800 text-lg">Statistik Pemasukan (6 Bulan)</h3>
                <p className="text-xs text-slate-500 mt-1">Pemasukan Pribadi Anda</p>
              </div>
              <div className="relative h-[250px] w-full">
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-black text-slate-800 text-sm mb-4 uppercase tracking-widest flex items-center gap-2"><span>💡</span> Cara Menabung Sampah</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start gap-3">
                  <div className="text-2xl">🗑️</div>
                  <div><h4 className="text-[11px] font-black text-emerald-800 uppercase tracking-wide">1. Pilah di Rumah</h4><p className="text-[10px] text-emerald-700 mt-1 font-medium leading-relaxed">Pisahkan plastik, kertas/kardus, dan logam dari sampah basah.</p></div>
                </div>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                  <div className="text-2xl">⚖️</div>
                  <div><h4 className="text-[11px] font-black text-blue-800 uppercase tracking-wide">2. Timbang di Pos</h4><p className="text-[10px] text-blue-700 mt-1 font-medium leading-relaxed">Bawa ke Pos RT pada jadwal operasional untuk ditimbang oleh Admin.</p></div>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-3">
                  <div className="text-2xl">💰</div>
                  <div><h4 className="text-[11px] font-black text-amber-800 uppercase tracking-wide">3. Saldo Bertambah</h4><p className="text-[10px] text-amber-700 mt-1 font-medium leading-relaxed">Harga disesuaikan dengan nilai aktual pengepul pada hari tersebut.</p></div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50"><h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">🧾 Riwayat Kiloan</h3></div>
              <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar">
                {riwayatKiloan.length === 0 ? <div className="p-8 text-center text-slate-400 font-bold italic">Belum ada aktivitas tabungan sampah.</div> : 
                  riwayatKiloan.map((trx, idx) => (
                    <div key={idx} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 shadow-inner ${trx.jenis_transaksi === 'Tarik' ? 'bg-rose-100 text-rose-500' : 'bg-emerald-100 text-emerald-500'}`}>{trx.jenis_transaksi === 'Tarik' ? '💸' : '⚖️'}</div>
                        <div><h4 className="font-bold text-slate-800 text-xs">{trx.keterangan || 'Setoran Umum'}</h4><p className="text-[9px] text-slate-500 font-bold mt-1 uppercase tracking-wider">{new Date(trx.tanggal_transaksi).toLocaleDateString('id-ID')} {trx.berat_kg ? `• ${trx.berat_kg} Kg` : ''}</p></div>
                      </div>
                      <div className={`font-black text-sm tabular-nums ${trx.jenis_transaksi === 'Tarik' ? 'text-rose-600' : 'text-emerald-600'}`}>{trx.jenis_transaksi === 'Tarik' ? '-' : '+'}{formatRp(trx.nominal_warga)}</div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {tabAktif === "ekonomis" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl flex items-start gap-4">
              <div className="text-3xl">🗄️</div>
              <div>
                <h3 className="font-black text-indigo-900 text-sm mb-1 uppercase tracking-widest">Pusat Limbah Ekonomis (Rak Bin)</h3>
                <p className="text-xs text-indigo-700 font-medium leading-relaxed">Laporkan elektronik rusak/furnitur bekas. <strong>Perbaiki lewat UMKM Warga</strong> atau biarkan RT yang menghibahkan/menjualnya.</p>
                <button onClick={() => setIsFormOpen(true)} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] px-5 py-2.5 rounded-lg uppercase tracking-widest transition-all shadow-md active:scale-95">📝 Laporkan Barang</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50"><h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Status Barang Saya</h3></div>
              <div className="divide-y divide-slate-100">
                {riwayatRakBin.length === 0 ? <div className="p-8 text-center text-slate-400 font-bold italic">Anda belum pernah melaporkan barang ke Rak Bin.</div> : 
                  riwayatRakBin.map((item) => (
                    <div key={item.id} className="p-5 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div><span className="bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-slate-200">{item.kategori}</span><h4 className="font-black text-slate-800 text-sm mt-2">{item.nama_barang}</h4></div>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${item.opsi_tujuan.includes('Hibah') ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : item.opsi_tujuan.includes('Jual') ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>{item.opsi_tujuan}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-3 flex justify-between items-center">
                        <div><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Status Saat Ini</p><p className="text-xs font-bold text-indigo-700">{item.status}</p></div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">PIC / Teknisi UMKM</p>
                          {item.lapak_warga ? (
                            <a href={`https://wa.me/${formatWA(item.lapak_warga.nomor_wa)}`} target="_blank" className="text-[10px] font-bold text-blue-600 hover:underline">📞 {item.lapak_warga.nama_usaha}</a>
                          ) : (
                            <p className="text-xs font-bold text-slate-400">Belum Ada</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsFormOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 bg-indigo-600 text-white flex justify-between items-center shrink-0"><h3 className="font-black text-sm uppercase tracking-widest">📝 Form Barang Rak Bin</h3><button onClick={() => setIsFormOpen(false)} className="text-white font-black text-xl hover:text-indigo-200 transition-colors">×</button></div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <form id="formRakBin" onSubmit={handleLapor}>
                <div className="mb-4"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Nama Barang</label><input type="text" required placeholder="Cth: Kulkas 1 Pintu" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all" value={namaBarang} onChange={e => setNamaBarang(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Kategori</label><select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500" value={kategori} onChange={e => setKategori(e.target.value)}><option>Elektronik</option><option>Furnitur</option><option>Otomotif/Sepeda</option><option>Pakaian/Kain</option></select></div>
                  <div><label className="block text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">Opsi Target Anda</label><select className="w-full bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm font-black text-rose-700 outline-none focus:border-rose-500" value={opsiTujuan} onChange={e => setOpsiTujuan(e.target.value)}><option>Hibah ke RT</option><option>Jual via RT (Konsinyasi)</option><option>Reparasi (Via UMKM Warga)</option></select></div>
                </div>
                <div className="mb-4"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Kerusakan / Kondisi</label><textarea required rows={2} placeholder="Sebutkan minusnya..." className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500" value={deskripsi} onChange={e => setDeskripsi(e.target.value)}></textarea></div>
                
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" required checked={isSetuju} onChange={e => setIsSetuju(e.target.checked)} className="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                    <div className="text-xs text-amber-900 leading-relaxed font-medium"><strong>SURAT PERNYATAAN:</strong> Dengan ini saya sadar dan setuju menyerahkan barang di atas ke Ekosistem RT 07. Jika opsi "Jual/Reparasi" dipilih, saya patuh pada potongan Admin RT.</div>
                  </label>
                </div>
              </form>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3 shrink-0">
              <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 font-black text-xs py-3 rounded-lg uppercase tracking-widest transition-colors">Batal</button>
              <button type="submit" form="formRakBin" disabled={loading || !isSetuju} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs py-3 rounded-lg uppercase tracking-widest shadow-md disabled:bg-slate-300 disabled:shadow-none transition-all active:scale-95">Submit Laporan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}