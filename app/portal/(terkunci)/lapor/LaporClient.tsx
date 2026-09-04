"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LaporClient({ warga, initialLaporan, kirimLaporan }: { warga: any, initialLaporan: any[], kirimLaporan: any }) {
  const [submitLoading, setSubmitLoading] = useState(false);
  const router = useRouter();

  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");

  const handleKirimLaporan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    try {
      // FAKTA: Menjalankan Server Action, bukan client supabase fetch
      await kirimLaporan(judul, deskripsi);
      alert("Laporan berhasil dikirim ke Pengurus RT!");
      setJudul(""); 
      setDeskripsi("");
      // FAKTA: Memaksa server memuat ulang data terbaru secara otomatis dari database
      router.refresh(); 
    } catch (error: any) {
      alert("Gagal mengirim laporan: " + error.message);
    }
    setSubmitLoading(false);
  };

  const getStatusColor = (status: string) => {
    if (status === 'Selesai') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'Diproses') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/portal" className="text-rose-600 font-bold hover:underline mb-4 inline-block">&larr; Kembali ke Dasbor</Link>
        <div className="bg-white p-6 rounded-xl shadow border-l-8 border-rose-500">
          <h1 className="text-2xl font-bold text-slate-800">Sistem Lapor Warga RT 07</h1>
          <p className="text-slate-500 text-sm">Laporkan kerusakan fasilitas umum.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow h-fit">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Buat Laporan Baru</h2>
            <form onSubmit={handleKirimLaporan} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Judul Laporan</label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2 text-slate-900" placeholder="Cth: Lampu Tiang No. 4 Mati" value={judul} onChange={(e) => setJudul(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Detail Lokasi & Kejadian</label>
                <textarea required rows={4} className="w-full border border-slate-300 rounded-lg p-2 text-slate-900" placeholder="Deskripsikan..." value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)}></textarea>
              </div>
              <button type="submit" disabled={submitLoading} className="w-full bg-rose-600 text-white font-bold rounded-lg p-3 shadow hover:bg-rose-700 transition-colors">
                {submitLoading ? "Mengirim..." : "Kirim Laporan"}
              </button>
            </form>
          </div>
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Status Laporan Saya</h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {initialLaporan.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Anda belum pernah membuat laporan.</p>
              ) : (
                initialLaporan.map(t => (
                  <div key={t.id} className={`p-4 border rounded-lg ${getStatusColor(t.status)}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold">{t.judul_laporan}</h3>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded bg-white/50">{t.status || 'Menunggu'}</span>
                    </div>
                    <p className="text-sm opacity-80 mb-2">{t.deskripsi}</p>
                    {t.tanggapan_rt && (
                      <div className="mt-2 pt-2 border-t border-black/10">
                        <span className="text-xs font-bold block mb-1">Respon Pengurus RT:</span>
                        <p className="text-sm font-medium italic">"{t.tanggapan_rt}"</p>
                      </div>
                    )}
                    <div className="text-[10px] font-bold mt-3 opacity-60 text-right">Dikirim: {new Date(t.created_at).toLocaleDateString('id-ID')}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}