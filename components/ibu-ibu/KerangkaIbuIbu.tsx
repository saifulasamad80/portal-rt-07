import Link from "next/link";

export default function KerangkaIbuIbu({
  judul,
  deskripsi,
  children,
}: {
  judul: string;
  deskripsi: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#eef2f6] p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/portal" className="font-semibold text-blue-700 hover:underline">
            Portal
          </Link>
          <span className="text-slate-300">/</span>
          <Link href="/portal/ibu-ibu" className="font-semibold text-blue-700 hover:underline">
            Modul Ibu-ibu
          </Link>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-500 mb-2">Kegiatan Ibu-ibu RT</p>
          <h1 className="text-2xl font-bold text-slate-900">{judul}</h1>
          <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">{deskripsi}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
