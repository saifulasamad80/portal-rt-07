import Link from "next/link";
import IndikatorPendingNavigasi from "@/components/IndikatorPendingNavigasi";

export default function KartuLayanan({
  href,
  ikon,
  judul,
  deskripsi,
  aksen = "bg-white border-slate-200 text-slate-800",
  terkunci = false,
}: {
  href: string;
  ikon: string;
  judul: string;
  deskripsi: string;
  aksen?: string;
  terkunci?: boolean;
}) {
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
            : "bg-slate-50 border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 group-hover:scale-105 transition-transform duration-200"
        }`}
      >
        {ikon}
      </div>
      <h2
        className={`font-semibold text-[13px] leading-snug tracking-tight ${
          terkunci ? "text-slate-500" : "group-hover:text-blue-700 transition-colors duration-200"
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
      className={`${aksen} group p-4 rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-blue-300 transition-[transform,box-shadow,border-color,color] duration-200 ease-out block h-full relative touch-manipulation active:scale-[0.98] active:shadow-sm`}
    >
      {isi}
      <IndikatorPendingNavigasi />
    </Link>
  );
}
