"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function WargaAdminClient({ wargaList, aksiHapus }: { wargaList: any[], aksiHapus: any }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState("");

  const filteredWarga = wargaList.filter(w => 
    w.nama_lengkap.toLowerCase().includes(search.toLowerCase()) || 
    w.nik.includes(search)
  );

  const handleHapus = async (id: string, nama: string) => {
    if (!confirm(`PERINGATAN FATAL: Menghapus data ${nama} akan menghapus SEMUA data kas, sampah, laporan, dan siskamling yang terkait dengan warga ini (Cascade Delete). YAKIN?`)) return;
    
    setLoadingId(id);
    try {
      await aksiHapus(id);
      router.refresh();
    } catch (error: any) {
      alert("Gagal menghapus warga: " + error.message);
    }
    setLoadingId("");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-blue-600 font-bold text-sm hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        {/* HEADER BUKU INDUK */}
        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-blue-500 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Buku Induk Warga</h1>
            <p className="text-slate-400 text-sm">Database demografi, kontak, dan dokumen kependudukan RT 07.</p>
          </div>
          <div className="text-5xl hidden md:block grayscale brightness-200">👥</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-blue-500">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b border-slate-200 pb-4">
            <h2 className="font-black text-xl text-slate-800">Daftar Warga Terdaftar</h2>
            <div className="w-full md:w-72">
              <input 
                type="text" 
                placeholder="🔍 Cari Nama atau NIK..." 
                className="w-full border-2 border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-blue-500 bg-slate-50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[700px] overflow-y-auto custom-scrollbar rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 text-xs">
                <tr>
                  <th className="p-4 border-b-2 border-slate-200 whitespace-nowrap">Nama & Kontak</th>
                  <th className="p-4 border-b-2 border-slate-200">Demografi & Status</th>
                  <th className="p-4 border-b-2 border-slate-200">Anggota Keluarga</th>
                  <th className="p-4 border-b-2 border-slate-200">Dokumen Validasi</th>
                  <th className="p-4 border-b-2 border-slate-200 text-center">Aksi (Bahaya)</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarga.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold italic">Tidak ada data warga ditemukan.</td></tr>
                ) : (
                  filteredWarga.map((w) => (
                    <tr key={w.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                      <td className="p-4 align-top">
                        <div className="font-black text-slate-800 text-base mb-1">{w.nama_lengkap}</div>
                        <div className="text-[10px] text-slate-500 font-mono font-bold bg-slate-200 px-2 py-0.5 rounded w-fit mb-1">NIK: {w.nik}</div>
                        <div className="text-[10px] text-slate-500 font-mono font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded w-fit">WA: {w.no_whatsapp}</div>
                      </td>
                      <td className="p-4 align-top">
                        <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider block w-fit mb-1.5 shadow-sm">
                          {w.status_tinggal}
                        </span>
                        <div className="text-xs text-slate-600 max-w-[200px] leading-relaxed">{w.detail_alamat}</div>
                      </td>
                      <td className="p-4 align-top">
                        {(!w.anggota_keluarga || w.anggota_keluarga.length === 0) ? (
                          <span className="text-xs italic text-slate-400 font-bold">Tidak ada tanggungan</span>
                        ) : (
                          <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                            {w.anggota_keluarga.map((ak: any) => (
                              <li key={ak.id}><b>{ak.nama_lengkap}</b> <span className="text-[10px] text-slate-400">({ak.hubungan_keluarga})</span></li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-col gap-1.5">
                          {w.ktp_path && w.ktp_path !== 'MENYUSUL' ? (
                            <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/dokumen_warga/${w.ktp_path}`} target="_blank" className="text-[10px] bg-slate-800 text-white px-3 py-1.5 rounded font-bold hover:bg-slate-700 transition-colors shadow-sm text-center">📄 KTP Warga</a>
                          ) : (
                            <span className="text-[10px] bg-rose-50 text-rose-500 px-3 py-1.5 rounded font-bold border border-rose-100 text-center">KTP Fisik/Menyusul</span>
                          )}
                          {w.kk_path && w.kk_path !== 'MENYUSUL' ? (
                            <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/dokumen_warga/${w.kk_path}`} target="_blank" className="text-[10px] bg-slate-800 text-white px-3 py-1.5 rounded font-bold hover:bg-slate-700 transition-colors shadow-sm text-center">📄 Kartu Keluarga</a>
                          ) : (
                            <span className="text-[10px] bg-rose-50 text-rose-500 px-3 py-1.5 rounded font-bold border border-rose-100 text-center">KK Fisik/Menyusul</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-top text-center">
                        <button onClick={() => handleHapus(w.id, w.nama_lengkap)} disabled={loadingId === w.id} className="bg-rose-100 hover:bg-rose-500 hover:text-white text-rose-600 border border-rose-200 text-[10px] font-black px-4 py-2 rounded transition-colors shadow-sm disabled:opacity-50 uppercase tracking-wider w-full">
                          {loadingId === w.id ? 'Memproses...' : 'Hapus Warga'}
                        </button>
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
  );
}