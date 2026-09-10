"use client";
import { useState } from "react";
import Link from "next/link";
import ThumbnailPdf from "@/components/ThumbnailPdf";
import { adalahUrlDrive, adalahUrlGambar, adalahUrlPdf, labelAksiLampiran } from "@/lib/lampiran-pengumuman";

type SiaranPublik = {
  id: string;
  judul: string;
  deskripsi: string;
  link_dokumen: string | null;
  tanggal_publikasi: string;
};

function LatarThumbnail({ siaran }: { siaran: SiaranPublik }) {
  const url = siaran.link_dokumen;
  if (adalahUrlGambar(url) && url) {
    return <img src={url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />;
  }
  if (adalahUrlPdf(url) && url) {
    return <ThumbnailPdf url={url} alt="" />;
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
      <span className="text-3xl" aria-hidden>
        {adalahUrlDrive(url) ? "📂" : "📄"}
      </span>
    </div>
  );
}

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

        {pengumumanReguler && pengumumanReguler.length > 0 && pengumumanReguler.map((p: SiaranPublik) => (
          <button
            type="button"
            key={p.id}
            onClick={() => setModalData(p)}
            className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-left shadow-sm transition-all duration-200 hover:border-blue-400 hover:shadow-md"
          >
            <LatarThumbnail siaran={p} />
            <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-slate-600">
              {adalahUrlPdf(p.link_dokumen) ? "PDF" : adalahUrlGambar(p.link_dokumen) ? "Foto" : adalahUrlDrive(p.link_dokumen) ? "Folder" : "Info"}
            </span>
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent p-3 pt-8">
              <span className="block font-bold text-[10px] leading-snug text-white line-clamp-2">{p.judul}</span>
              <span className="mt-1 block text-[8px] font-bold uppercase tracking-widest text-white/70" suppressHydrationWarning>
                {new Date(p.tanggal_publikasi).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
              </span>
            </span>
          </button>
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
                <div className="space-y-3">
                  {adalahUrlGambar(modalData.link_dokumen) ? (
                    <img src={modalData.link_dokumen} alt="" className="w-full max-h-64 rounded-xl border border-slate-200 object-contain bg-slate-50" />
                  ) : null}
                  {adalahUrlPdf(modalData.link_dokumen) ? (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 h-56">
                      <ThumbnailPdf url={modalData.link_dokumen} alt="" />
                    </div>
                  ) : null}
                  <a 
                    href={modalData.link_dokumen} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md active:scale-95"
                  >
                    {labelAksiLampiran(modalData.link_dokumen)}
                    {adalahUrlDrive(modalData.link_dokumen) ? " 📂" : adalahUrlPdf(modalData.link_dokumen) ? " 📄" : adalahUrlGambar(modalData.link_dokumen) ? " 🖼️" : " 🔗"}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}