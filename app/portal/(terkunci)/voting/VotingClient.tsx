"use client";
import { useState } from "react";
import TautanHalus from "@/components/TautanHalus";
import { useRouter } from "next/navigation";
import PesanDialog, { type PesanDialogData } from "@/components/PesanDialog";

export default function VotingClient({ wargaAktif, votingAktif, suaraKu, aksiPilih }: { wargaAktif: any, votingAktif: any, suaraKu: any, aksiPilih: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<PesanDialogData | null>(null);

  const handlePilih = async (pilihan: string) => {
    if (!confirm(`Tentukan pilihan Anda pada: ${pilihan}? (Suara tidak bisa diubah)`)) return;
    setLoading(true);
    try {
      await aksiPilih(votingAktif.id, pilihan);
      setPesan({
        tipe: "sukses",
        judul: "Suara berhasil dikirim",
        teks: "Pilihan Anda sudah masuk ke kotak suara digital dan tidak dapat diubah.",
      });
      router.refresh();
    } catch (error: any) {
      setPesan({
        tipe: "gagal",
        judul: "Suara belum dapat dikirim",
        teks: error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui.",
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center py-12 font-sans">
      <div className="w-full max-w-2xl">
        <TautanHalus href="/portal" className="text-indigo-600 font-bold text-sm hover:underline mb-6 inline-block">&larr; Kembali ke Dasbor</TautanHalus>
        
        {/* REVISI UX: Hapus border-t-[8px], ganti dengan shadow elegan */}
        <div className="bg-white p-8 md:p-10 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 text-center relative overflow-hidden transition-all duration-300">
          
          {/* Aksen visual halus pengganti border tebal */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500"></div>

          <h1 className="text-3xl font-black text-slate-800 mb-2 mt-2">E-Voting Warga RT 07</h1>
          <p className="text-slate-500 text-sm font-medium mb-10">Satu Kepala Keluarga, Satu Suara. Mari tentukan masa depan lingkungan kita.</p>

          {!votingAktif ? (
            <div className="py-12 border border-dashed border-slate-300 rounded-xl bg-slate-50">
              <div className="text-5xl grayscale opacity-50 mb-4">📭</div>
              <h2 className="text-lg font-black text-slate-400">Belum Ada Pemilihan Aktif</h2>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-100 p-6 md:p-8 rounded-xl text-left shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
                <h2 className="text-xl font-black text-slate-800 leading-tight">{votingAktif.judul}</h2>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest animate-pulse border border-emerald-200 shadow-sm shrink-0">
                  Sedang Berlangsung
                </span>
              </div>
              <p className="text-slate-600 text-sm mb-8 leading-relaxed bg-white p-5 rounded-lg border border-slate-100">{votingAktif.deskripsi}</p>
              
              {suaraKu ? (
                <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-xl text-center shadow-sm">
                  <div className="text-4xl mb-4">✅</div>
                  <h3 className="font-black text-indigo-900 text-lg">Anda Sudah Memilih!</h3>
                  <p className="text-indigo-700 text-sm mt-2 font-medium">Pilihan Anda: <span className="uppercase bg-indigo-200 px-3 py-1 rounded font-bold ml-1">{suaraKu.pilihan}</span></p>
                  <p className="text-slate-400 text-[10px] mt-6 font-bold uppercase tracking-widest">Waktu memilih: {new Date(suaraKu.created_at).toLocaleString('id-ID')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* REVISI UX: Tambah active:scale-95 dan haluskan border */}
                  <button onClick={() => handlePilih(votingAktif.opsi_1)} disabled={loading} className="group bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 p-6 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md text-left flex flex-col items-center text-center active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                    <div className="w-14 h-14 bg-slate-50 group-hover:bg-indigo-100 border border-slate-100 group-hover:border-indigo-200 rounded-full flex items-center justify-center text-2xl font-black text-slate-300 group-hover:text-indigo-600 mb-4 transition-colors">1</div>
                    <span className="font-black text-slate-700 group-hover:text-slate-900 text-lg">{votingAktif.opsi_1}</span>
                  </button>
                  <button onClick={() => handlePilih(votingAktif.opsi_2)} disabled={loading} className="group bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 p-6 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md text-left flex flex-col items-center text-center active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                    <div className="w-14 h-14 bg-slate-50 group-hover:bg-indigo-100 border border-slate-100 group-hover:border-indigo-200 rounded-full flex items-center justify-center text-2xl font-black text-slate-300 group-hover:text-indigo-600 mb-4 transition-colors">2</div>
                    <span className="font-black text-slate-700 group-hover:text-slate-900 text-lg">{votingAktif.opsi_2}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <PesanDialog pesan={pesan} onClose={() => setPesan(null)} />
    </div>
  );
}
