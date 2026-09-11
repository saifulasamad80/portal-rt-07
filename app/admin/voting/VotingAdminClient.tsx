"use client";
import { useState } from "react";
import TautanHalus from "@/components/TautanHalus";
import { useRouter } from "next/navigation";

export default function VotingAdminClient({ daftarVoting, aksiBuatTopik, aksiToggleStatus }: { daftarVoting: any[], aksiBuatTopik: any, aksiToggleStatus: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ judul: "", deskripsi: "", opsi_1: "", opsi_2: "" });

  const handleBuatTopik = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm(`Yakin merilis topik "${form.judul}"?`)) return;
    setLoading(true);
    try {
      await aksiBuatTopik(form.judul, form.deskripsi, form.opsi_1, form.opsi_2);
      setForm({ judul: "", deskripsi: "", opsi_1: "", opsi_2: "" });
      router.refresh();
    } catch (error: any) { alert("Gagal: " + error.message); }
    setLoading(false);
  };

  const handleToggle = async (id: string, statusSaatIni: string) => {
    const statusBaru = statusSaatIni === "Aktif" ? "Ditutup" : "Aktif";
    if (!confirm(`Ubah status menjadi: ${statusBaru}?`)) return;
    setLoading(true);
    try { await aksiToggleStatus(id, statusBaru); router.refresh(); } 
    catch (error: any) { alert("Gagal: " + error.message); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-4">
        <TautanHalus href="/admin" className="text-indigo-600 font-bold text-xs hover:underline mb-1 inline-block">&larr; Kembali ke Pusat Komando</TautanHalus>
        
        {/* HEADER COMPACT */}
        <div className="bg-slate-800 p-5 rounded-xl shadow-md border-l-[8px] border-indigo-500 mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black text-white mb-0.5">Manajemen E-Voting RT</h1>
            <p className="text-slate-300 text-xs">Pantau hasil pemilihan warga secara real-time.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* FORM RILIS TOPIK COMPACT */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-fit lg:col-span-1">
            <h2 className="font-black text-slate-800 text-sm flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">➕ Rilis Topik Baru</h2>
            <form onSubmit={handleBuatTopik} className="space-y-3">
              <div><label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Judul Pemilihan</label><input type="text" required className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-indigo-500 text-slate-900" value={form.judul} onChange={e => setForm({...form, judul: e.target.value})} /></div>
              <div><label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Deskripsi Singkat</label><textarea required rows={3} className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-indigo-500 text-slate-900" value={form.deskripsi} onChange={e => setForm({...form, deskripsi: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Opsi 1</label><input type="text" required className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-indigo-500 text-slate-900" value={form.opsi_1} onChange={e => setForm({...form, opsi_1: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Opsi 2</label><input type="text" required className="w-full border border-slate-300 rounded p-2 text-xs outline-none focus:border-indigo-500 text-slate-900" value={form.opsi_2} onChange={e => setForm({...form, opsi_2: e.target.value})} /></div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 text-xs rounded-md shadow-sm transition-colors mt-2">Rilis ke Portal</button>
            </form>
          </div>

          {/* DAFTAR TOPIK COMPACT */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
            <h2 className="font-black text-slate-800 text-sm flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">📋 Daftar Topik Pemilihan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {daftarVoting.map((v) => (
                <div key={v.id} className={`p-4 border rounded-xl flex flex-col justify-between ${v.status === 'Aktif' ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-slate-50 grayscale opacity-80'}`}>
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-black text-indigo-900 text-sm leading-tight">{v.judul}</h3>
                      <span className={`text-[8px] shrink-0 font-black px-2 py-0.5 rounded uppercase tracking-widest ${v.status === 'Aktif' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>{v.status}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-3 line-clamp-2">{v.deskripsi}</p>
                    
                    {/* MINI REKAP */}
                    <div className="bg-white p-3 rounded border border-slate-200 mb-4">
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-[9px] font-bold text-slate-700 mb-1">
                            <span>{v.opsi_1} <span className="text-indigo-500">({v.statistik.opsi_1_count})</span></span>
                            <span>{v.statistik.opsi_1_pct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${v.statistik.opsi_1_pct}%` }}></div></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[9px] font-bold text-slate-700 mb-1">
                            <span>{v.opsi_2} <span className="text-slate-500">({v.statistik.opsi_2_count})</span></span>
                            <span>{v.statistik.opsi_2_pct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-slate-500 h-1.5 rounded-full" style={{ width: `${v.statistik.opsi_2_pct}%` }}></div></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button onClick={() => handleToggle(v.id, v.status)} disabled={loading} className={`w-full py-2 rounded text-[10px] font-bold transition-all border ${v.status === 'Aktif' ? 'bg-white text-rose-500 border-rose-200 hover:bg-rose-50' : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'}`}>
                    {v.status === 'Aktif' ? 'Tutup Sesi Voting' : 'Buka Sesi'}
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}