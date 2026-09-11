"use client";

export default function TombolCetak() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white print:hidden"
    >
      Cetak
    </button>
  );
}
