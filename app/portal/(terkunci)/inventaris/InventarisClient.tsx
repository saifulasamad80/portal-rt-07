"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function InventarisClient({ masterBarang, riwayat, jadwalTerisi, ajukanBooking }: { masterBarang: any[], riwayat: any[], jadwalTerisi: any[], ajukanBooking: any }) {
  const [submitLoading, setSubmitLoading] = useState(false);
  const router = useRouter();

  const [namaBarang, setNamaBarang] = useState(""); 
  const [tanggal, setTanggal] = useState("");
  const [keterangan, setKeterangan] = useState("");

  // FUNGSI RADAR: Mengecek apakah barang X di tanggal Y sudah di-booking
  const isTanggalBentrok = () => {
    if (!namaBarang || !tanggal) return false;
    return jadwalTerisi.some(j => j.nama_barang === namaBarang && j.tanggal_pinjam === tanggal);
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Gembok Front-End mencegah tombol klik
    if (isTanggalBentrok()) {
      alert(`⚠️ TANGGAL BENTROK!\n\nBarang "${namaBarang}" sudah di-booking oleh warga lain pada tanggal ini. Silakan cari tanggal kosong.`);
      return;
    }

    setSubmitLoading(true);
    try {
      await ajukanBooking(namaBarang, tanggal, keterangan);
      alert("✅ Booking berhasil diajukan! Menunggu persetujuan RT.");
      setNamaBarang(""); setTanggal(""); setKeterangan("");
      router.refresh();
    } catch (error: any) {
      alert(error.message); // Akan menampilkan error merah dari Backend
    }
    setSubmitLoading(false);
  };

  const getStatusColor = (status: string) => {
    if (status === 'Disetujui') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'Ditolak') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (status === 'Dikembalikan') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-amber-100 text-amber-700 border-amber-200'; 
  };

  const statusBentrok = isTanggalBentrok();

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <Link href="/portal" className="text-amber-700 font-bold hover:underline mb-2 inline-block text-sm">&larr; Kembali ke Dasbor Warga</Link>
        
        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-amber-500 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Inventaris RT & Peminjaman</h1>
            <p className="text-slate-400 text-sm">Fasilitas milik bersama warga RT 07. Booking lebih awal agar tidak bentrok.</p>
          </div>
          <div className="text-5xl hidden md:block grayscale brightness-200 opacity-80">🎪</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 h-fit border-t-[6px] border-t-amber-500">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">📅 Form Peminjaman Warga</h2>
            <form onSubmit={handleBooking} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Pilih Fasilitas / Barang</label>
                <select required className="w-full border-2 border-slate-200 rounded-lg p-3.5 bg-white text-slate-900 font-bold outline-none focus:border-amber-500" value={namaBarang} onChange={(e) => setNamaBarang(e.target.value)}>
                  <option value="" disabled>-- Daftar Barang Tersedia --</option>
                  {masterBarang.map(b => (
                    <option key={b.id} value={b.nama_barang}>{b.nama_barang} (Total Stok: {b.total_unit} unit)</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide flex justify-between items-center">
                  Tanggal Pakai
                  {statusBentrok && <span className="text-[10px] text-white bg-rose-600 px-2 py-0.5 rounded animate-pulse">SUDAH DIBOOKING!</span>}
                </label>
                <input 
                  type="date" 
                  required 
                  min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]} 
                  className={`w-full border-2 rounded-lg p-3.5 text-slate-900 font-bold outline-none transition-colors ${statusBentrok ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 focus:border-amber-500'}`} 
                  value={tanggal} 
                  onChange={(e) => setTanggal(e.target.value)} 
                />
                {statusBentrok && (
                  <p className="text-xs text-rose-600 font-bold mt-2">
                    ⛔ Barang ini sudah dipinjam oleh warga lain di tanggal tersebut. Mohon ubah tanggal Anda.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Keperluan / Keterangan</label>
                <input type="text" required className="w-full border-2 border-slate-200 rounded-lg p-3.5 text-slate-900 text-sm outline-none focus:border-amber-500" placeholder="Cth: Acara syukuran keluarga / Kerja bakti" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>
              
              <button type="submit" disabled={submitLoading || masterBarang.length === 0 || statusBentrok} className={`w-full text-white font-black rounded-xl p-4 shadow-md uppercase tracking-widest mt-4 transition-all ${submitLoading || statusBentrok ? 'bg-slate-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700 active:scale-95'}`}>
                {submitLoading ? "Memproses Data..." : (statusBentrok ? "TANGGAL TIDAK TERSEDIA" : "Ajukan Permohonan")}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3 flex items-center gap-2"><span>📂</span> Riwayat Peminjaman Saya</h2>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {riwayat.length === 0 ? (
                <div className="text-center p-8 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-sm font-bold text-slate-500 italic">Belum ada riwayat peminjaman.</p>
                </div>
              ) : (
                riwayat.map(t => (
                  <div key={t.id} className={`p-4 md:p-5 border-2 rounded-xl transition-all hover:shadow-md ${getStatusColor(t.status)}`}>
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-black text-slate-800 text-base">{t.nama_barang}</h3>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded shadow-sm bg-white border ${getStatusColor(t.status).split(' ')[1].replace('text-', 'border-')}`}>
                        {t.status || 'Menunggu RT'}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-2 text-xs font-bold text-slate-700">
                      <div className="flex items-center gap-2 bg-white/60 w-fit px-2.5 py-1.5 rounded-lg border border-white/40">
                        <span className="text-base">📅</span> Pakai: {new Date(t.tanggal_pinjam).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'})}
                      </div>
                      <div className="flex items-center gap-2 bg-white/60 w-fit px-2.5 py-1.5 rounded-lg border border-white/40">
                        <span className="text-base">📝</span> {t.keterangan}
                      </div>
                    </div>
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