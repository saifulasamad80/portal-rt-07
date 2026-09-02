"use client";
import { useMemo } from "react";

export default function KinerjaSampahClient({ dataSampah }: { dataSampah: any[] }) {
  const formatRp = (angka: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
  
  const formatK = (angka: number) => {
    if (angka === 0) return "Rp 0";
    return `Rp ${(angka / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  };

  const chartData = useMemo(() => {
    const data: { label: string, month: number, year: number, nominal: number, kg: number }[] = [];
    const now = new Date();
    
    // Siapkan 6 bulan terakhir
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('id-ID', { month: 'short' });
      data.push({ label, month: d.getMonth(), year: d.getFullYear(), nominal: 0, kg: 0 });
    }

    dataSampah.forEach(trx => {
      if (trx.tanggal_transaksi) {
        const trxDate = new Date(trx.tanggal_transaksi);
        const targetNode = data.find(d => d.month === trxDate.getMonth() && d.year === trxDate.getFullYear());
        if (targetNode) {
          targetNode.nominal += (trx.nominal_warga || 0) + (trx.nominal_kas_rt || 0);
          targetNode.kg += (trx.berat_kg || 0);
        }
      }
    });

    const maxDataVal = Math.max(...data.map(d => d.nominal), 0);
    const maxVal = maxDataVal === 0 ? 10000 : Math.ceil(maxDataVal / 10000) * 10000; 

    const totalKgSemua = data.reduce((sum, d) => sum + d.kg, 0);
    const totalRpSemua = data.reduce((sum, d) => sum + d.nominal, 0);

    return { data, maxVal, totalKgSemua, totalRpSemua };
  }, [dataSampah]);

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 p-6 md:p-8 relative overflow-hidden group/wrapper">
      
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-50 pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative z-10">
        <div>
          <h2 className="font-black text-slate-800 text-xl md:text-2xl tracking-tight flex items-center gap-2">
            <span className="text-emerald-500">♻️</span> Pencapaian Bank Sampah RT 07
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-2">Akumulasi total limbah anorganik yang berhasil didaur ulang warga (6 Bulan Terakhir)</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="bg-white px-4 py-3 rounded-lg border border-emerald-200 flex flex-col flex-1 md:min-w-[130px] shadow-sm">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Total Didaur Ulang</span>
            <span className="font-black text-emerald-600 text-lg md:text-xl tabular-nums">{chartData.totalKgSemua.toFixed(1)} <span className="text-xs text-emerald-500">Kg</span></span>
          </div>
          <div className="bg-white px-4 py-3 rounded-lg border border-blue-200 flex flex-col flex-1 md:min-w-[130px] shadow-sm">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Total Valuasi</span>
            <span className="font-black text-blue-600 text-lg md:text-xl tabular-nums">{formatRp(chartData.totalRpSemua)}</span>
          </div>
        </div>
      </div>

      {/* STRUKTUR GRAFIK BARU (TERPISAH DAN PERMANEN) */}
      <div className="flex h-64 w-full mt-8 z-10 pb-6">
        
        {/* Sumbu Y (Angka Rupiah & Garis Vertikal) */}
        <div className="flex flex-col justify-between items-end pr-4 py-0 border-r border-slate-300 text-[10px] font-bold text-slate-400 w-16 shrink-0 bg-white z-20">
          {[chartData.maxVal, chartData.maxVal * 0.75, chartData.maxVal * 0.5, chartData.maxVal * 0.25, 0].map((val, i) => (
            <span key={i} className="leading-none transform translate-y-1.5">{formatK(val)}</span>
          ))}
        </div>

        {/* Kanvas Grafik & Sumbu X */}
        <div className="relative flex-1 border-b border-slate-300">
          
          {/* Garis Latar Horizontal (Grid Lines) */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[1, 2, 3, 4, 5].map((_, i) => (
              <div key={i} className={`w-full border-t ${i === 4 ? 'border-transparent' : 'border-slate-100'}`}></div>
            ))}
          </div>

          {/* Tempat Penanaman Tiang */}
          <div className="absolute inset-0 flex justify-around items-end z-10">
            {chartData.data.map((item, idx) => {
              // Minimal tinggi agar garis tiang bulan bersaldo 0 tidak menghilang
              const heightPct = item.nominal === 0 ? 0 : Math.max((item.nominal / chartData.maxVal) * 100, 2);
              const isAktif = item.nominal > 0;

              return (
                <div key={idx} className="relative h-full w-full flex justify-center group">
                  
                  {/* Tiang Utama dengan Posisi Absolute Bottom */}
                  <div
                    className={`absolute bottom-0 w-8 md:w-12 rounded-t-sm transition-all duration-1000 ease-out 
                    ${isAktif ? 'bg-gradient-to-t from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.2)]' : 'bg-transparent'}`}
                    style={{ height: `${heightPct}%` }}
                  >
                    {/* LABEL PERMANEN (Tidak Perlu Hover) */}
                    {isAktif && (
                      <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-sm rounded flex flex-col items-center px-2 py-1 z-20 pointer-events-none">
                        <span className="text-[10px] font-black text-slate-800 whitespace-nowrap">{formatRp(item.nominal)}</span>
                        <span className="text-[8px] font-bold text-slate-500 whitespace-nowrap">{item.kg.toFixed(1)} Kg</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Label Sumbu X (Nama Bulan di bawah garis) */}
                  <div className="absolute -bottom-6 w-full text-center">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isAktif ? 'text-slate-800' : 'text-slate-400'}`}>
                      {item.label}
                    </span>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}