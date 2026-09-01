"use client";
import { useMemo } from "react";

export default function KinerjaSampahClient({ dataSampah }: { dataSampah: any[] }) {
  const formatRp = (angka: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
  const formatK = (angka: number) => {
    if (angka === 0) return "Rp 0";
    return `Rp ${(angka / 1000).toFixed(0)}k`;
  };

  // MESIN KALKULASI GANDA (Rupiah & KG) - 6 Bulan Terakhir
  const chartData = useMemo(() => {
    const data: { label: string, month: number, year: number, nominal: number, kg: number }[] = [];
    const now = new Date();
    
    // Siapkan 6 slot bulan ke belakang
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('id-ID', { month: 'short' });
      data.push({ label, month: d.getMonth(), year: d.getFullYear(), nominal: 0, kg: 0 });
    }

    // Mapping seluruh data sampah warga se-RT
    dataSampah.forEach(trx => {
      if (trx.tanggal_transaksi) {
        const trxDate = new Date(trx.tanggal_transaksi);
        const targetNode = data.find(d => d.month === trxDate.getMonth() && d.year === trxDate.getFullYear());
        if (targetNode) {
          // Nominal dihitung kotor (Hak Warga + Fee RT)
          targetNode.nominal += (trx.nominal_warga || 0) + (trx.nominal_kas_rt || 0);
          targetNode.kg += (trx.berat_kg || 0);
        }
      }
    });

    const maxVal = Math.max(...data.map(d => d.nominal), 10000); 
    const totalKgSemua = data.reduce((sum, d) => sum + d.kg, 0);
    const totalRpSemua = data.reduce((sum, d) => sum + d.nominal, 0);

    return { data, maxVal, totalKgSemua, totalRpSemua };
  }, [dataSampah]);

  // Palet Warna Silinder 3D
  const barColors = [
    "bg-gradient-to-r from-sky-400 via-sky-100 to-sky-500 border-sky-400",       
    "bg-gradient-to-r from-amber-400 via-amber-100 to-amber-500 border-amber-400", 
    "bg-gradient-to-r from-lime-500 via-lime-200 to-lime-600 border-lime-500",     
    "bg-gradient-to-r from-orange-400 via-orange-100 to-orange-500 border-orange-400", 
    "bg-gradient-to-r from-teal-500 via-teal-200 to-teal-600 border-teal-500",     
    "bg-gradient-to-r from-rose-500 via-rose-200 to-rose-600 border-rose-500"      
  ];

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-200 p-6 md:p-8 mt-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center mb-10">
        <h2 className="font-black text-slate-800 text-lg md:text-xl">Pencapaian Bank Sampah RT 07</h2>
        <p className="text-xs text-slate-500 mt-1">Akumulasi total limbah anorganik yang berhasil didaur ulang warga (6 Bulan Terakhir)</p>
        
        {/* Lencana Total */}
        <div className="flex justify-center gap-3 mt-4">
          <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200 text-[10px] md:text-xs font-black shadow-sm uppercase tracking-widest">
            Total Didaur Ulang: {chartData.totalKgSemua.toFixed(1)} Kg
          </div>
          <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200 text-[10px] md:text-xs font-black shadow-sm uppercase tracking-widest">
            Total Valuasi: {formatRp(chartData.totalRpSemua)}
          </div>
        </div>
      </div>

      <div className="flex h-64 w-full">
        <div className="flex flex-col justify-between items-end pr-3 py-6 border-r-2 border-slate-300 text-[10px] font-bold text-slate-500 w-16 shrink-0 bg-slate-50/50">
          <span>{formatK(chartData.maxVal)}</span>
          <span>{formatK(chartData.maxVal * 0.75)}</span>
          <span>{formatK(chartData.maxVal * 0.5)}</span>
          <span>{formatK(chartData.maxVal * 0.25)}</span>
          <span>Rp 0</span>
        </div>

        <div className="relative flex-1 flex justify-around items-end pl-2 md:pl-6 pb-6 border-b-2 border-slate-300">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-6 border-l-0">
            <div className="w-full border-t border-slate-200"></div>
            <div className="w-full border-t border-slate-200"></div>
            <div className="w-full border-t border-slate-200"></div>
            <div className="w-full border-t border-slate-200"></div>
            <div className="w-full border-t border-transparent"></div> 
          </div>

          {chartData.data.map((item, idx) => {
            const heightPct = item.nominal === 0 ? 0 : Math.max((item.nominal / chartData.maxVal) * 100, 2);
            const isAktif = item.nominal > 0;
            
            return (
              <div key={idx} className="relative flex flex-col items-center justify-end h-full w-full group z-10">
                <div 
                  className={`w-6 md:w-12 rounded-t-sm border shadow-[2px_0_5px_rgba(0,0,0,0.1)] transition-all duration-700 ease-out relative ${isAktif ? barColors[idx] : 'bg-slate-100 border-slate-200 shadow-none'}`}
                  style={{ height: `${heightPct}%` }}
                >
                  {isAktif && <div className="absolute inset-x-0 top-0 h-1 bg-white/60 rounded-t-sm"></div>}
                  
                  {/* INJEKSI UX GANDA: Label KG nangkring di pucuk batang */}
                  {isAktif && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-black text-slate-700 bg-white/90 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap border border-slate-200">
                      {item.kg.toFixed(1)} Kg
                    </div>
                  )}
                  
                  {/* Tooltip Nominal Uang */}
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-white border border-slate-300 text-slate-800 text-[10px] font-black px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md pointer-events-none z-20">
                    {formatRp(item.nominal)}
                  </div>
                </div>
                
                <span className={`absolute -bottom-6 text-[10px] font-bold ${isAktif ? 'text-slate-800' : 'text-slate-400'}`}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}