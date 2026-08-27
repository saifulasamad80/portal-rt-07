"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LapakAdminClient({ adminAktif, daftarLapak, aksiValidasi }: { adminAktif: any, daftarLapak: any[], aksiValidasi: any }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState("");

  const handleValidasi = async (id: string, status: string, namaLapak: string) => {
    if (!confirm(`Tandai lapak "${namaLapak}" sebagai: ${status}?`)) return;
    setLoadingId(id);
    try {
      await aksiValidasi(id, status);
      router.refresh();
    } catch (error: any) {
      alert("Gagal memvalidasi: " + error.message);
    }
    setLoadingId("");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link href="/admin" className="text-orange-600 font-bold text-sm hover:underline mb-2 inline-block">&larr; Kembali ke Pusat Komando</Link>

        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-orange-500 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Validasi Pasar Warga</h1>
            <p className="text-slate-400 text-sm">Review dan setujui pendaftaran lapak jualan warga sebelum tampil di portal.</p>
          </div>
          <div className="text-5xl hidden md:block grayscale brightness-200">🏪</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">Daftar Pengajuan Etalase UMKM</h2>
          <div className="overflow-x-auto max-h-[700px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 text-xs">
                <tr>
                  <th className="p-4 border-b-2 border-slate-200">Pemilik & Usaha</th>
                  <th className="p-4 border-b-2 border-slate-200 w-[150px]">Foto Brosur</th>
                  <th className="p-4 border-b-2 border-slate-200">Deskripsi Jualan</th>
                  <th className="p-4 border-b-2 border-slate-200 text-center">Status Validasi</th>
                </tr>
              </thead>
              <tbody>
                {daftarLapak.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold italic">Belum ada warga yang mendaftarkan usaha.</td></tr>
                ) : (
                  daftarLapak.map((l) => (
                    <tr key={l.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="p-4 align-top">
                        <div className="font-black text-slate-800 text-base">{l.nama_usaha}</div>
                        <div className="text-[10px] text-slate-500 font-bold mb-2 uppercase">{l.kategori}</div>
                        <div className="text-xs text-slate-600 bg-slate-200 px-2 py-1 rounded inline-block font-medium">👤 {l.warga?.nama_lengkap}</div>
                        <div className="text-xs text-emerald-700 font-mono font-bold mt-1">📞 {l.nomor_wa}</div>
                      </td>
                      <td className="p-4 align-top">
                        <img src={l.foto_url} alt="Brosur" className="w-24 h-24 object-cover rounded-xl shadow-sm border border-slate-200" />
                      </td>
                      <td className="p-4 align-top text-xs text-slate-600 leading-relaxed max-w-[250px]">
                        {l.deskripsi}
                      </td>
                      <td className="p-4 align-top text-center">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded shadow-sm inline-block w-full mb-3 ${l.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : l.status === 'Ditolak' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700 animate-pulse'}`}>
                          {l.status}
                        </span>
                        
                        {(l.status === 'Menunggu' || !l.status) && (
                          <div className="flex flex-col gap-2">
                            <button onClick={() => handleValidasi(l.id, 'Aktif', l.nama_usaha)} disabled={loadingId === l.id} className="bg-emerald-500 text-white text-[10px] font-bold py-2 rounded hover:bg-emerald-600 shadow-sm transition-colors">Setujui Layak Tayang</button>
                            <button onClick={() => handleValidasi(l.id, 'Ditolak', l.nama_usaha)} disabled={loadingId === l.id} className="bg-white text-rose-500 border border-rose-200 text-[10px] font-bold py-2 rounded hover:bg-rose-50 transition-colors">Tolak Pendaftaran</button>
                          </div>
                        )}
                        {l.status === 'Aktif' && (
                          <button onClick={() => handleValidasi(l.id, 'Menunggu', l.nama_usaha)} disabled={loadingId === l.id} className="text-[10px] text-slate-400 font-bold underline hover:text-slate-700 transition-colors">Batalkan / Turunkan</button>
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
  );
}