"use client";
import { useState } from "react";

export default function JalurDaruratClient() {
  const [showPanic, setShowPanic] = useState(false);

  const handleCCTV = () => {
    // ANTI-HALUSINASI: Fitur sementara sampai lu punya backend & link CCTV asli
    const pin = prompt("🔒 AKSES TERKUNCI\n\nMasukkan PIN CCTV (Silakan request ke Pak RT terlebih dahulu):");
    
    if (pin) {
      alert("Verifikasi gagal atau link CCTV belum diatur oleh sistem pengurus.");
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      
      {/* Header & Tombol Utama */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="text-4xl animate-pulse">🚨</div>
          <div>
            <h3 className="font-black text-slate-800 text-sm mb-1">Jalur Darurat & Keamanan</h3>
            <p className="text-xs text-slate-500 font-medium">Akses langsung ke fasilitas keamanan lingkungan.</p>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowPanic(!showPanic)}
            className="flex-1 md:flex-none bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs py-3 px-5 rounded-lg flex items-center justify-center gap-2 transition-colors border border-rose-200 shadow-sm"
          >
            <span className="text-rose-500">📞</span> Panic Button
          </button>
          <button
            onClick={handleCCTV}
            className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-3 px-5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <span className="text-slate-400">📹</span> Buka CCTV
          </button>
        </div>
      </div>

      {/* Ekspansi Grid Tombol (Muncul saat Panic Button diklik) */}
      {showPanic && (
        <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4">
          <a href="tel:110" className="bg-blue-50 border border-blue-200 hover:border-blue-400 p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all hover:-translate-y-0.5 shadow-sm">
            <span className="text-3xl mb-2">👮</span>
            <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider">Polisi</span>
            <span className="text-xs font-bold text-blue-600 mt-1">110</span>
          </a>
          <a href="tel:113" className="bg-rose-50 border border-rose-200 hover:border-rose-400 p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all hover:-translate-y-0.5 shadow-sm">
            <span className="text-3xl mb-2">🚒</span>
            <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider">Damkar</span>
            <span className="text-xs font-bold text-rose-600 mt-1">113</span>
          </a>
          <a href="tel:118" className="bg-emerald-50 border border-emerald-200 hover:border-emerald-400 p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all hover:-translate-y-0.5 shadow-sm">
            <span className="text-3xl mb-2">🚑</span>
            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Ambulan</span>
            <span className="text-xs font-bold text-emerald-600 mt-1">118</span>
          </a>
          <a href="tel:MASUKKAN_NOMOR_RT_DISINI" className="bg-slate-50 border border-slate-200 hover:border-slate-400 p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all hover:-translate-y-0.5 shadow-sm">
            <span className="text-3xl mb-2">👔</span>
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Pak RT</span>
            <span className="text-xs font-bold text-slate-500 mt-1">Hubungi</span>
          </a>
        </div>
      )}
    </div>
  );
}