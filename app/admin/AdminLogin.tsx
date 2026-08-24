"use client";
import { useState } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLoginAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const response = await login(username, password);
    if (!response.success) {
      alert("Akses Ditolak: " + response.error);
      setLoginLoading(false);
    } else {
      window.location.reload(); // Paksa reload agar Server Component membaca cookie JWT
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <form onSubmit={handleLoginAdmin} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm text-center border-t-8 border-emerald-600 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-bl-lg">SECURE JWT AUTH</div>
        <div className="text-4xl mb-4">🏛️</div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">Pusat Komando</h2>
        <p className="text-slate-500 text-sm mb-6">Sistem terenkripsi khusus Pengurus RT.</p>
        <div className="space-y-4 mb-6 text-left">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Username Admin</label>
            <input type="text" required className="w-full border-2 border-slate-300 rounded-lg p-3 outline-none focus:border-emerald-500 transition-colors" placeholder="Masukkan username..." value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Password</label>
            <input type="password" required className="w-full border-2 border-slate-300 rounded-lg p-3 outline-none focus:border-emerald-500 transition-colors" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <button type="submit" disabled={loginLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg">
          {loginLoading ? "Mengotentikasi Server..." : "Otorisasi Masuk"}
        </button>
      </form>
    </div>
  );
}