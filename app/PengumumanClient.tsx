"use client";
import { useState } from "react";
import Link from "next/link";

export default function PengumumanClient({ pengumumanReguler, rekapVoting }: { pengumumanReguler: any[], rekapVoting: any }) {
  const [modalData, setModalData] = useState<any>(null);

  return (
    // REFACTOR: Shadow dihaluskan ala Tailwind UI
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative h-full">
      {/* REFACTOR: Judul difokuskan HANYA untuk Pengumuman */}
      <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-3">
        <h2 className="font-black text-slate-800 text-sm tracking-wide">📢 Pengumuman Resmi</h2>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pusat Informasi</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {rekapVoting && (
          <div className={`aspect-square ${rekapVoting.status === 'Aktif' ? 'bg-emerald-50 border-emerald-200' : 'bg-indigo-50 border-indigo-200'} border p-4 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden`}>
            <div className="absolute top-0 left-0 w-full text-center py-1 bg-white/60 backdrop-blur-md border-b border-white/40">
              <span className={`${rekapVoting.status === 'Aktif' ? 'text-emerald-700 animate-pulse' : 'text-indigo-700'} text-[9px] font-black uppercase tracking-widest`}>
                {rekapVoting.status === 'Aktif' ? 'Pemilihan' : 'Ditetapkan'}
              </span>
            </div>

            <div className="mt-6 text-center">
              <h3 className={`font-black text-[11px] leading-tight ${rekapVoting.status === 'Aktif' ? 'text-emerald-900' : 'text-indigo-900'} line-clamp-2`}>
                {rekapVoting.judul}
              </h3>
            </div>

            <div className="space-y-2 w-full mt-2">
              <div>
                <div className="flex justify-between text-[9px] font-bold text-slate-700 mb-1">
                  <span className="truncate pr-1">{rekapVoting.opsi_1}</span>
                  <span>{rekapVoting.statistik.opsi_1_pct}%</span>
                </div>
                <div className={`w-full ${rekapVoting.status === 'Aktif' ? 'bg-emerald-100' : 'bg-indigo-100'} rounded-full h-1.5`}>
                  <div className={`${rekapVoting.status === 'Aktif' ? 'bg-emerald-500' : 'bg-indigo-500'} h-1.5 rounded-full transition-all duration-1000`} style={{ width: `${rekapVoting.statistik.opsi_1_pct}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[9px] font-bold text-slate-700 mb-1">
                  <span className="truncate pr-1">{rekapVoting.opsi_2}</span>
                  <span>{rekapVoting.statistik.opsi_2_pct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className="bg-slate-400 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${rekapVoting.statistik.opsi_2_pct}%` }}></div>
                </div>
              </div>
            </div>

            <div className="text-center mt-2">
              {rekapVoting.status === 'Aktif' ? (
                <Link href="/login" className="text-[9px] font-black text-emerald-700 hover:text-emerald-800 underline decoration-emerald-300 transition-colors">
                  Login & Pilih
                </Link>
              ) : (
                <span className="text-[9px] text-slate-500 font-bold">{rekapVoting.statistik.total} Suara</span> 
              )}
            </div>
          </div>
        )}

        {pengumumanReguler && pengumumanReguler.length > 0 && pengumumanReguler.map((p) => (
          <div 
            key={p.id} 
            onClick={() => setModalData(p)}
            className="aspect-square bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer group"
          >
            <div className="w-10 h-10 bg-slate-50 text-blue-600 rounded-full flex items-center justify-center text-xl mb-3 group-hover:scale-110 group-hover:bg-white shadow-sm transition-transform duration-200">
              {p.link_dokumen?.includes("drive.google.com") ? '📂' : p.link_dokumen ? '🔗' : '📄'}
            </div>
            <h3 className="font-bold text-slate-800 text-[10px] leading-snug line-clamp-2 px-1 group-hover:text-blue-700">
              {p.judul}
            </h3>
            <span className="text-[8px] text-slate-400 font-bold mt-auto pt-2 uppercase tracking-widest" suppressHydrationWarning>
              {new Date(p.tanggal_publikasi).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
            </span>
          </div>
        ))}

        {!rekapVoting && (!pengumumanReguler || pengumumanReguler.length === 0) && (
          <div className="col-span-2 text-center text-xs text-slate-400 font-bold italic py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50">
            Belum ada informasi terbaru.
          </div>
        )}
      </div>

      {modalData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setModalData(null)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-start gap-4 mb-4">
                <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">{modalData.judul}</h2>
                <button onClick={() => setModalData(null)} className="text-slate-400 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 w-8 h-8 rounded-full flex items-center justify-center font-black transition-colors shrink-0">
                  ✕
                </button>
              </div>
              <span className="inline-block bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-6">
                {new Date(modalData.tanggal_publikasi).toLocaleDateString('id-ID', {day: '2-digit', month: 'long', year: 'numeric'})}
              </span>

              <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 mb-6 font-medium">
                {modalData.deskripsi}
              </div>

              {modalData.link_dokumen && (
                <a 
                  href={modalData.link_dokumen} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md active:scale-95"
                >
                  Buka Dokumen {modalData.link_dokumen.includes("drive.google.com") ? '📂' : '🔗'}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}