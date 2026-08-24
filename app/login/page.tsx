"use client";
import { useState, useEffect } from "react";
import { useWargaAuth } from "@/hooks/use-warga-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function WargaLogin() {
  // FAKTA: Injeksi hook keamanan khusus warga
  const { wargaAktif, loading: authLoading, login } = useWargaAuth();
  const router = useRouter();

  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Jika sistem mendeteksi cookie JWT warga yang valid, langsung tendang ke Portal Warga
  useEffect(() => {
    if (wargaAktif) {
      router.push("/portal");
    }
  }, [wargaAktif, router]);

 const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    
    // Tembak kredensial ke Server API
    const response = await login(nik, password);
    
    if (!response.success) {
      alert("Akses Ditolak: " + response.error);
      setLoginLoading(false);
    } else {
      // FAKTA: API sukses! Paksa reload halaman ke /portal agar Server membaca Cookie JWT yang baru ditanam.
      window.location.href = "/portal";
    }
  };
  
  // Layar Loading Sesi
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-mono text-blue-600">
        <div className="text-4xl mb-4 animate-spin">🔄</div>
        <div className="font-bold tracking-widest uppercase">Memeriksa Kredensial...</div>
      </div>
    );
  }

  // Render UI Form Login
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-8 border-blue-600 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded-bl-lg">WARGA PORTAL</div>
        <div className="text-5xl mb-6 text-center">🏡</div>
        <h2 className="text-2xl font-black text-slate-800 mb-2 text-center">Portal Warga RT 07</h2>
        <p className="text-slate-500 text-sm mb-8 text-center">Silakan masuk menggunakan NIK dan Password Anda.</p>
        
        <div className="space-y-5 mb-8">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Nomor Induk Kependudukan (NIK)</label>
            {/* Filter otomatis hanya menerima angka */}
            <input 
              type="text" 
              required 
              maxLength={16} 
              className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 transition-colors font-mono" 
              placeholder="Masukkan 16 digit NIK..." 
              value={nik} 
              onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))} 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Password</label>
            <input 
              type="password" 
              required 
              className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 transition-colors" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>
        </div>

        <button type="submit" disabled={loginLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 flex justify-center items-center gap-2">
          {loginLoading ? "Memverifikasi..." : "Masuk ke Portal"}
        </button>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">Belum punya akun?</p>
          <Link href="/register" className="text-blue-600 font-bold hover:underline mt-1 inline-block">Daftar sebagai Warga Baru</Link>
        </div>
        <div className="mt-4 text-center border-t pt-4">
          <Link href="/" className="text-slate-400 text-xs font-bold hover:text-slate-600 transition-colors">← Kembali ke Beranda Utama</Link>
        </div>
      </form>
    </div>
  );
}