"use client";
import { useState } from "react";
import Link from "next/link";

export default function PengumumanClient({ pengumumanReguler, rekapVoting }: { pengumumanReguler: any[], rekapVoting: any }) {
  // STATE MUTLAK: Untuk menampung data pengumuman mana yang sedang diklik warga
  const [modalData, setModalData] = useState<any>(null);

  return (
    <div className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 relative">
      <h2 className="font-black text-slate-800 text-sm flex items-center justify-center gap-2 mb-6">📢 Pengumuman & Galeri Warga</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        
        {/* RENDER REKAP VOTING (Sesuai Logika V5.6 Asli) */}
        {rekapVoting && (
          <div className={`aspect-square ${rekapVoting.status === 'Aktif' ? 'bg-emerald-50 border-emerald-200' : 'bg-indigo-50 border-indigo-200'} border p-3 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden`}>
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

        {/* REFACTOR MUTLAK: Mengubah tag <a> menjadi div yang memicu setState Modal */}
        {pengumumanReguler && pengumumanReguler.length > 0 && pengumumanReguler.map((p) => (
          <div 
            key={p.id} 
            onClick={() => setModalData(p)}
            className="aspect-square bg-slate-50 border border-slate-200 p-3 rounded-xl shadow-sm hover:shadow-md hover:border-blue-400 hover:bg-white transition-all flex flex-col items-center justify-center text-center cursor-pointer group"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white text-blue-600 rounded-full flex items-center justify-center text-xl md:text-2xl mb-2 group-hover:scale-110 shadow-sm transition-transform">
              {p.link_dokumen?.includes("drive.google.com") ? '📂' : p.link_dokumen ? '🔗' : '📄'}
            </div>
            <h3 className="font-bold text-slate-800 text-[10px] md:text-[11px] leading-tight line-clamp-2 px-1">
              {p.judul}
            </h3>
            <span className="text-[7px] text-slate-400 font-bold mt-2 uppercase tracking-widest">
              {new Date(p.tanggal_publikasi).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
            </span>
          </div>
        ))}

        {!rekapVoting && (!pengumumanReguler || pengumumanReguler.length === 0) && (
          <div className="col-span-2 md:col-span-4 text-center text-xs text-slate-400 font-bold italic py-8 border border-dashed border-slate-200 rounded-lg">
            Belum ada galeri informasi terbaru.
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* INJEKSI MODAL (Mencegah teks deskripsi terbuang ke ruang hampa)   */}
      {/* ----------------------------------------------------------------- */}
      {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setModalData(null)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()} // Mencegah modal tertutup saat area putih diklik
          >
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-start gap-4 mb-4">
                <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">{modalData.judul}</h2>
                <button onClick={() => setModalData(null)} className="text-slate-400 hover:text-rose-500 bg-slate-100 hover:bg-rose-50 w-8 h-8 rounded-full flex items-center justify-center font-black transition-colors shrink-0">
                  ✕
                </button>
              </div>
              <span className="inline-block bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-6">
                {new Date(modalData.tanggal_publikasi).toLocaleDateString('id-ID', {day: '2-digit', month: 'long', year: 'numeric'})}
              </span>

              <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 mb-6">
                {modalData.deskripsi}
              </div>

              {/* Jika Pak RT melampirkan link, tombol ini akan muncul */}
              {modalData.link_dokumen && (
                <a 
                  href={modalData.link_dokumen} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md active:scale-95"
                >
                  Buka Dokumen Lampiran {modalData.link_dokumen.includes("drive.google.com") ? '📂' : '🔗'}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}