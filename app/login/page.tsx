"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginWarga() {
  const [nik, setNik] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState({ text: "", type: "" }); // Untuk notifikasi ke user
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPesan({ text: "", type: "" }); // Reset pesan tiap kali klik tombol

    // Eksekusi pencarian data ke Supabase (Mencocokkan NIK & PIN sekaligus)
    const { data, error } = await supabase
      .from("warga")
      .select("*")
      .eq("nik", nik)
      .eq("pin", pin)
      .single(); // .single() memaksa Supabase hanya mengembalikan 1 data spesifik

    // SKENARIO 1: NIK atau PIN Salah / Tidak terdaftar
    if (error || !data) {
      setPesan({ text: "Gagal: NIK atau PIN salah, atau Anda belum terdaftar.", type: "error" });
      setLoading(false);
      return;
    }

    // SKENARIO 2: Belum disahkan Pak RT
    if (data.status_verifikasi === "Menunggu") {
      setPesan({ text: "Status: Data Anda masih dalam antrean verifikasi Pak RT. Silakan cek kembali nanti.", type: "warning" });
      setLoading(false);
      return;
    }

    // SKENARIO 3: Ditolak Pak RT
    if (data.status_verifikasi === "Ditolak") {
      setPesan({ text: "Ditolak: Pendaftaran Anda dibatalkan oleh RT. Silakan hubungi pengurus.", type: "error" });
      setLoading(false);
      return;
    }

    // SKENARIO 4: Sukses dan Sah
    setPesan({ text: "Berhasil login! Mengalihkan ke Dasbor Warga...", type: "success" });
    
    // Simpan kunci akses (Sesi) ke dalam brankas browser lokal warga
    localStorage.setItem("warga_aktif", JSON.stringify(data));
    
    // Lempar warga ke halaman Portal utama mereka setelah 1.5 detik
    setTimeout(() => {
      router.push("/portal"); 
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 flex flex-col items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm border-t-4 border-blue-600">
        <h1 className="text-2xl font-bold text-slate-800 mb-2 text-center">Masuk Portal Warga</h1>
        <p className="text-sm text-slate-500 mb-6 text-center">Gunakan NIK dan PIN yang telah didaftarkan</p>
        
        {/* Kotak Peringatan/Pesan */}
        {pesan.text && (
          <div className={`p-3 mb-4 text-sm font-bold rounded-lg ${
            pesan.type === 'error' ? 'bg-red-100 text-red-700' : 
            pesan.type === 'warning' ? 'bg-amber-100 text-amber-700' : 
            'bg-green-100 text-green-700'
          }`}>
            {pesan.text}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">NIK (16 Digit)</label>
            <input 
              type="text" required maxLength={16} minLength={16} pattern="[0-9]{16}"
              className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-blue-500 text-slate-900 font-mono tracking-wider" 
              placeholder="16 Digit Angka" 
              value={nik} onChange={(e) => setNik(e.target.value.replace(/[^0-9]/g, ''))} 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PIN Rahasia (6 Digit)</label>
            <input 
              type="password" required maxLength={6} minLength={6} pattern="[0-9]{6}"
              className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-blue-500 text-slate-900 font-mono tracking-widest text-center text-xl" 
              placeholder="••••••" 
              value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} 
            />
          </div>

          <button 
            type="submit" disabled={loading}
            className={`w-full text-white font-bold rounded-lg p-3 transition-colors mt-2 shadow ${loading ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? "Memeriksa Data..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}