"use client";

import { useState } from "react";

export type KontakDarurat = {
  id: string;
  nama_layanan: string;
  nomor: string;
  keterangan: string | null;
  ikon: string | null;
  urutan: number;
};

function tautanTelepon(nomor: string) {
  const bersih = nomor.replace(/[^\d+]/g, "");
  return bersih ? `tel:${bersih}` : null;
}

export default function PanicButtonClient({ daftarKontak }: { daftarKontak: KontakDarurat[] }) {
  const [panelTerbuka, setPanelTerbuka] = useState(false);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {daftarKontak.length === 0 ? (
          <div className="sm:col-span-3 rounded-2xl border border-dashed border-rose-200 bg-rose-50/40 px-4 py-8 text-center text-sm text-rose-700">
            Kontak darurat belum diisi pengurus. Panic Button akan menampilkan nomor resmi setelah dicatat.
          </div>
        ) : (
          daftarKontak.map((kontak) => {
            const tautan = tautanTelepon(kontak.nomor);
            const isi = (
              <>
                <span className="text-2xl leading-none">{kontak.ikon || "📞"}</span>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-800">{kontak.nama_layanan}</span>
                <span className="text-lg font-black tabular-nums text-slate-900">{kontak.nomor}</span>
                {kontak.keterangan ? <span className="text-[11px] text-slate-500">{kontak.keterangan}</span> : null}
              </>
            );

            if (!tautan) {
              return (
                <div
                  key={kontak.id}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-5 text-center"
                >
                  {isi}
                </div>
              );
            }

            return (
              <a
                key={kontak.id}
                href={tautan}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-rose-100 bg-white px-4 py-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md"
              >
                {isi}
              </a>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => setPanelTerbuka((buka) => !buka)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-xl text-white shadow-[0_12px_30px_rgba(225,29,72,0.45)] transition-transform hover:scale-105 active:scale-95 md:hidden"
        aria-expanded={panelTerbuka}
        aria-label="Buka panic button"
      >
        🚨
      </button>

      {panelTerbuka ? (
        <div className="fixed inset-x-4 bottom-24 z-50 rounded-2xl border border-rose-200 bg-white p-4 shadow-2xl md:hidden">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-rose-700">Panggilan darurat</p>
          <div className="grid grid-cols-3 gap-2">
            {daftarKontak.map((kontak) => {
              const tautan = tautanTelepon(kontak.nomor);
              if (!tautan) return null;
              return (
                <a
                  key={`fab-${kontak.id}`}
                  href={tautan}
                  className="flex flex-col items-center gap-1 rounded-xl bg-rose-50 px-2 py-3 text-center"
                >
                  <span>{kontak.ikon || "📞"}</span>
                  <span className="text-[10px] font-bold text-rose-800">{kontak.nama_layanan}</span>
                  <span className="text-xs font-black tabular-nums text-slate-800">{kontak.nomor}</span>
                </a>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
