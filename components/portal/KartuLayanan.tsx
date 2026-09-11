import type { ReactNode } from "react";
import Link from "next/link";
import IndikatorPendingNavigasi from "@/components/IndikatorPendingNavigasi";

export const PALET_AKSEN_KARTU = {
  biru: {
    kartu: "bg-white border-blue-200",
    hover: "hover:border-blue-400",
    ikon: "bg-blue-50 border-blue-200",
    judul: "group-hover:text-blue-800",
    batang: "bg-blue-500",
  },
  nila: {
    kartu: "bg-white border-indigo-200",
    hover: "hover:border-indigo-400",
    ikon: "bg-indigo-50 border-indigo-200",
    judul: "group-hover:text-indigo-800",
    batang: "bg-indigo-500",
  },
  langit: {
    kartu: "bg-white border-sky-200",
    hover: "hover:border-sky-400",
    ikon: "bg-sky-50 border-sky-200",
    judul: "group-hover:text-sky-800",
    batang: "bg-sky-500",
  },
  sian: {
    kartu: "bg-white border-cyan-200",
    hover: "hover:border-cyan-400",
    ikon: "bg-cyan-50 border-cyan-200",
    judul: "group-hover:text-cyan-800",
    batang: "bg-cyan-500",
  },
  toska: {
    kartu: "bg-white border-teal-200",
    hover: "hover:border-teal-400",
    ikon: "bg-teal-50 border-teal-200",
    judul: "group-hover:text-teal-800",
    batang: "bg-teal-500",
  },
  hijau: {
    kartu: "bg-white border-emerald-200",
    hover: "hover:border-emerald-400",
    ikon: "bg-emerald-50 border-emerald-200",
    judul: "group-hover:text-emerald-800",
    batang: "bg-emerald-500",
  },
  lime: {
    kartu: "bg-white border-lime-200",
    hover: "hover:border-lime-400",
    ikon: "bg-lime-50 border-lime-200",
    judul: "group-hover:text-lime-800",
    batang: "bg-lime-600",
  },
  emas: {
    kartu: "bg-white border-amber-200",
    hover: "hover:border-amber-400",
    ikon: "bg-amber-50 border-amber-200",
    judul: "group-hover:text-amber-800",
    batang: "bg-amber-500",
  },
  kuning: {
    kartu: "bg-white border-yellow-200",
    hover: "hover:border-yellow-400",
    ikon: "bg-yellow-50 border-yellow-200",
    judul: "group-hover:text-yellow-800",
    batang: "bg-yellow-400",
  },
  oranye: {
    kartu: "bg-white border-orange-200",
    hover: "hover:border-orange-400",
    ikon: "bg-orange-50 border-orange-200",
    judul: "group-hover:text-orange-800",
    batang: "bg-orange-500",
  },
  mawar: {
    kartu: "bg-white border-rose-200",
    hover: "hover:border-rose-400",
    ikon: "bg-rose-50 border-rose-200",
    judul: "group-hover:text-rose-800",
    batang: "bg-rose-500",
  },
  pink: {
    kartu: "bg-white border-pink-200",
    hover: "hover:border-pink-400",
    ikon: "bg-pink-50 border-pink-200",
    judul: "group-hover:text-pink-800",
    batang: "bg-pink-500",
  },
  ungu: {
    kartu: "bg-white border-violet-200",
    hover: "hover:border-violet-400",
    ikon: "bg-violet-50 border-violet-200",
    judul: "group-hover:text-violet-800",
    batang: "bg-violet-500",
  },
  merah: {
    kartu: "bg-white border-red-200",
    hover: "hover:border-red-400",
    ikon: "bg-red-50 border-red-200",
    judul: "group-hover:text-red-800",
    batang: "bg-red-500",
  },
  abu: {
    kartu: "bg-white border-slate-300",
    hover: "hover:border-slate-400",
    ikon: "bg-slate-100 border-slate-200",
    judul: "group-hover:text-slate-800",
    batang: "bg-slate-500",
  },
} as const;

export type AksenKartu = keyof typeof PALET_AKSEN_KARTU;

export function KartuRingkasDasbor({
  label,
  nilai,
  catatan,
  ikon,
  aksen,
  nilaiKelas = "text-slate-900",
}: {
  label: string;
  nilai: ReactNode;
  catatan: ReactNode;
  ikon: string;
  aksen: AksenKartu;
  nilaiKelas?: string;
}) {
  const palet = PALET_AKSEN_KARTU[aksen];
  return (
    <div className={`${palet.kartu} p-4 rounded-2xl shadow-sm border relative`}>
      <span aria-hidden className={`absolute left-1.5 top-3 bottom-3 w-1 rounded-full ${palet.batang}`} />
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <span className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs shrink-0 ${palet.ikon}`}>
          {ikon}
        </span>
      </div>
      <p className={`font-bold leading-snug tracking-tight tabular-nums ${nilaiKelas}`}>{nilai}</p>
      <div className="text-[10px] md:text-[11px] text-slate-500 mt-1 leading-relaxed">{catatan}</div>
    </div>
  );
}

export default function KartuLayanan({
  href,
  ikon,
  judul,
  deskripsi,
  aksen = "biru",
  terkunci = false,
}: {
  href: string;
  ikon: string;
  judul: string;
  deskripsi: string;
  aksen?: AksenKartu;
  terkunci?: boolean;
}) {
  const palet = PALET_AKSEN_KARTU[aksen];
  const isi = (
    <>
      {terkunci && (
        <span className="absolute top-3 right-3 bg-slate-200 text-slate-600 text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
          Terkunci
        </span>
      )}
      <div
        className={`w-9 h-9 rounded-xl border flex items-center justify-center text-base mb-3 ${
          terkunci
            ? "bg-slate-100 border-slate-200 grayscale opacity-70"
            : `${palet.ikon} group-hover:scale-105 transition-transform duration-200`
        }`}
      >
        {ikon}
      </div>
      <h2
        className={`font-semibold text-[13px] leading-snug tracking-tight ${
          terkunci ? "text-slate-500" : `text-slate-800 ${palet.judul} transition-colors duration-200`
        }`}
      >
        {judul}
      </h2>
      <p className={`text-[11px] mt-1 leading-relaxed ${terkunci ? "text-slate-400" : "text-slate-500"}`}>
        {terkunci ? "Selesaikan verifikasi Carik terlebih dahulu" : deskripsi}
      </p>
    </>
  );

  if (terkunci) {
    return (
      <div
        className="bg-slate-50/80 p-4 rounded-2xl border border-dashed border-slate-300 cursor-not-allowed relative h-full"
        aria-disabled="true"
      >
        {isi}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`${palet.kartu} ${palet.hover} group p-4 rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow,border-color,color] duration-200 ease-out block h-full relative touch-manipulation active:scale-[0.98] active:shadow-sm`}
    >
      <span aria-hidden className={`absolute left-1.5 top-3 bottom-3 w-1 rounded-full ${palet.batang}`} />
      {isi}
      <IndikatorPendingNavigasi />
    </Link>
  );
}
