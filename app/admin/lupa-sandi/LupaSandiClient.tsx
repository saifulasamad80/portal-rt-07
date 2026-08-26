"use client";
import { useState } from "react";
import Link from "next/link";

export default function LupaSandiClient({ aksiKirim }: { aksiKirim: any }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sukses, setSukses] = useState(false);

  const handleKirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await aksiKirim(email);
      if (res && !res.success) alert(res.message);
      else setSukses(true);
    } catch (error: any) {
      alert("Kesalahan Sistem: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 font-sans">
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-2xl w-full max-w-[400px] text-center border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500"></div>
        
        <div className="w-16 h-16 bg-rose-50 border border-rose-100 text-rose-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-6 shadow-sm">🔐</div>
        <h2 className="text-2xl font-black text-slate-800 mb-1">Lupa Password</h2>
        <p className="text-slate-500 text-xs font-medium mb-8">Masukkan email admin Anda untuk mendapatkan link pemulihan.</p>

        {sukses ? (
          <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl">
            <div className="text-3xl mb-2">✅</div>
            <h3 className="font-black text-emerald-800 text-sm mb-1">Email Terkirim!</h3>
            <p className="text-emerald-600 text-xs">Silakan cek kotak masuk (atau folder Spam) Gmail Anda.</p>
          </div>
        ) : (
          <form onSubmit={handleKirim} className="space-y-6 text-left">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Email Terdaftar</label>
              <input type="email" required className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-rose-500 text-sm text-slate-800 bg-slate-50 focus:bg-white" placeholder="admin@rt07.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" disabled={loading} className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-md active:scale-95 disabled:bg-slate-300 transition-all">
              {loading ? "Mengirim Radar..." : "Kirim Link Reset"}
            </button>
          </form>
        )}
        <div className="mt-6 text-center">
          <Link href="/admin" className="text-xs font-bold text-slate-500 hover:text-slate-800 underline decoration-slate-300">Batal & Kembali ke Login</Link>
        </div>
      </div>
    </div>
  );
}