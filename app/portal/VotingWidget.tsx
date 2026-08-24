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
    <div className="space-y-4 mb-6">
      {topikAktif.map((voting) => (
        <div key={voting.id} className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 border-l-[8px] border-indigo-500">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">Penting</span>
            <h2 className="font-black text-xl text-slate-800">{voting.judul}</h2>
          </div>
          <p className="text-slate-600 text-sm mb-6 pb-6 border-b border-slate-300 leading-relaxed">{voting.deskripsi}</p>
          
          {voting.sudahMemilih ? (
            <div className="space-y-6">
              <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 p-4 rounded-xl text-center font-bold text-sm flex items-center justify-center gap-2">
                ✅ Anda sudah menggunakan hak pilih.
              </div>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs font-black text-slate-600 mb-2"><span>{voting.opsi_1}</span><span>{voting.statistik.opsi_1}%</span></div>
                  <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden"><div className="bg-indigo-500 h-full rounded-full transition-all duration-1000" style={{ width: `${voting.statistik.opsi_1}%` }}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-black text-slate-600 mb-2"><span>{voting.opsi_2}</span><span>{voting.statistik.opsi_2}%</span></div>
                  <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden"><div className="bg-slate-500 h-full rounded-full transition-all duration-1000" style={{ width: `${voting.statistik.opsi_2}%` }}></div></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => handleCoblos(voting.id, voting.opsi_1)} disabled={loading} className="py-4 px-6 border-2 border-indigo-200 rounded-xl font-black text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 text-center transition-all flex items-center justify-center gap-2 shadow-sm"><span className="text-blue-500 text-lg">🟦</span> Pilih: {voting.opsi_1}</button>
              <button onClick={() => handleCoblos(voting.id, voting.opsi_2)} disabled={loading} className="py-4 px-6 border-2 border-indigo-200 rounded-xl font-black text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 text-center transition-all flex items-center justify-center gap-2 shadow-sm"><span className="text-blue-500 text-lg">🟦</span> Pilih: {voting.opsi_2}</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}