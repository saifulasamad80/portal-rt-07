import Link from "next/link";

export default function KartuLayanan({
  href,
  ikon,
  judul,
  deskripsi,
  aksen = "bg-white border-slate-200 text-slate-800",
}: {
  href: string;
  ikon: string;
  judul: string;
  deskripsi: string;
  aksen?: string;
}) {
  return (
    <Link
      href={href}
      className={`${aksen} group p-4 rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-blue-300 transition-all duration-200 block h-full`}
    >
      <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-base mb-3 group-hover:bg-blue-50 group-hover:border-blue-100 group-hover:scale-105 transition-all duration-200">
        {ikon}
      </div>
      <h2 className="font-semibold text-[13px] leading-snug tracking-tight group-hover:text-blue-700 transition-colors">{judul}</h2>
      <p className="text-[11px] mt-1 text-slate-500 leading-relaxed">{deskripsi}</p>
    </Link>
  );
}
