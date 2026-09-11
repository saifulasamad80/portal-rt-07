"use client";
import { useState } from "react";
import TautanHalus from "@/components/TautanHalus";
import { useRouter } from "next/navigation";

export default function RondaAdminClient({ adminAktif, jadwalList, wargaList, aksiSimpan, aksiHapus }: { adminAktif: any, jadwalList: any[], wargaList: any[], aksiSimpan: any, aksiHapus: any }) {
  const router = useRouter();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState("");

  const [tanggal, setTanggal] = useState("");
  const [wargaId, setWargaId] = useState("");

  // Server Action memakai Result Object Pattern: keberhasilan dibaca dari
  // properti success, bukan dari ada/tidaknya exception.
  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const hasil = await aksiSimpan(wargaId, tanggal);
      if (hasil?.success) {
        setWargaId("");
        alert(hasil.message || "Jadwal berhasil ditambahkan!");
        router.refresh();
      } else {
        alert("Gagal menyimpan jadwal: " + (hasil?.message || "server tidak memberi keterangan."));
      }
    } catch (error: any) { alert("Gagal menyimpan jadwal: " + (error?.message || "kesalahan tidak diketahui")); }
    setSubmitLoading(false);
  };

  const handleHapus = async (id: string, namaWarga: string) => {
    if (!confirm(`Yakin ingin membatalkan jadwal ronda untuk ${namaWarga || "warga ini"}?`)) return;
    setDeleteLoadingId(id);
    try {
      const hasil = await aksiHapus(id);
      if (!hasil?.success) {
        alert("Gagal menghapus jadwal: " + (hasil?.message || "server tidak memberi keterangan."));
      }
      router.refresh();
    } catch (error: any) { alert("Gagal menghapus jadwal: " + (error?.message || "kesalahan tidak diketahui")); }
    setDeleteLoadingId("");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <TautanHalus href="/admin" className="text-slate-600 font-bold text-sm hover:underline mb-2 inline-block">&larr; Kembali ke Pusat Komando</TautanHalus>

        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-amber-500 mb-8 flex justify-between items-center">
          <div><h1 className="text-2xl md:text-3xl font-black text-white mb-1">Manajemen Siskamling</h1><p className="text-slate-400 text-sm">Atur regu ronda malam dan pantau status kehadiran warga.</p></div>
          <div className="text-5xl hidden md:block grayscale brightness-200">🔦</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-2">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit border-t-[6px] border-t-amber-500">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3 flex items-center gap-2">➕ Tambah Regu Tugas</h2>
            <form onSubmit={handleSimpan} className="space-y-4">
              {/* INJEKSI MUTLAK: Kunci Warna bg-white text-slate-900 */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Tanggal Tugas</label>
                <input type="date" required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded-lg p-3 outline-none focus:border-amber-500 text-sm font-bold" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Pilih Petugas (Warga)</label>
                <select required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded-lg p-3 outline-none focus:border-amber-500 text-sm font-bold" value={wargaId} onChange={(e) => setWargaId(e.target.value)}>
                  <option value="">-- Pilih Warga --</option>
                  {wargaList.map(w => <option key={w.id} value={w.id}>{w.nama_lengkap}</option>)}
                </select>
              </div>
              
              <button type="submit" disabled={submitLoading} className={`w-full text-slate-900 font-black rounded-lg p-3.5 shadow-md mt-4 transition-colors ${submitLoading ? 'bg-slate-300' : 'bg-amber-400 hover:bg-amber-500'}`}>
                {submitLoading ? "Memasukkan ke Jadwal..." : "Tetapkan Jadwal"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">📋 Jadwal Siskamling Mendatang</h2>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 text-xs">
                  <tr><th className="p-4 border-b-2 border-slate-200">Tanggal Tugas</th><th className="p-4 border-b-2 border-slate-200">Nama Petugas</th><th className="p-4 border-b-2 border-slate-200">Status & Keterangan</th><th className="p-4 border-b-2 border-slate-200 text-center">Aksi</th></tr>
                </thead>
                <tbody>
                  {jadwalList.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold italic">Belum ada jadwal siskamling yang dibuat.</td></tr>
                  ) : (
                    jadwalList.map((j) => (
                      <tr key={j.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                        <td className="p-4"><div className="font-black text-slate-800 bg-slate-200 px-2 py-1 rounded inline-block">{new Date(j.tanggal_tugas).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div></td>
                        <td className="p-4 font-black text-slate-700">{j.warga?.nama_lengkap}</td>
                        <td className="p-4">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded shadow-sm ${j.status === 'Menunggu Konfirmasi' ? 'bg-slate-200 text-slate-600' : j.status === 'Hadir' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{j.status || 'Menunggu Konfirmasi'}</span>
                          {j.alasan_izin && <div className="text-[10px] text-slate-500 italic mt-2 border-l-2 border-rose-300 pl-2">Alasan: {j.alasan_izin}</div>}
                        </td>
                        <td className="p-4 text-center">
                          <button onClick={() => handleHapus(j.id, j.warga?.nama_lengkap)} disabled={deleteLoadingId === j.id} className="text-[10px] font-bold text-rose-500 hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded transition-colors disabled:opacity-50">Batal</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}