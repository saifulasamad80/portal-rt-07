"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function WargaLogin() {
  const router = useRouter();
  const [nik, setNik] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/warga/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nik, pin }),
      });

      const data = await res.json();

      // INJEKSI MUTLAK: Tangkap dan paksa tampilkan pesan asli dari Server API!
      if (!res.ok) {
        throw new Error(data.message || "Akses Ditolak: Terjadi kesalahan sistem.");
      }

      if (data.success) {
        router.push("/portal");
        router.refresh();
      }
    } catch (error: any) {
      // Sekarang alert akan berbunyi persis seperti instruksi dari Backend
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="p-4 flex justify-end">
         <div className="bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded shadow-sm">
           WARGA PORTAL
         </div>
      </div>
      
      <div className="flex-1 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-2">🏡</div>
            <h1 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Portal Warga RT 07</h1>
            <p className="text-sm text-slate-500 font-medium">Silakan masuk menggunakan NIK dan Password Anda.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Nomor Induk Kependudukan (NIK)</label>
              <input
                type="text"
                maxLength={16}
                required
                className="w-full border-2 border-slate-200 rounded-xl p-3.5 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-0 outline-none transition-all bg-transparent shadow-sm"
                value={nik}
                onChange={(e) => setNik(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            <div className="relative">
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Password</label>
              <input
                type={showPin ? "text" : "password"}
                maxLength={6}
                required
                className="w-full border-2 border-slate-200 rounded-xl p-3.5 text-slate-900 font-mono font-bold tracking-widest focus:border-blue-600 focus:ring-0 outline-none transition-all bg-transparent shadow-sm"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-4 top-10 text-xl transition-transform active:scale-90"
              >
                {showPin ? "🙉" : "🙈"}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0e1b4d] text-white font-black py-4 rounded-xl shadow-lg hover:bg-blue-900 disabled:opacity-70 disabled:scale-100 active:scale-[0.98] transition-all tracking-wide"
            >
              {loading ? "Memverifikasi..." : "Masuk Portal"}
            </button>
          </form>

          <div className="text-center mt-8 pt-6 border-t border-slate-200">
            <span className="text-sm text-slate-500 font-medium">Belum punya akun? </span>
            <Link href="/register" className="text-sm text-blue-600 font-black hover:underline ml-1">
              Daftar di sini
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}