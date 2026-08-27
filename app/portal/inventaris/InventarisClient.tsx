"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function InventarisClient({ masterBarang, riwayat, ajukanBooking }: { masterBarang: any[], riwayat: any[], ajukanBooking: any }) {
  const [submitLoading, setSubmitLoading] = useState(false);
  const router = useRouter();

  // FAKTA: Kita menggunakan nama_barang sesuai skema database lu yang sebenarnya!
  const [namaBarang, setNamaBarang] = useState(""); 
  const [tanggal, setTanggal] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    try {
      await ajukanBooking(namaBarang, tanggal, keterangan);
      alert("Booking berhasil diajukan! Menunggu persetujuan RT.");
      setNamaBarang(""); setTanggal(""); setKeterangan("");
      router.refresh();
    } catch (error: any) {
      alert("Gagal melakukan booking: " + error.message);
    }
    setSubmitLoading(false);
  };

  const getStatusColor = (status: string) => {
    if (status === 'Disetujui') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'Ditolak') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (status === 'Dikembalikan') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-amber-100 text-amber-700 border-amber-200'; 
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/portal" className="text-amber-700 font-bold hover:underline mb-4 inline-block">&larr; Kembali ke Dasbor</Link>
        <div className="bg-white p-6 rounded-xl shadow border-l-8 border-amber-600">
          <h1 className="text-2xl font-bold text-slate-800">Kalender Inventaris RT</h1>
          <p className="text-slate-500 text-sm">Booking fasilitas RT. Pengajuan akan direview oleh pengurus.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-white p-6 rounded-xl shadow h-fit">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Form Booking</h2>
            <form onSubmit={handleBooking} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Fasilitas / Barang</label>
                <select required className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 font-medium" value={namaBarang} onChange={(e) => setNamaBarang(e.target.value)}>
                  <option value="" disabled>-- Daftar Barang Tersedia --</option>
                  {masterBarang.map(b => (
                    <option key={b.id} value={b.nama_barang}>{b.nama_barang} (Total: {b.total_unit} unit)</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tanggal Pakai</label>
                <input type="date" required min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]} className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Keperluan</label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900" placeholder="Cth: Acara syukuran keluarga" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>
              
              <button type="submit" disabled={submitLoading || masterBarang.length === 0} className="w-full bg-amber-600 text-white font-bold rounded-lg p-3 shadow-md hover:bg-amber-700 transition-colors disabled:bg-slate-400 mt-2">
                {submitLoading ? "Mengajukan..." : "Ajukan Booking"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Riwayat Booking Saya</h2>
            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
              {riwayat.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Belum ada riwayat peminjaman.</p>
              ) : (
                riwayat.map(t => (
                  <div key={t.id} className={`p-4 border rounded-lg ${getStatusColor(t.status)}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-slate-800">{t.nama_barang}</h3>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded bg-white/60">
                        {t.status || 'Menunggu'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-700 bg-white/50 inline-block px-2 py-1 rounded">
                      <span>📅 {new Date(t.tanggal_pinjam).toLocaleDateString('id-ID')}</span>
                    </div>

                    <div className="text-sm text-slate-600 italic border-t border-black/10 pt-2 mt-1">"{t.keterangan}"</div>
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