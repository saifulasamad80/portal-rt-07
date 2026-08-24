"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function VotingClient({ daftarVoting, coblosKandidat }: { daftarVoting: any[], coblosKandidat: any }) {
  const [submitLoading, setSubmitLoading] = useState(false);
  const router = useRouter();

  const handleCoblos = async (votingId: string, pilihanWarga: string) => {
    if (!confirm(`Yakin ingin memberikan suara untuk "${pilihanWarga}"? Suara tidak bisa ditarik kembali!`)) return;
    
    setSubmitLoading(true);
    try {
      await coblosKandidat(votingId, pilihanWarga);
      alert("Suara berhasil masuk secara rahasia ke dalam bilik suara!");
      router.refresh(); // Memaksa server menarik kalkulasi persentase terbaru
    } catch (error: any) {
      alert("Gagal menyimpan suara: " + error.message);
    }
    setSubmitLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/portal" className="text-indigo-600 font-bold hover:underline mb-4 inline-block">&larr; Kembali ke Dasbor</Link>
        <div className="bg-white p-6 rounded-xl shadow border-l-8 border-indigo-500">
          <h1 className="text-2xl font-bold text-slate-800">E-Voting Warga RT 07</h1>
          <p className="text-slate-500 text-sm">Pemungutan suara digital transparan & rahasia.</p>
        </div>
        <div className="space-y-6">
          {daftarVoting.length === 0 ? (
            <div className="bg-white p-8 rounded-xl shadow text-center font-bold text-slate-400 italic">Belum ada topik pemilihan aktif.</div>
          ) : (
            daftarVoting.map((voting) => (
              <div key={voting.id} className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-slate-700">
                <h2 className="font-bold text-xl text-slate-800 mb-2">{voting.judul}</h2>
                <p className="text-slate-600 text-sm mb-6 pb-4 border-b">{voting.deskripsi}</p>
                {voting.sudahMemilih ? (
                  <div className="space-y-4">
                    <div className="bg-indigo-50 text-indigo-800 p-3 rounded-lg text-center font-bold text-sm mb-4">✅ Anda sudah menggunakan hak pilih.</div>
                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-500 mb-1"><span>{voting.opsi_1}</span><span>{voting.statistik.opsi_1}%</span></div>
                      <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden"><div className="bg-indigo-500 h-4 rounded-full transition-all duration-1000" style={{ width: `${voting.statistik.opsi_1}%` }}></div></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-500 mb-1"><span>{voting.opsi_2}</span><span>{voting.statistik.opsi_2}%</span></div>
                      <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden"><div className="bg-slate-500 h-4 rounded-full transition-all duration-1000" style={{ width: `${voting.statistik.opsi_2}%` }}></div></div>
                    </div>
                    <div className="text-right text-[10px] text-slate-400 font-bold mt-2">Total Suara Masuk: {voting.statistik.total}</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={() => handleCoblos(voting.id, voting.opsi_1)} disabled={submitLoading} className="p-4 border-2 border-indigo-200 rounded-xl font-bold text-indigo-700 hover:bg-indigo-50 text-center transition-colors">🗳️ Pilih: {voting.opsi_1}</button>
                    <button onClick={() => handleCoblos(voting.id, voting.opsi_2)} disabled={submitLoading} className="p-4 border-2 border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 text-center transition-colors">🗳️ Pilih: {voting.opsi_2}</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}