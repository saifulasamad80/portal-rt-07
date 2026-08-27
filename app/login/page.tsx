"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function WargaLogin() {
  const router = useRouter();
  
  const [nik, setNik] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);

  const [requirePinChange, setRequirePinChange] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [showNewPin, setShowNewPin] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = requirePinChange ? { nik, pin, newPin } : { nik, pin };

      const res = await fetch("/api/warga/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Akses Ditolak: Terjadi kesalahan sistem.");
      }

      if (data.requirePinChange) {
        setRequirePinChange(true);
        alert(data.message);
      } else if (data.success) {
        if (requirePinChange) alert("Pembaruan Keamanan Sukses! Selamat datang di Portal Warga.");
        
        // INJEKSI MUTLAK: Menggunakan SPA Routing murni Next.js 
        // Sangat instan, tidak ada hard-reload browser.
        router.push("/portal");
      }
    } catch (error: any) {
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
          
          {!requirePinChange ? (
            <div className="text-center mb-8">
              <div className="text-5xl mb-2">🏡</div>
              <h1 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Portal Warga RT 07</h1>
              <p className="text-sm text-slate-500 font-medium">Silakan masuk menggunakan NIK dan PIN Anda.</p>
            </div>
          ) : (
            <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="w-16 h-16 bg-rose-100 border-2 border-rose-200 text-rose-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-sm">🛡️</div>
              <h1 className="text-xl font-black text-rose-700 mb-2">Pembaruan Keamanan Wajib</h1>
              <p className="text-xs text-slate-600 font-medium bg-rose-50 p-3 rounded-lg border border-rose-200">
                Sistem mendeteksi Anda masih menggunakan PIN Default dari RT. Demi keamanan privasi data Anda, buatlah 6 Angka PIN Baru Anda sendiri sekarang.
              </p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            
            <div className={requirePinChange ? "hidden" : "space-y-6"}>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Nomor Induk Kependudukan (NIK)</label>
                <input
                  type="text"
                  maxLength={16}
                  required={!requirePinChange}
                  className="w-full border-2 border-slate-200 rounded-xl p-3.5 text-slate-900 font-mono font-bold focus:border-blue-600 focus:ring-0 outline-none transition-all bg-transparent shadow-sm"
                  value={nik}
                  onChange={(e) => setNik(e.target.value.replace(/\D/g, ""))}
                />
              </div>

              <div className="relative">
                <label className="block text-xs font-bold text-slate-600 mb-1.5">PIN Akses (6 Angka)</label>
                <input
                  type={showPin ? "text" : "password"}
                  maxLength={6}
                  required={!requirePinChange}
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
            </div>

            {requirePinChange && (
              <div className="relative animate-in fade-in slide-in-from-bottom-2">
                <label className="block text-xs font-bold text-rose-700 mb-1.5 uppercase tracking-widest">Masukkan PIN Baru Anda</label>
                <input
                  type={showNewPin ? "text" : "password"}
                  maxLength={6}
                  required={requirePinChange}
                  className="w-full border-2 border-rose-300 rounded-xl p-4 text-slate-900 font-mono font-black text-xl text-center tracking-[0.5em] focus:border-rose-600 focus:ring-0 outline-none transition-all bg-white shadow-inner"
                  placeholder="------"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPin(!showNewPin)}
                  className="absolute right-4 top-10 text-xl transition-transform active:scale-90"
                >
                  {showNewPin ? "🙉" : "🙈"}
                </button>
                <p className="text-[10px] text-slate-400 mt-2 text-center font-medium">*Pastikan PIN tidak berurutan seperti 123456.</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white font-black py-4 rounded-xl shadow-lg disabled:opacity-70 disabled:scale-100 active:scale-[0.98] transition-all tracking-wide ${requirePinChange ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#0e1b4d] hover:bg-blue-900'}`}
            >
              {loading ? "Memproses Keamanan..." : (requirePinChange ? "GANTI PIN & MASUK" : "Masuk Portal")}
            </button>
          </form>

          {!requirePinChange && (
            <div className="text-center mt-8 pt-6 border-t border-slate-200">
              <span className="text-sm text-slate-500 font-medium">Belum punya akun? </span>
              <Link href="/register" className="text-sm text-blue-600 font-black hover:underline ml-1">
                Daftar di sini
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}