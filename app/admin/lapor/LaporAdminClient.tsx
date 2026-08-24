"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LaporAdminClient({ adminAktif, laporanList, aksiTanggapi }: { adminAktif: any, laporanList: any[], aksiTanggapi: any }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState("");
  
  // State untuk form modal/tanggapan
  const [laporanAktif, setLaporanAktif] = useState<any>(null);
  const [tanggapan, setTanggapan] = useState("");
  const [status, setStatus] = useState("");

  const bukaPanelTanggapan = (laporan: any) => {
    setLaporanAktif(laporan);
    setTanggapan(laporan.tanggapan_rt || "");
    setStatus(laporan.status || "Menunggu");
  };

  const tutupPanel = () => {
    setLaporanAktif(null);
    setTanggapan("");
    setStatus("");
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!laporanAktif) return;
    
    setLoadingId(laporanAktif.id);
    try {
      await aksiTanggapi(laporanAktif.id, status, tanggapan);
      alert("Tanggapan dan status laporan berhasil di-update!");
      tutupPanel();
      router.refresh();
    } catch (error: any) {
      alert("Gagal menyimpan tanggapan: " + error.message);
    }
    setLoadingId("");
  };

  // Hitung statistik cepat
  const totalMenunggu = laporanList.filter(l => l.status === "Menunggu" || !l.status).length;
  const totalDiproses = laporanList.filter(l => l.status === "Diproses").length;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-rose-600 font-bold text-sm hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        {/* HEADER LAPORAN */}
        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-rose-500 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Tiket Laporan Warga</h1>
            <p className="text-slate-400 text-sm">Tindak lanjuti keluhan, fasilitas rusak, atau laporan keamanan warga.</p>
          </div>
          <div className="text-5xl hidden md:block grayscale brightness-200">🚨</div>
        </div>

        {/* STATISTIK TIKET */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-t-[5px] border-t-amber-500 flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Menunggu Respons</h3>
              <div className="text-3xl font-black text-amber-500 mt-1">{totalMenunggu}</div>
            </div>
            <div className="text-3xl opacity-50">⏳</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-t-[5px] border-t-blue-500 flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sedang Diproses</h3>
              <div className="text-3xl font-black text-blue-500 mt-1">{totalDiproses}</div>
            </div>
            <div className="text-3xl opacity-50">🛠️</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-2">
          
          {/* DAFTAR TIKET LAPORAN */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 h-fit">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">📥 Kotak Masuk Laporan</h2>
            
            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
              {laporanList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold italic border-2 border-dashed border-slate-200 rounded-xl">Hore! Belum ada keluhan atau laporan dari warga.</div>
              ) : (
                laporanList.map((l) => (
                  <div key={l.id} onClick={() => bukaPanelTanggapan(l)} className={`p-5 border-2 rounded-xl cursor-pointer transition-all ${laporanAktif?.id === l.id ? 'border-rose-400 bg-rose-50' : 'border-slate-100 bg-slate-50 hover:border-rose-200 hover:bg-white'} shadow-sm`}>
                    
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div>
                        <h3 className="font-black text-slate-800 text-lg leading-tight">{l.judul_laporan}</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                          Pelapor: <span className="text-slate-600">{l.warga?.nama_lengkap}</span> • {new Date(l.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded shadow-sm shrink-0 ${
                        (!l.status || l.status === 'Menunggu') ? 'bg-amber-100 text-amber-700' :
                        l.status === 'Diproses' ? 'bg-blue-100 text-blue-700' :
                        l.status === 'Selesai' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {l.status || 'Menunggu'}
                      </span>
                    </div>
                    
                    <p className="text-slate-600 text-xs leading-relaxed line-clamp-2">{l.deskripsi}</p>
                    
                    {l.tanggapan_rt && (
                      <div className="mt-4 pt-3 border-t border-slate-200/60">
                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest bg-rose-100 px-2 py-0.5 rounded mr-2">Tanggapan RT</span>
                        <span className="text-[10px] text-slate-500 font-bold truncate">{l.tanggapan_rt}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* PANEL TANGGAPAN (Tampil jika ada tiket yang diklik) */}
          <div className="lg:col-span-1">
            {laporanAktif ? (
              <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-rose-500 sticky top-6">
                <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-3">
                  <h2 className="font-black text-lg text-rose-600">Tindak Lanjut</h2>
                  <button onClick={tutupPanel} className="text-slate-400 hover:text-rose-500 font-bold text-xl leading-none">&times;</button>
                </div>
                
                <div className="mb-5 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h3 className="font-black text-slate-800 text-sm mb-2">{laporanAktif.judul_laporan}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{laporanAktif.deskripsi}</p>
                </div>

                <form onSubmit={handleSimpan} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Update Status</label>
                    <select className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-rose-500 text-sm font-bold text-slate-700" value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="Menunggu">Menunggu Respons ⏳</option>
                      <option value="Diproses">Sedang Diproses 🛠️</option>
                      <option value="Selesai">Telah Selesai ✅</option>
                      <option value="Ditolak">Ditolak / Batal ❌</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Tanggapan Resmi Pengurus</label>
                    <textarea required rows={5} className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-rose-500 text-sm text-slate-800" placeholder="Ketik jawaban atau tindak lanjut dari laporan ini..." value={tanggapan} onChange={(e) => setTanggapan(e.target.value)} />
                  </div>
                  
                  <button type="submit" disabled={loadingId === laporanAktif.id} className={`w-full text-white font-black rounded-lg p-3.5 shadow-md mt-2 transition-colors ${loadingId === laporanAktif.id ? 'bg-slate-400' : 'bg-rose-600 hover:bg-rose-700'}`}>
                    {loadingId === laporanAktif.id ? "Menyimpan..." : "Simpan Tanggapan"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-slate-100 p-8 rounded-2xl border-2 border-dashed border-slate-300 text-center flex flex-col items-center justify-center h-full min-h-[300px]">
                <div className="text-4xl grayscale opacity-30 mb-3">👈</div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Klik salah satu tiket<br/>untuk memberikan tanggapan</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}