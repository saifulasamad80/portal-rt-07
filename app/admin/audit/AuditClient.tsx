"use client";
import Link from "next/link";

export default function AuditClient({ logs }: { logs: any[] }) {
  return (
    <div className="min-h-screen bg-slate-900 p-6 md:p-8 font-mono">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-emerald-500 font-bold hover:underline mb-2 inline-block">
          &larr; KEMBALI KE PUSAT KOMANDO
        </Link>

        <div className="bg-slate-800 p-6 rounded-xl shadow-2xl border-l-8 border-rose-500 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-widest">SYSTEM AUDIT TRAIL</h1>
            <p className="text-slate-400 mt-1 text-xs md:text-sm">Pencatatan aktivitas pengurus bersifat IMMUTABLE (Tidak dapat diubah/dihapus).</p>
          </div>
          <div className="bg-rose-500/20 text-rose-400 border border-rose-500/50 px-3 py-1.5 rounded font-black text-xs uppercase tracking-widest w-fit">
            STRICT READ-ONLY
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-950 text-slate-300 text-[10px] md:text-xs tracking-widest uppercase">
                  <th className="p-4 border-b border-slate-700 whitespace-nowrap">Timestamp</th>
                  <th className="p-4 border-b border-slate-700 whitespace-nowrap">Aktor (Pengurus)</th>
                  <th className="p-4 border-b border-slate-700">Tindakan / Aksi</th>
                  <th className="p-4 border-b border-slate-700 whitespace-nowrap">Modul Target</th>
                  <th className="p-4 border-b border-slate-700">Detail Eksekusi</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {logs.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500 italic font-bold">SYSTEM: NO LOGS DETECTED.</td></tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className="border-b border-slate-700/50 hover:bg-slate-700/50 transition-colors">
                      <td className="p-4 whitespace-nowrap text-[10px] md:text-xs text-slate-400 align-top">
                        {new Date(l.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })}
                      </td>
                      <td className="p-4 font-bold text-emerald-400 text-xs md:text-sm align-top">{l.aktor}</td>
                      <td className="p-4 text-white font-bold bg-slate-900/30 text-xs md:text-sm align-top">{l.aksi}</td>
                      <td className="p-4 text-blue-400 text-[10px] md:text-xs align-top font-black">[{l.tabel_target}]</td>
                      <td className="p-4 text-[10px] md:text-xs text-slate-400 align-top break-words max-w-[200px] md:max-w-xs">
                        {l.detail}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}