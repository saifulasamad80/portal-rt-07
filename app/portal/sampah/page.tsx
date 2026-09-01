"use client";
import { useState } from "react";
import Link from "next/link";

export default function PortalSampahWarga() {
  const [tabAktif, setTabAktif] = useState("kiloan"); // 'kiloan' atau 'ekonomis'

  // DATA DUMMY (Sistem Kiloan)
  const totalSaldo = 125000;
  const totalKg = 45.5;
  const katalogKiloan = [
    { ikon: "🥤", nama: "Plastik & PET", harga: "Rp 2.500/Kg", bg: "bg-blue-50", text: "text-blue-600" },
    { ikon: "📦", nama: "Kertas/Kardus", harga: "Rp 1.500/Kg", bg: "bg-amber-50", text: "text-amber-600" },
    { ikon: "🥫", nama: "Besi Rongsok", harga: "Rp 3.500/Kg", bg: "bg-slate-100", text: "text-slate-600" },
  ];

  // DATA DUMMY (Limbah Ekonomis - Rak Bin)
  const rakBinDummy = [
    { id: 1, barang: "Kulkas 1 Pintu (Rusak Kompresor)", kategori: "Elektronik", status: "Menunggu Reparasi", teknisi: "Bpk. Ahmad (Jasa Servis)", opsi: "Reparasi" },
    { id: 2, barang: "Meja Belajar Kayu", kategori: "Furnitur", status: "Tersedia di Rak Bin", teknisi: "-", opsi: "Dijual (Rp 150.000)" },
    { id: 3, barang: "Kipas Angin Berdiri", kategori: "Elektronik", status: "Selesai Dihibahkan", teknisi: "Inventaris RT", opsi: "Hibah ke RT" },
  ];

  const formatRp = (angka: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      
      {/* HEADER NAVIGASI */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal" className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors active:scale-90 font-black">
              ←
            </Link>
            <div>
              <h1 className="font-black text-slate-800 text-lg leading-tight">Sirkular Ekonomi</h1>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Bank Sampah & Rak Bin</p>
            </div>
          </div>
          <div className="text-2xl">♻️</div>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 mt-2">
        
        {/* TOGGLE TAB BENTO STYLE */}
        <div className="bg-slate-200 p-1.5 rounded-xl flex gap-1 shadow-inner">
          <button 
            onClick={() => setTabAktif("kiloan")}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${tabAktif === 'kiloan' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            ⚖️ Sampah Kiloan
          </button>
          <button 
            onClick={() => setTabAktif("ekonomis")}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${tabAktif === 'ekonomis' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            📺 Limbah Ekonomis
          </button>
        </div>

        {/* ================= TAB 1: BANK SAMPAH KILOAN ================= */}
        {tabAktif === "kiloan" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* HUD SALDO */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-2xl p-6 shadow-lg text-white relative overflow-hidden">
              <div className="absolute -right-4 -top-8 text-8xl opacity-10">🌿</div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
                <div>
                  <p className="text-emerald-100 text-[10px] font-black uppercase tracking-widest mb-1">Total Saldo Ditimbang</p>
                  <h2 className="text-4xl font-black tabular-nums tracking-tight">{formatRp(totalSaldo)}</h2>
                </div>
                <div className="bg-black/20 backdrop-blur-sm p-4 rounded-xl border border-white/10 text-center min-w-[120px]">
                  <p className="text-emerald-100 text-[9px] font-black uppercase tracking-widest mb-1">Total Disetor</p>
                  <div className="text-xl font-black text-white">{totalKg} <span className="text-sm font-medium">Kg</span></div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-black text-slate-800 text-sm mb-4 uppercase tracking-widest flex items-center gap-2">
                <span>🏷️</span> Harga Pengepul (Kiloan)
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {katalogKiloan.map((item, idx) => (
                  <div key={idx} className={`${item.bg} border border-slate-100 p-4 rounded-xl text-center`}>
                    <div className="text-2xl mb-2">{item.ikon}</div>
                    <div className="text-[10px] font-bold text-slate-700 mb-1 leading-tight">{item.nama}</div>
                    <div className={`font-black text-xs ${item.text}`}>{item.harga}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: LIMBAH EKONOMIS (RAK BIN) ================= */}
        {tabAktif === "ekonomis" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl flex items-start gap-4">
              <div className="text-3xl">🗄️</div>
              <div>
                <h3 className="font-black text-indigo-900 text-sm mb-1 uppercase tracking-widest">Sistem Rak Bin Warga</h3>
                <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                  Laporkan barang elektronik rusak atau furnitur bekas Anda. Pilih opsi: <strong>Hibahkan ke RT</strong>, <strong>Jual via RT</strong>, atau gunakan <strong>Jasa Reparasi Warga</strong>.
                </p>
                <button className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] px-5 py-2.5 rounded-lg uppercase tracking-widest transition-all active:scale-95 shadow-md">
                  + Laporkan Barang Bekas
                </button>
              </div>
            </div>

            {/* DAFTAR BARANG DI RAK BIN */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50">
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Status Barang Anda</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {rakBinDummy.map((item) => (
                  <div key={item.id} className="p-5 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-slate-200">
                          {item.kategori}
                        </span>
                        <h4 className="font-black text-slate-800 text-sm mt-2">{item.barang}</h4>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${item.opsi.includes('Hibah') ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : item.opsi.includes('Dijual') ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                        {item.opsi}
                      </span>
                    </div>
                    
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mt-3 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Status Saat Ini</p>
                        <p className="text-xs font-bold text-slate-700">{item.status}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">PIC / Teknisi</p>
                        <p className="text-xs font-bold text-indigo-600">{item.teknisi}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}