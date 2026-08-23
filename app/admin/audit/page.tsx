"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const sesi = localStorage.getItem("admin_aktif");
    if (!sesi) {
      router.push("/admin");
      return;
    }
    fetchLogs();
  }, [router]);

  const fetchLogs = async () => {
    setLoading(true);
    // FAKTA: Tarik maksimal 100 log terakhir biar aplikasi nggak berat
    const { data } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    
    if (data) setLogs(data);
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center font-mono font-bold text-emerald-500">SYSTEM: DECRYPTING LOGS...</div>;

  return (
    <div className="min-h-screen bg-slate-900 p-8 font-mono">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-emerald-500 font-bold hover:underline mb-2 inline-block">
          &larr; KEMBALI KE PUSAT KOMANDO
        </Link>

        <div className="bg-slate-800 p-6 rounded-xl shadow-2xl border-l-8 border-rose-500">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-black text-white tracking-widest">SYSTEM AUDIT TRAIL</h1>
              <p className="text-slate-400 mt-1 text-sm">Pencatatan aktivitas pengurus bersifat IMMUTABLE (Tidak dapat diubah/dihapus).</p>
            </div>
            <div className="bg-rose-500/20 text-rose-400 border border-rose-500/50 px-3 py-1.5 rounded font-black text-xs uppercase tracking-widest">
              STRICT READ-ONLY
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-950 text-slate-300 text-xs tracking-widest uppercase">
                  <th className="p-4 border-b border-slate-700">Timestamp</th>
                  <th className="p-4 border-b border-slate-700">Aktor (Pengurus)</th>
                  <th className="p-4 border-b border-slate-700">Tindakan / Aksi</th>
                  <th className="p-4 border-b border-slate-700">Modul Target</th>
                  <th className="p-4 border-b border-slate-700">Detail Eksekusi</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {logs.length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-slate-500 italic">SYSTEM: NO LOGS DETECTED.</td></tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="p-4 whitespace-nowrap text-xs text-slate-400">
                        {new Date(l.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' })}
                      </td>
                      <td className="p-4 font-bold text-emerald-400">{l.aktor}</td>
                      <td className="p-4 text-white font-bold bg-slate-900/50">{l.aksi}</td>
                      <td className="p-4 text-blue-400 text-xs">[{l.tabel_target}]</td>
                      <td className="p-4 text-xs text-slate-400 max-w-xs truncate" title={l.detail}>
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