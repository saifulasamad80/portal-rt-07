"use client";
import { useState } from "react";
import TautanHalus from "@/components/TautanHalus";
import { useRouter } from "next/navigation";

export default function InventarisClient({ masterList, pinjamList, aksiTambah, aksiStatus }: { masterList: any[], pinjamList: any[], aksiTambah: any, aksiStatus: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState("");

  const [namaBarang, setNamaBarang] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [totalUnit, setTotalUnit] = useState("");

  const handleTambahMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await aksiTambah(namaBarang, deskripsi, parseInt(totalUnit));
      setNamaBarang(""); setDeskripsi(""); setTotalUnit("");
      alert("Barang baru masuk inventaris RT!");
      router.refresh();
    } catch (error: any) {
      alert("Gagal menambah barang: " + error.message);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (id: string, status: string, peminjam: string) => {
    if (!confirm(`Tandai peminjaman ${peminjam} sebagai: ${status}?`)) return;
    setLoadingId(id);
    try {
      await aksiStatus(id, status);
      router.refresh();
    } catch (error: any) {
      alert("Gagal update status: " + error.message);
    }
    setLoadingId("");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <TautanHalus href="/admin" className="text-orange-600 font-bold text-sm hover:underline mb-2 inline-block">&larr; Kembali ke Pusat Komando</TautanHalus>

        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-orange-500 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Manajemen Inventaris RT</h1>
            <p className="text-slate-400 text-sm">Kelola aset aset warga (Tenda, Kursi) dan setujui permohonan pinjam.</p>
          </div>
          <div className="text-5xl hidden md:block grayscale brightness-200">🎪</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* PANEL KIRI: INPUT BARANG BARU & DAFTAR MASTER */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-orange-500">
              <h2 className="font-black text-lg text-slate-800 mb-4 border-b border-slate-200 pb-3">📦 Tambah Aset Baru</h2>
              <form onSubmit={handleTambahMaster} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Nama Barang</label>
                  <input type="text" required className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm font-bold outline-none focus:border-orange-500" value={namaBarang} onChange={(e) => setNamaBarang(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Total Unit</label>
                  <input type="number" required min="1" className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm font-mono font-bold outline-none focus:border-orange-500" value={totalUnit} onChange={(e) => setTotalUnit(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Deskripsi Ringkas</label>
                  <input type="text" className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm outline-none focus:border-orange-500" value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
                </div>
                <button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black rounded-lg p-3 shadow-md mt-2 transition-colors">
                  {loading ? "Menyimpan..." : "Simpan Aset"}
                </button>
              </form>
            </div>

            <div className="bg-slate-800 p-6 rounded-2xl shadow-sm text-white">
              <h2 className="font-black text-sm mb-4 border-b border-slate-700 pb-2 text-orange-400">DAFTAR ASET RT 07</h2>
              <ul className="space-y-3">
                {masterList.map(m => (
                  <li key={m.id} className="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-slate-700">
                    <div>
                      <div className="font-bold text-sm">{m.nama_barang}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{m.deskripsi || '-'}</div>
                    </div>
                    <div className="bg-orange-500 text-white font-black text-xs px-2 py-1 rounded">{m.total_unit} Unit</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* PANEL KANAN: TABEL PERMOHONAN PINJAM */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">📑 Antrean Peminjaman Warga</h2>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 text-xs">
                  <tr>
                    <th className="p-4 border-b-2 border-slate-200">Data Peminjam</th>
                    <th className="p-4 border-b-2 border-slate-200">Barang & Keterangan</th>
                    <th className="p-4 border-b-2 border-slate-200 text-center">Status</th>
                    <th className="p-4 border-b-2 border-slate-200 text-center">Aksi Pengurus</th>
                  </tr>
                </thead>
                <tbody>
                  {pinjamList.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold italic">Belum ada warga yang meminjam barang.</td></tr>
                  ) : (
                    pinjamList.map((p) => (
                      <tr key={p.id} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-4 align-top">
                          <div className="font-black text-slate-800 mb-1">{p.warga?.nama_lengkap}</div>
                          <div className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded inline-block">
                            {new Date(p.tanggal_pinjam).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric'})}
                          </div>
                        </td>
                        <td className="p-4 align-top">
                          <div className="font-bold text-orange-600 text-sm">{p.nama_barang}</div>
                          <div className="text-xs text-slate-500 mt-1">{p.keterangan || <span className="italic">Tanpa catatan</span>}</div>
                        </td>
                        <td className="p-4 align-top text-center">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-sm ${
                            !p.status || p.status === 'Menunggu' ? 'bg-amber-100 text-amber-700' :
                            p.status === 'Disetujui' ? 'bg-blue-100 text-blue-700' :
                            p.status === 'Dikembalikan' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {p.status || 'Menunggu'}
                          </span>
                        </td>
                        <td className="p-4 align-top text-center">
                          {(!p.status || p.status === 'Menunggu') && (
                            <div className="flex flex-col gap-2">
                              <button onClick={() => handleUpdateStatus(p.id, 'Disetujui', p.warga?.nama_lengkap)} disabled={loadingId === p.id} className="bg-blue-500 text-white text-[10px] font-bold py-1.5 rounded hover:bg-blue-600 shadow-sm">Setujui</button>
                              <button onClick={() => handleUpdateStatus(p.id, 'Ditolak', p.warga?.nama_lengkap)} disabled={loadingId === p.id} className="bg-rose-500 text-white text-[10px] font-bold py-1.5 rounded hover:bg-rose-600 shadow-sm">Tolak</button>
                            </div>
                          )}
                          {p.status === 'Disetujui' && (
                            <button onClick={() => handleUpdateStatus(p.id, 'Dikembalikan', p.warga?.nama_lengkap)} disabled={loadingId === p.id} className="w-full bg-emerald-500 text-white text-[10px] font-bold py-2 rounded hover:bg-emerald-600 shadow-sm">Tandai Kembali</button>
                          )}
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