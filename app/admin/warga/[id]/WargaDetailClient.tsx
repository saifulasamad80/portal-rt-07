"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

// INJEKSI MUTLAK: SAKELAR DEWA (FEATURE FLAG)
const FITUR_KTP_AKTIF = false;

export default function WargaDetailClient({ warga, aksiVerifikasi }: { warga: any, aksiVerifikasi: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!warga) {
    return <div className="min-h-screen flex flex-col items-center justify-center font-black text-slate-500">BERKAS TIDAK DITEMUKAN ❌</div>;
  }

  const handleVerifikasi = async (status: string) => {
    if (!confirm(`Yakin ingin mengubah status warga ini menjadi: ${status}?`)) return;
    setLoading(true);
    try {
      await aksiVerifikasi(warga.id, status);
      alert(`Warga berhasil di-${status.toLowerCase()}!`);
      router.refresh();
    } catch (error: any) {
      alert("Gagal update status: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans pb-20">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link href="/admin/warga" className="text-blue-600 font-bold text-sm hover:underline mb-2 inline-block">&larr; Kembali ke Buku Induk</Link>

        {/* HEADER STATUS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">{warga.nama_lengkap}</h1>
            {/* INJEKSI MUTLAK: MASKING NIK KEPALA KELUARGA */}
            <p className="text-sm text-slate-500 font-mono font-bold mt-1">
              NIK: {warga.nik ? `${warga.nik.slice(0, 4)}********${warga.nik.slice(-4)}` : '-'}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className={`px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest ${
              warga.status_verifikasi === 'Disetujui' ? 'bg-emerald-100 text-emerald-700' :
              warga.status_verifikasi === 'Ditolak' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700 animate-pulse'
            }`}>
              Status: {warga.status_verifikasi || 'Menunggu'}
            </span>
            
            {(warga.status_verifikasi === 'Menunggu' || !warga.status_verifikasi) && (
              <div className="flex gap-2">
                <button onClick={() => handleVerifikasi('Disetujui')} disabled={loading} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm">Setujui ✅</button>
                <button onClick={() => handleVerifikasi('Ditolak')} disabled={loading} className="bg-rose-500 hover:bg-rose-600 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm">Tolak ❌</button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-blue-500">
            <h2 className="font-black text-slate-800 border-b pb-2 mb-4">👤 Biodata Kepala Keluarga</h2>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3"><span className="text-slate-500 font-bold">TTL</span><span className="col-span-2 font-black text-slate-800">{warga.tempat_lahir}, {warga.tanggal_lahir}</span></div>
              <div className="grid grid-cols-3"><span className="text-slate-500 font-bold">Gender</span><span className="col-span-2 font-black text-slate-800">{warga.jenis_kelamin}</span></div>
              <div className="grid grid-cols-3"><span className="text-slate-500 font-bold">Pekerjaan</span><span className="col-span-2 font-black text-slate-800">{warga.pekerjaan}</span></div>
              
              {/* INJEKSI MUTLAK: MASKING NOMOR WHATSAPP KEPALA KELUARGA */}
              <div className="grid grid-cols-3">
                <span className="text-slate-500 font-bold">WhatsApp</span>
                <span className="col-span-2 font-mono font-bold text-blue-600">
                  {warga.no_whatsapp ? `${warga.no_whatsapp.slice(0, 4)}****${warga.no_whatsapp.slice(-4)}` : '-'}
                </span>
              </div>
              
              <div className="grid grid-cols-3"><span className="text-slate-500 font-bold">Tempat Tinggal</span><span className="col-span-2 font-black text-slate-800">{warga.status_tinggal} <br/><span className="text-xs text-slate-500">{warga.detail_alamat}</span></span></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-emerald-500">
            <h2 className="font-black text-slate-800 border-b pb-2 mb-4">📊 Profil Ekonomi (Validasi Desil)</h2>
            <div className="space-y-3 text-sm">
              <div className="bg-slate-50 p-3 rounded border border-slate-200">
                <span className="text-xs text-slate-500 font-bold block uppercase tracking-widest mb-1">Pendapatan Bulanan</span>
                <span className="font-black text-emerald-700 text-lg">{warga.pendapatan_bulanan || '-'}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded border border-slate-200">
                <span className="text-xs text-slate-500 font-bold block uppercase tracking-widest mb-1">Daya Listrik Terpasang</span>
                <span className="font-black text-amber-600 text-lg">{warga.daya_listrik || '-'}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-2xl shadow-sm text-white md:col-span-2">
            <h2 className="font-black text-slate-200 border-b border-slate-700 pb-2 mb-4">🔒 Brankas Dokumen Digital</h2>
            <div className="flex flex-wrap gap-4">
              {FITUR_KTP_AKTIF && (
                warga.ktp_path && warga.ktp_path !== 'MENYUSUL' ? (
                  // TARGET BLANK DIHAPUS
                  <a href={`/api/admin/dokumen?path=${warga.ktp_path}`} className="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-lg font-bold text-sm border border-slate-600 shadow transition-colors">📄 Lihat KTP Warga</a>
                ) : <div className="bg-rose-900/50 text-rose-300 px-4 py-3 rounded-lg font-bold text-sm border border-rose-800">⚠️ KTP Menyusul (Fisik)</div>
              )}
              
              {warga.kk_path && warga.kk_path !== 'MENYUSUL' ? (
                // TARGET BLANK DIHAPUS
                <a href={`/api/admin/dokumen?path=${warga.kk_path}`} className="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-lg font-bold text-sm border border-slate-600 shadow transition-colors">📄 Lihat Kartu Keluarga</a>
              ) : <div className="bg-rose-900/50 text-rose-300 px-4 py-3 rounded-lg font-bold text-sm border border-rose-800">⚠️ KK Menyusul (Fisik)</div>}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
            <h2 className="font-black text-slate-800 border-b pb-2 mb-4">👥 Daftar Anggota Keluarga ({warga.anggota_keluarga?.length || 0} Orang)</h2>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-100 text-xs text-slate-600">
                  <tr>
                    <th className="p-3 border-b-2">Nama & NIK</th>
                    <th className="p-3 border-b-2">TTL & Gender</th>
                    <th className="p-3 border-b-2">Hubungan</th>
                    <th className="p-3 border-b-2">Pekerjaan</th>
                    {FITUR_KTP_AKTIF && <th className="p-3 border-b-2 text-center">Dokumen KTP</th>}
                  </tr>
                </thead>
                <tbody>
                  {warga.anggota_keluarga?.length === 0 ? (
                    <tr><td colSpan={FITUR_KTP_AKTIF ? 5 : 4} className="p-6 text-center italic text-slate-400 font-bold">Tidak ada tanggungan tercatat.</td></tr>
                  ) : (
                    warga.anggota_keluarga?.map((ak: any) => (
                      <tr key={ak.id} className="border-b hover:bg-slate-50">
                        <td className="p-3">
                          <div className="font-black text-slate-800">{ak.nama_lengkap}</div>
                          {/* INJEKSI MUTLAK: MASKING NIK ANGGOTA KELUARGA */}
                          <div className="font-mono text-[10px] text-slate-500">
                            {ak.nik ? `${ak.nik.slice(0, 4)}********${ak.nik.slice(-4)}` : '-'}
                          </div>
                        </td>
                        <td className="p-3 text-xs">
                          <div className="font-bold">{ak.tempat_lahir}, {ak.tanggal_lahir}</div>
                          <div className="text-slate-500">{ak.jenis_kelamin}</div>
                        </td>
                        <td className="p-3 font-black text-blue-700">{ak.hubungan_keluarga === 'Lainnya' ? ak.hubungan_detail : ak.hubungan_keluarga}</td>
                        <td className="p-3 text-xs font-bold text-slate-600">{ak.pekerjaan || '-'}</td>
                        
                        {FITUR_KTP_AKTIF && (
                          <td className="p-3 text-center">
                            {ak.ktp_path && ak.ktp_path !== 'MENYUSUL' ? (
                              // TARGET BLANK DIHAPUS
                              <a href={`/api/admin/dokumen?path=${ak.ktp_path}`} className="text-[10px] bg-blue-100 text-blue-700 px-3 py-1.5 rounded font-bold hover:bg-blue-200 shadow-sm">Lihat KTP</a>
                            ) : (
                              <span className="text-[9px] text-rose-500 bg-rose-50 border border-rose-100 px-2 py-1 rounded font-bold">Tdk Ada/Menyusul</span>
                            )}
                          </td>
                        )}
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