"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SensusClient({ warga, aksiKirim }: { warga: any, aksiKirim: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [catatan, setCatatan] = useState("");
  const [isSetuju, setIsSetuju] = useState(false);

  // META & CAPTCHA ENGINE
  const [mathTask, setMathTask] = useState({ a: 0, b: 0, operator: '+', result: 0 });
  const [captchaInput, setCaptchaInput] = useState("");

  const generateCaptcha = () => {
    const isPlus = Math.random() > 0.5;
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    if (isPlus) {
      setMathTask({ a, b, operator: '+', result: a + b });
    } else {
      const max = Math.max(a, b);
      const min = Math.min(a, b);
      setMathTask({ a: max, b: min, operator: '-', result: max - min });
    }
    setCaptchaInput("");
  };

  useEffect(() => { generateCaptcha(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSetuju) return alert("Anda harus mencentang pernyataan kesesuaian data!");

    if (parseInt(captchaInput) !== mathTask.result) {
      alert("  Validasi Keamanan Gagal: Jawaban matematika Anda salah!");
      generateCaptcha();
      return;
    }

    setLoading(true);
    try {
      await aksiKirim(catatan);
      alert("  VERIFIKASI BERHASIL!\n\nData Kependudukan (Carik) keluarga Anda telah dikonfirmasi.");
      router.push("/portal");
      router.refresh();
    } catch (error: any) {
      alert("Gagal memverifikasi data: " + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 pb-20 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        
        <Link href="/portal" className="text-slate-500 font-bold hover:text-slate-800 text-sm inline-flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 transition-all active:scale-95">
          <span>&larr;</span> Batal & Kembali
        </Link>

        {/* HEADER */}
        <div className="bg-amber-500 p-8 rounded-2xl shadow-xl text-white relative overflow-hidden">
          <div className="absolute -right-10 -top-10 text-9xl opacity-10"> </div>
          <h1 className="text-2xl md:text-3xl font-black mb-2">Verifikasi Data Carik</h1>
          <p className="text-amber-100 text-xs md:text-sm max-w-lg leading-relaxed font-medium">
            Sistem Sensus Manual ditiadakan. Silakan periksa data demografi keluarga Anda yang ditarik dari sistem Kelurahan di bawah ini.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* DATA KEPALA KELUARGA */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-blue-500">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-100 pb-4">Profil Kepala Keluarga</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nama Lengkap</span>
                <span className="font-black text-slate-800">{warga.nama_lengkap}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">NIK</span>
                <span className="font-bold font-mono text-slate-700">{warga.nik}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pekerjaan</span>
                <span className="font-bold text-slate-700">{warga.pekerjaan || "-"}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">No. WhatsApp</span>
                <span className="font-bold font-mono text-slate-700">{warga.no_whatsapp || "-"}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 md:col-span-2">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Detail Alamat</span>
                <span className="font-bold text-slate-700">{warga.detail_alamat || "-"}</span>
              </div>
            </div>
          </div>

          {/* DATA ANGGOTA KELUARGA */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-emerald-500">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-100 pb-4">Anggota Keluarga (Tanggungan)</h2>
            
            {(!warga.anggota_keluarga || warga.anggota_keluarga.length === 0) ? (
              <div className="text-center p-6 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                <p className="text-sm font-bold text-slate-500 italic">Tidak ada data anggota keluarga / Hidup sendiri.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {warga.anggota_keluarga.map((ak: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <h3 className="font-black text-slate-800 text-sm">{ak.nama_lengkap}</h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">NIK: {ak.nik} &bull; {ak.pekerjaan}</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-emerald-200">
                      {ak.hubungan_keluarga}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FORM KONFIRMASI */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
            <div className="mb-6">
              <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wide">Koreksi Data (Opsional)</label>
              <textarea 
                rows={3} 
                className="w-full border-2 border-slate-200 rounded-xl p-3.5 text-sm text-slate-700 outline-none focus:border-amber-500 bg-slate-50 focus:bg-white transition-colors" 
                placeholder="Tuliskan di sini jika ada anggota keluarga yang belum masuk, atau ada pekerjaan/alamat yang harus diperbaiki Pengurus RT..." 
                value={catatan} 
                onChange={(e) => setCatatan(e.target.value)}
              ></textarea>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" required checked={isSetuju} onChange={e => setIsSetuju(e.target.checked)} className="mt-1 w-5 h-5 text-amber-600 rounded border-gray-300 focus:ring-amber-500" />
                <div className="text-xs text-amber-900 leading-relaxed font-medium">
                  <strong>PERNYATAAN VERIFIKASI:</strong> Saya menyatakan bahwa data keluarga (Carik) yang tercantum di atas adalah benar dan sesuai dengan kondisi saat ini.
                </div>
              </label>
            </div>
          </div>

          {/* KLASTER 4: VALIDASI CAPTCHA & SUBMIT */}
          <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-xl text-white border border-slate-800">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="w-full md:w-1/2">
                <h3 className="font-black text-lg mb-2">Verifikasi Kemanusiaan</h3>
                <p className="text-xs text-slate-400 mb-4">Selesaikan soal matematika dasar ini untuk memastikan bahwa Anda bukan robot/sistem otomatis (Spam).</p>
                <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-700">
                  <div className="text-2xl font-black text-amber-400 tracking-widest bg-slate-800 px-4 py-2 rounded-lg border border-slate-600">
                    {mathTask.a} {mathTask.operator} {mathTask.b} =
                  </div>
                  <input 
                    type="number" 
                    required 
                    className="flex-1 bg-transparent border-b-2 border-slate-600 focus:border-amber-500 p-2 text-2xl font-black text-center outline-none transition-colors w-24 placeholder:text-slate-700" 
                    placeholder="?"
                    value={captchaInput} 
                    onChange={(e) => setCaptchaInput(e.target.value)}
                  />
                </div>
              </div>
              <div className="w-full md:w-1/2">
                <button 
                  type="submit" 
                  disabled={loading || !captchaInput || !isSetuju} 
                  className={`w-full h-16 flex items-center justify-center rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg active:scale-95 ${loading || !captchaInput || !isSetuju ? 'bg-slate-700 text-slate-500 cursor-not-allowed shadow-none' : 'bg-amber-500 hover:bg-amber-400 text-slate-900'}`}
                >
                  {loading ? "Memproses Data..." : "Konfirmasi Data"}
                </button>
              </div>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}