"use client";
import { useMemo, useState, useEffect } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function KinerjaSampahClient({ dataSampah }: { dataSampah: any[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const formatRp = (angka: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

  const chartData = useMemo(() => {
    const data: { label: string, nominal: number, kg: number }[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('id-ID', { month: 'short' }).toUpperCase();
      data.push({ label, nominal: 0, kg: 0 });
    }

    dataSampah.forEach(trx => {
      if (trx.tanggal_transaksi) {
        const trxDate = new Date(trx.tanggal_transaksi);
        const labelBulan = trxDate.toLocaleDateString('id-ID', { month: 'short' }).toUpperCase();
        
        const targetNode = data.find(d => d.label === labelBulan);
        if (targetNode) {
          targetNode.nominal += (trx.nominal_warga || 0) + (trx.nominal_kas_rt || 0);
          targetNode.kg += (trx.berat_kg || 0);
        }
      }
    });

    return data;
  }, [dataSampah]);

  // SKELETON LOADER (Mencegah Hydration Error)
  if (!mounted) {
    return <div className="w-full h-[400px] bg-slate-100 animate-pulse rounded-2xl border border-slate-200 mt-8"></div>;
  }

  const totalKgSemua = chartData.reduce((sum, d) => sum + d.kg, 0);
  const totalRpSemua = chartData.reduce((sum, d) => sum + d.nominal, 0);

  const data = {
    labels: chartData.map(d => d.label),
    datasets: [
      {
        label: 'Valuasi Bank Sampah',
        data: chartData.map(d => d.nominal),
        backgroundColor: '#10b981', 
        hoverBackgroundColor: '#34d399', 
        borderRadius: 8, 
        barThickness: 40, 
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }, 
      tooltip: {
        backgroundColor: '#0f172a',
        titleFont: { size: 13, family: 'sans-serif' },
        bodyFont: { size: 14, weight: 'bold' as const, family: 'sans-serif' },
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: function (context: any) {
            const index = context.dataIndex;
            const kg = chartData[index].kg.toFixed(1);
            const rp = formatRp(context.raw);
            return [`Total: ${rp}`, `Tonase: ${kg} Kg`]; 
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: '#f1f5f9', drawTicks: false }, 
        ticks: {
          color: '#94a3b8',
          font: { size: 11, weight: 'bold' as const },
          callback: function(value: any) {
            if (value === 0) return 'Rp 0';
            return `Rp ${value / 1000}k`; 
          }
        }
      },
      x: {
        border: { display: false },
        grid: { display: false }, 
        ticks: { color: '#64748b', font: { size: 11, weight: 'bold' as const } }
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 p-6 md:p-8 relative overflow-hidden group/wrapper mt-8">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-50 pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 relative z-10">
        <div>
          <h2 className="font-black text-slate-800 text-xl md:text-2xl tracking-tight flex items-center gap-2">
            <span className="text-emerald-500">♻️</span> Pencapaian Bank Sampah RT 07
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-2">Akumulasi total limbah anorganik yang berhasil didaur ulang warga (6 Bulan Terakhir)</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="bg-white px-4 py-3 rounded-lg border border-emerald-200 flex flex-col flex-1 md:min-w-[130px] shadow-sm">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Total Didaur Ulang</span>
            <span className="font-black text-emerald-600 text-lg md:text-xl tabular-nums">{totalKgSemua.toFixed(1)} <span className="text-xs text-emerald-500">Kg</span></span>
          </div>
          <div className="bg-white px-4 py-3 rounded-lg border border-blue-200 flex flex-col flex-1 md:min-w-[130px] shadow-sm">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Total Valuasi</span>
            <span className="font-black text-blue-600 text-lg md:text-xl tabular-nums">{formatRp(totalRpSemua)}</span>
          </div>
        </div>
      </div>

      <div className="relative h-[300px] w-full z-10">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}