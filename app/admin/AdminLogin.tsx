"use client";
import { useState } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  
  // INJEKSI MUTLAK: Radar Ikon Mata
  const [showPassword, setShowPassword] = useState(false);

  const handleLoginAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const response = await login(username, password);
    if (!response.success) {
      alert("Akses Ditolak: " + response.error);
      setLoginLoading(false);
    } else {
      window.location.reload(); 
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 font-sans">
      
      <form onSubmit={handleLoginAdmin} className="bg-white p-8 md:p-10 rounded-2xl shadow-2xl w-full max-w-[400px] text-center border border-slate-200 relative overflow-hidden transition-all duration-300">
        
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 to-teal-600"></div>
        <div className="absolute top-1.5 right-2 bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded-b-md uppercase tracking-widest border border-slate-200 border-t-0">
          Admin Portal
        </div>

        <div className="w-16 h-16 bg-slate-50 border border-slate-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-6 shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
          🏛️
        </div>
        
        <h2 className="text-2xl font-black text-slate-800 mb-1">Pusat Komando</h2>
        <p className="text-slate-500 text-xs font-medium mb-8">Sistem kendali operasi terenkripsi.</p>
        
        <div className="space-y-5 mb-8 text-left">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Username Admin</label>
            <input 
              type="text" 
              required 
              className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-sm text-slate-800 bg-slate-50 focus:bg-white" 
              placeholder="Masukkan username..." 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Password</label>
            
            {/* INJEKSI MUTLAK: Sistem Wrapper Relative untuk Ikon Mata */}
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required 
                className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-sm text-slate-800 bg-slate-50 focus:bg-white pr-12" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
              />
              {/* REVISI UX: Hitbox diperbesar (p-3), margin dikalibrasi */}
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-3 text-slate-400 hover:text-emerald-600 focus:outline-none text-lg transition-colors cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? "👁️" : "🙈"}
              </button>
            </div>

          </div>
        </div>
        
        <button 
          type="submit" 
          disabled={loginLoading} 
          className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-all shadow-md active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loginLoading ? "Mengotentikasi Server..." : "Otorisasi Masuk"}
        </button>
      </form>

      <div className="mt-8 text-slate-500 text-[10px] font-bold uppercase tracking-widest text-center">
        Restricted Access Only <br/>
        <span className="opacity-50">Log IP Address: Active</span>
      </div>
    </div>
  );
}