"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VotingWidget({ topikAktif, coblosKandidat }: { topikAktif: any[], coblosKandidat: any }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCoblos = async (votingId: string, pilihanWarga: string) => {
    if (!confirm(`Yakin ingin memberikan suara untuk "${pilihanWarga}"? Suara tidak bisa ditarik kembali!`)) return;
    setLoading(true);
    try {
      await coblosKandidat(votingId, pilihanWarga);
      router.refresh(); 
    } catch (error: any) { alert("Gagal: " + error.message); }
    setLoading(false);
  };

  if (topikAktif.length === 0) return null;

  return (
    <div className="space-y-6 mb-8">
      {topikAktif.map((voting) => (
        // REVISI UX: Hapus border-l-[8px], ganti ke standar shadow dan border tipis
        <div key={voting.id} className="bg-white p-6 md:p-8 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 transition-all duration-300 hover:shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-rose-100 text-rose-700 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest animate-pulse">Penting</span>
            <h2 className="font-black text-xl text-slate-800">{voting.judul}</h2>
          </div>
          <p className="text-slate-500 text-sm mb-6 pb-6 border-b border-slate-100 leading-relaxed">{voting.deskripsi}</p>
          
          {voting.sudahMemilih ? (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-4 rounded-xl text-center font-bold text-sm flex items-center justify-center gap-2 shadow-sm">
                ✅ Anda sudah menggunakan hak pilih.
              </div>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-black text-slate-600 mb-2"><span>{voting.opsi_1}</span><span className="text-indigo-600">{voting.statistik.opsi_1}%</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden"><div className="bg-indigo-500 h-full rounded-full transition-all duration-1000" style={{ width: `${voting.statistik.opsi_1}%` }}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-black text-slate-600 mb-2"><span>{voting.opsi_2}</span><span className="text-slate-500">{voting.statistik.opsi_2}%</span></div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden"><div className="bg-slate-400 h-full rounded-full transition-all duration-1000" style={{ width: `${voting.statistik.opsi_2}%` }}></div></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => handleCoblos(voting.id, voting.opsi_1)} disabled={loading} className="py-4 px-6 border border-slate-200 rounded-xl font-black text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-center transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="text-2xl">🗳️</span> Pilih: {voting.opsi_1}
              </button>
              <button onClick={() => handleCoblos(voting.id, voting.opsi_2)} disabled={loading} className="py-4 px-6 border border-slate-200 rounded-xl font-black text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-center transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="text-2xl">🗳️</span> Pilih: {voting.opsi_2}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}