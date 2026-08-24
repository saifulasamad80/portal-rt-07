"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/hooks/useAdminAuth"; // Menggunakan hook kustom aman kita

// Definisi Tipe Data Kuat untuk Keamanan Kode (TypeScript Enforcement)
export interface AuditLog {
  id: string;
  created_at: string;
  aktor: string;
  aksi: string;
  tabel_target: string;
  detail: string;
}

export default function SecureAdminAuditLog() {
  const router = useRouter();
  const { adminAktif, loading: authLoading } = useAdminAuth(); // Pengecekan sesi server-side (HttpOnly Cookie)
  
  // State Pengelolaan Data
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  // State Filter & Paginasi (Performance & Usability Optimization)
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [filterAktor, setFilterAktor] = useState("");
  const [filterTabel, setFilterTabel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("audit_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      // Terapkan Filter Dinamis di Sisi Server (Mencegah Overload Data Klien)
      if (filterAktor) {
        query = query.ilike("aktor", `%${filterAktor}%`);
      }
      if (filterTabel) {
        query = query.eq("tabel_target", filterTabel);
      }
      if (searchQuery) {
        query = query.or(`aksi.ilike.%${searchQuery}%,detail.ilike.%${searchQuery}%`);
      }

      // Hitung Paginasi Ranget (O(1) memory overhead di browser)
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      if (data) setLogs(data as AuditLog[]);
      if (count !== null) setTotalCount(count);
    } catch (err: any) {
      alert("Sistem Keamanan: Gagal memuat log audit! " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger reload data saat parameter filter atau paginasi berubah
  useEffect(() => {
    if (adminAktif) {
      fetchLogs();
    }
  }, [adminAktif, page, filterAktor, filterTabel]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  // Fungsi Proteksi Data Pribadi (Client-Side PII Masking & Sanitization)
  // Berfungsi menyaring dan menyensor data NIK (16 digit) dan No HP di dalam kolom detail
  const sanitizeDetailPayload = (rawDetail: string): string => {
    if (!rawDetail) return "Tanpa rincian.";
    
    let sanitized = rawDetail;

    // 1. Masking Pola NIK (16 digit angka berurutan)
    const nikRegex = /\b(\d{6})(\d{6})(\d{4})\b/g;
    sanitized = sanitized.replace(nikRegex, "$1XXXXXX$3");

    // 2. Masking Pola No WhatsApp / HP (Pola umum telepon Indonesia)
    const phoneRegex = /\b(08|628)(\d{2,4})(\d{4,8})\b/g;
    sanitized = sanitized.replace(phoneRegex, (match, prefix, mid, last) => {
      return `${prefix}${mid}${"X".repeat(last.length)}`;
    });

    return sanitized;
  };

  // Jika otentikasi sedang berlangsung
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-mono font-bold text-emerald-500 animate-pulse">
        [SYS] DECRYPTING ENCRYPTED SECURITY SESSION...
      </div>
    );
  }

  // Jika tidak memiliki sesi admin yang sah, render ditolak (dan dialihkan oleh middleware/hook)
  if (!adminAktif) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-mono text-rose-500 p-6 text-center">
        <h1 className="text-4xl font-black mb-4">🚫 ACCESS DENIED</h1>
        <p className="max-w-md text-slate-400">Sesi Anda tidak valid atau tidak terotentikasi di sisi server. Silakan login kembali ke Pusat Komando.</p>
        <Link href="/admin" className="mt-6 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-6 rounded transition-colors">
          Kembali ke Login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6 md:p-8 font-mono text-slate-300">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-emerald-500 font-bold hover:underline mb-2 inline-block">
          &larr; KEMBALI KE PUSAT KOMANDO
        </Link>

        {/* HEADER PANEL */}
        <div className="bg-slate-800 p-6 rounded-xl shadow-2xl border-l-8 border-rose-500 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-widest">SYSTEM AUDIT TRAIL (SECURE)</h1>
            <p className="text-slate-400 mt-1 text-sm">
              Pencatatan aktivitas pengurus dilindungi database-level immutable constraints. NIK & PII disamarkan otomatis.
            </p>
          </div>
          <div className="bg-rose-500/20 text-rose-400 border border-rose-500/50 px-3 py-1.5 rounded font-black text-xs uppercase tracking-widest text-center">
            SECURE READ-ONLY
          </div>
        </div>

        {/* INTEGRATED FILTERING CONSOLE */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cari Detail / Aksi</label>
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none"
                placeholder="Kata kunci..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Filter Aktor</label>
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none"
                placeholder="Cth: saifulasamad"
                value={filterAktor}
                onChange={(e) => { setFilterAktor(e.target.value); setPage(1); }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Modul Target</label>
              <select
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-emerald-500 outline-none"
                value={filterTabel}
                onChange={(e) => { setFilterTabel(e.target.value); setPage(1); }}
              >
                <option value="">-- Semua Modul --</option>
                <option value="warga">Induk Warga</option>
                <option value="kas_rt">Buku Kas</option>
                <option value="transaksi_sampah">Bank Sampah</option>
                <option value="tabungan_kurban">Tabungan Kurban</option>
                <option value="peminjaman_inventaris">Peminjaman Inventaris</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors"
              >
                TERAPKAN FILTER
              </button>
            </div>
          </form>
        </div>

        {/* LOGS TABLE PANEL */}
        <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-950 text-slate-300 text-xs tracking-widest uppercase">
                  <th className="p-4 border-b border-slate-700">Timestamp</th>
                  <th className="p-4 border-b border-slate-700">Aktor</th>
                  <th className="p-4 border-b border-slate-700">Tindakan / Aksi</th>
                  <th className="p-4 border-b border-slate-700">Modul</th>
                  <th className="p-4 border-b border-slate-700">Detail Eksekusi (PII Masked)</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-emerald-500 animate-pulse font-bold">
                      SYSTEM: LOADING ENCRYPTED AUDIT TRAILS...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                      SYSTEM: NO LOGS DETECTED.
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="p-4 whitespace-nowrap text-xs text-slate-400">
                        {new Date(l.created_at).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "medium",
                        })}
                      </td>
                      <td className="p-4 font-bold text-emerald-400">{l.aktor}</td>
                      <td className="p-4 text-white font-bold bg-slate-900/50">{l.aksi}</td>
                      <td className="p-4 text-blue-400 text-xs">[{l.tabel_target}]</td>
                      <td className="p-4 text-xs text-slate-400 max-w-sm break-all font-sans">
                        {sanitizeDetailPayload(l.detail)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION CONTROL (PERFORMANCE OPTIMIZATION) */}
          {totalCount > pageSize && (
            <div className="bg-slate-950 p-4 border-t border-slate-700 flex items-center justify-between text-xs font-bold">
              <span className="text-slate-400">
                Menampilkan {logs.length} dari {totalCount} jejak log
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="bg-slate-800 text-emerald-500 px-3 py-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                >
                  PREV
                </button>
                <span className="flex items-center text-white px-2">
                  Halaman {page} dari {Math.ceil(totalCount / pageSize)}
                </span>
                <button
                  disabled={page >= Math.ceil(totalCount / pageSize) || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="bg-slate-800 text-emerald-500 px-3 py-1.5 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                >
                  NEXT
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
