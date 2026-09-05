"use client";
import { useState } from "react";
import Link from "next/link";

type HasilReset = { success: boolean; message?: string };

export default function ResetSandiClient({
  aksiReset,
}: {
  aksiReset: (password: string) => Promise<HasilReset>;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sukses, setSukses] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return alert("Password minimal 8 karakter!");
    
    setLoading(true);
    try {
      const res = await aksiReset(password);
      if (res?.success) setSukses(true);
      else alert(res?.message || "Password belum dapat diubah. Silakan minta tautan baru.");
    } catch {
      alert("Password belum dapat diubah. Silakan minta tautan baru.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 font-sans">
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-2xl w-full max-w-[400px] text-center border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>
        
        <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-6 shadow-sm">🔑</div>
        <h2 className="text-2xl font-black text-slate-800 mb-1">Buat Sandi Baru</h2>
        <p className="text-slate-500 text-xs font-medium mb-8">Masukkan sandi baru. Tautan akan divalidasi saat disimpan.</p>

        {sukses ? (
          <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl">
            <h3 className="font-black text-blue-800 text-sm mb-2">Password Berhasil Diubah!</h3>
            <p className="text-blue-600 text-xs mb-4">Gunakan password baru ini untuk masuk ke Pusat Komando.</p>
            <Link href="/admin" className="w-full inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow transition-colors">Login Sekarang</Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-6 text-left">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Password Baru</label>
              <input type="password" required minLength={8} maxLength={72} autoComplete="new-password" className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-emerald-500 text-sm text-slate-800 bg-slate-50 focus:bg-white" placeholder="Minimal 8 karakter" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" disabled={loading} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md active:scale-95 disabled:bg-slate-300 transition-all">
              {loading ? "Menyandikan..." : "Kunci & Simpan"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
