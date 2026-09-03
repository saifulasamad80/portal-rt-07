import Link from "next/link";

export default function KartuLayanan({
  href,
  ikon,
  judul,
  deskripsi,
  aksen = "bg-white border-slate-200/80 text-slate-800",
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
      className={`${aksen} p-4 md:p-5 rounded-2xl border shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-md hover:-translate-y-0.5 transition-all block h-full`}
    >
      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-lg mb-3">
        {ikon}
      </div>
      <h2 className="font-semibold text-sm leading-snug tracking-tight">{judul}</h2>
      <p className="text-[11px] mt-1.5 text-slate-500 leading-relaxed">{deskripsi}</p>
    </Link>
  );
}
