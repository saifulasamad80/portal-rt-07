export default function KerangkaMemuat({
  aksen = "from-blue-500 via-emerald-500 to-blue-500",
}: {
  aksen?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat halaman…</span>
      <header className="bg-slate-900 relative rounded-b-3xl shadow-xl">
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${aksen}`} />
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-8 pb-14 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 animate-pulse shrink-0" />
          <div className="space-y-2 min-w-0 flex-1">
            <div className="h-2.5 w-28 rounded bg-white/10 animate-pulse" />
            <div className="h-5 w-48 max-w-full rounded bg-white/15 animate-pulse" />
            <div className="h-4 w-36 max-w-full rounded bg-white/10 animate-pulse" />
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 md:px-6 -mt-9 relative z-10 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-[7.25rem] rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="h-full w-full animate-pulse bg-gradient-to-br from-slate-50 to-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
