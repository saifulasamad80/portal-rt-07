"use client";

import { useEffect, useRef } from "react";

export type PesanDialogData = {
  tipe: "sukses" | "gagal";
  teks: string;
  judul?: string;
  deskripsi?: string;
};

export default function PesanDialog({
  pesan,
  onClose,
}: {
  pesan: PesanDialogData | null;
  onClose: () => void;
}) {
  const tombolRef = useRef<HTMLButtonElement>(null);
  const gagal = pesan?.tipe === "gagal";

  useEffect(() => {
    if (!pesan) return;

    const tutupDenganEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", tutupDenganEscape);
    tombolRef.current?.focus();
    return () => window.removeEventListener("keydown", tutupDenganEscape);
  }, [onClose, pesan]);

  if (!pesan) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-[2px]">
      <div
        role={gagal ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby="pesan-dialog-judul"
        aria-describedby="pesan-dialog-isi"
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[1.75rem] bg-white p-6 shadow-2xl ring-1 ring-black/10"
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
              gagal ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
            }`}
            aria-hidden="true"
          >
            {gagal ? "!" : "✓"}
          </div>
          <div className="min-w-0">
            <h2 id="pesan-dialog-judul" className="text-lg font-bold text-slate-900">
              {pesan.judul || (gagal ? "Tindakan belum berhasil" : "Tindakan berhasil")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              {pesan.deskripsi ||
                (gagal
                  ? "Periksa keterangan di bawah, perbaiki bila diperlukan, lalu coba lagi."
                  : "Perubahan Anda sudah dicatat oleh sistem.")}
            </p>
          </div>
        </div>

        <div
          id="pesan-dialog-isi"
          className={`mt-5 rounded-xl border p-4 ${
            gagal
              ? "border-rose-200 bg-rose-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <p
            className={`text-[11px] font-bold uppercase tracking-[0.14em] ${
              gagal ? "text-rose-700" : "text-emerald-700"
            }`}
          >
            {gagal ? "Penyebab" : "Keterangan"}
          </p>
          <p
            className={`mt-1 text-sm font-medium leading-relaxed ${
              gagal ? "text-rose-900" : "text-emerald-900"
            }`}
          >
            {pesan.teks}
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            ref={tombolRef}
            type="button"
            onClick={onClose}
            className={`min-w-24 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              gagal
                ? "bg-slate-900 hover:bg-slate-700 focus:ring-slate-400"
                : "bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-400"
            }`}
          >
            Oke
          </button>
        </div>
      </div>
    </div>
  );
}
