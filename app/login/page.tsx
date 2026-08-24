"use client";
import { useState, useEffect } from "react";
import { useWargaAuth } from "@/hooks/use-warga-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function WargaLogin() {
  const { wargaAktif, loading: authLoading, login } = useWargaAuth();
  const router = useRouter();

  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    if (wargaAktif) {
      router.push("/portal");
    }
  }, [wargaAktif, router]);

 const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const response = await login(nik, password);
    if (!response.success) {
      alert("Akses Ditolak: " + response.error);
      setLoginLoading(false);
    } else {
      window.location.href = "/portal";
    }
  };
  
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-mono text-blue-600">
        <div className="text-4xl mb-4 animate-spin">🔄</div>
        <div className="font-bold tracking-widest uppercase">Memeriksa Kredensial...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] w-full max-w-md border-t-4 border-blue-600 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded-bl-lg">WARGA PORTAL</div>
        <div className="text-5xl mb-6 text-center">🏡</div>
        <h2 className="text-2xl font-black text-slate-800 mb-2 text-center">Portal Warga RT 07</h2>
        <p className="text-slate-500 text-sm mb-8 text-center">Silakan masuk menggunakan NIK dan Password Anda.</p>
        
        {/* REVISI UX: Jarak absolut (mb-6), padding 12px 16px (py-3 px-4), radius 8px */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Nomor Induk Kependudukan (NIK)</label>
            <input 
              type="text" 
              required 
              maxLength={16} 
              className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors font-mono" 
              placeholder="Masukkan 16 digit NIK..." 
              value={nik} 
              onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))} 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Password</label>
            <input 
              type="password" 
              required 
              className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>
        </div>

        {/* REVISI UX: Tombol setinggi 48px (h-12) menghindari fat-finger */}
        <button type="submit" disabled={loginLoading} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all shadow-md active:scale-[0.98] flex justify-center items-center gap-2">
          {loginLoading ? "Memverifikasi..." : "Masuk ke Portal"}
        </button>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">Belum punya akun?</p>
          <Link href="/register" className="text-blue-600 font-bold hover:underline mt-1 inline-block">Daftar sebagai Warga Baru</Link>
        </div>
      </form>
    </div>
  );
}