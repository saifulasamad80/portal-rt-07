"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function VotingClient({ wargaAktif, votingAktif, suaraKu, aksiPilih }: { wargaAktif: any, votingAktif: any, suaraKu: any, aksiPilih: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handlePilih = async (pilihan: string) => {
    if (!confirm(`Tentukan pilihan Anda pada: ${pilihan}? (Suara tidak bisa diubah)`)) return;
    setLoading(true);
    try {
      await aksiPilih(votingAktif.id, pilihan);
      alert("Terima kasih! Suara Anda telah masuk ke kotak suara digital.");
      router.refresh();
    } catch (error: any) {
      alert("Gagal mengirim suara: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center py-12 font-sans">
      <div className="w-full max-w-2xl">
        <Link href="/portal" className="text-indigo-600 font-bold text-sm hover:underline mb-4 inline-block">&larr; Kembali ke Dasbor</Link>
        
        <div className="bg-white p-8 rounded-2xl shadow-xl border-t-[8px] border-t-indigo-600 text-center relative overflow-hidden">
          
          <h1 className="text-3xl font-black text-slate-800 mb-2">E-Voting Warga RT 07</h1>
          <p className="text-slate-500 text-sm font-bold mb-8">Satu Kepala Keluarga, Satu Suara. Mari tentukan masa depan lingkungan kita.</p>

          {!votingAktif ? (
            <div className="py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <div className="text-5xl grayscale opacity-50 mb-4">📭</div>
              <h2 className="text-lg font-black text-slate-400">Belum Ada Pemilihan Aktif</h2>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl text-left shadow-inner">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-black text-slate-800 leading-tight">{votingAktif.judul}</h2>
                <span className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse shadow-md">Sedang Berlangsung</span>
              </div>
              <p className="text-slate-600 text-sm mb-8 leading-relaxed bg-white p-4 rounded-lg border border-slate-200">{votingAktif.deskripsi}</p>
              
              {suaraKu ? (
                <div className="bg-indigo-100 border border-indigo-200 p-6 rounded-xl text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <h3 className="font-black text-indigo-900 text-lg">Anda Sudah Memilih!</h3>
                  <p className="text-indigo-700 text-xs mt-1 font-bold">Pilihan Anda: <span className="uppercase bg-indigo-200 px-2 py-1 rounded">{suaraKu.pilihan}</span></p>
                  <p className="text-slate-500 text-[10px] mt-4">Waktu memilih: {new Date(suaraKu.created_at).toLocaleString('id-ID')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button onClick={() => handlePilih(votingAktif.opsi_1)} disabled={loading} className="group bg-white hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 p-6 rounded-xl transition-all shadow-sm hover:shadow-md text-left flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-slate-100 group-hover:bg-indigo-100 rounded-full flex items-center justify-center text-xl font-black text-slate-400 group-hover:text-indigo-600 mb-3 transition-colors">1</div>
                    <span className="font-black text-slate-800 text-lg">{votingAktif.opsi_1}</span>
                  </button>
                  <button onClick={() => handlePilih(votingAktif.opsi_2)} disabled={loading} className="group bg-white hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 p-6 rounded-xl transition-all shadow-sm hover:shadow-md text-left flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-slate-100 group-hover:bg-indigo-100 rounded-full flex items-center justify-center text-xl font-black text-slate-400 group-hover:text-indigo-600 mb-3 transition-colors">2</div>
                    <span className="font-black text-slate-800 text-lg">{votingAktif.opsi_2}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}