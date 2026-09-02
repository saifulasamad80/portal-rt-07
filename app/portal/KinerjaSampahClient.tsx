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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 relative z-10">
        <div>
          <h2 className="font-black text-slate-800 text-xl md:text-2xl tracking-tight flex items-center gap-2">
            <span className="text-emerald-500">♻️</span> Kinerja Sirkular Ekonomi
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-2">Valuasi & Tonase Bank Sampah RT 07 (6 Bulan Terakhir)</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 flex flex-col flex-1 md:min-w-[130px] transition-colors hover:bg-emerald-50 hover:border-emerald-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Tonase</span>
            <span className="font-black text-emerald-600 text-lg md:text-xl tabular-nums">{chartData.totalKgSemua.toFixed(1)} <span className="text-xs text-slate-500">Kg</span></span>
          </div>
          <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 flex flex-col flex-1 md:min-w-[130px] transition-colors hover:bg-blue-50 hover:border-blue-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Valuasi Kotor</span>
            <span className="font-black text-blue-600 text-lg md:text-xl tabular-nums">{formatRp(chartData.totalRpSemua)}</span>
          </div>
        </div>
      </div>

      <div className="relative h-64 w-full mt-4 z-10">
        
        {/* Wadah Garis Grid Sumbu Y */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
          {[chartData.maxVal, chartData.maxVal * 0.75, chartData.maxVal * 0.5, chartData.maxVal * 0.25, 0].map((val, i) => (
            <div key={i} className="flex items-center w-full gap-4 opacity-70 h-0">
              <span className="text-[10px] font-bold text-slate-400 w-10 text-right shrink-0">{formatK(val)}</span>
              <div className={`w-full border-t ${i === 4 ? 'border-solid border-slate-300' : 'border-dashed border-slate-200'}`}></div>
            </div>
          ))}
        </div>

        {/* Wadah Tiang Grafik Sumbu X */}
        <div className="absolute inset-0 flex justify-between items-end pl-14 pr-2 md:pr-8 z-10 pb-6">
          {chartData.data.map((item, idx) => {
            // Minimal tinggi 2% biar garis tiang tetap keliatan walau kecil banget
            const heightPct = item.nominal === 0 ? 0 : Math.max((item.nominal / chartData.maxVal) * 100, 2);
            const isAktif = item.nominal > 0;

            return (
              // Cell untuk 1 bulan (Tinggi full dari garis 0 sampai atas)
              <div key={idx} className="relative h-full w-full group">
                
                {/* Ghost Area untuk deteksi Hover (Lebar) */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 md:w-16 h-full bg-transparent group-hover:bg-slate-50/60 rounded-t-xl transition-colors cursor-pointer"></div>

                {/* FIX MUTLAK: Tiang Utama menggunakan ABSOLUTE BOTTOM-0 agar tidak amblas */}
                <div
                  className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-8 md:w-12 rounded-t-lg transition-all duration-1000 ease-out pointer-events-none
                  ${isAktif ? 'bg-gradient-to-t from-emerald-500 to-teal-400 shadow-[0_4px_15px_rgba(20,184,166,0.3)] group-hover:from-emerald-400 group-hover:to-teal-300 group-hover:shadow-[0_4px_20px_rgba(20,184,166,0.5)]' : 'bg-transparent'}`}
                  style={{ height: `${heightPct}%` }}
                >
                  {/* Label KG (Nangkring di pucuk tiang) */}
                  {isAktif && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-black text-slate-600 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded shadow-sm border border-slate-100 transition-transform duration-300 group-hover:-translate-y-1">
                      {item.kg.toFixed(1)} Kg
                    </div>
                  )}

                  {/* Tooltip Nominal Uang (Pop-up saat di-hover) */}
                  {isAktif && (
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-black px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-xl whitespace-nowrap z-20 pointer-events-none transform translate-y-2 group-hover:translate-y-0">
                      {formatRp(item.nominal)}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-900 rotate-45"></div>
                    </div>
                  )}
                </div>
                
                {/* Label Sumbu X (Nama Bulan) */}
                <div className="absolute -bottom-6 w-full text-center">
                  <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isAktif ? 'text-slate-800' : 'text-slate-400 group-hover:text-slate-600'}`}>
                    {item.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}