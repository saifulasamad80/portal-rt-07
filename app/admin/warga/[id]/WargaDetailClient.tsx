"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const FITUR_KTP_AKTIF = false;

export default function WargaDetailClient({ warga, aksiVerifikasi, aksiEdit }: { warga: any, aksiVerifikasi: any, aksiEdit: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  // State untuk form edit
  const [formData, setFormData] = useState({
    nama_lengkap: warga?.nama_lengkap || "",
    tempat_lahir: warga?.tempat_lahir || "",
    tanggal_lahir: warga?.tanggal_lahir || "",
    jenis_kelamin: warga?.jenis_kelamin || "Laki-Laki",
    pekerjaan: warga?.pekerjaan || "",
    no_whatsapp: warga?.no_whatsapp || "",
    status_tinggal: warga?.status_tinggal || "Warga Tetap",
    detail_alamat: warga?.detail_alamat || "",
    pendapatan_bulanan: warga?.pendapatan_bulanan || "",
    daya_listrik: warga?.daya_listrik || "",
  });

  if (!warga) return <div className="min-h-screen flex flex-col items-center justify-center font-black text-slate-500">BERKAS TIDAK DITEMUKAN ❌</div>;

  const handleVerifikasi = async (status: string) => {
    if (!confirm(`Yakin ingin mengubah status warga ini menjadi: ${status}?`)) return;
    setLoading(true);
    try { await aksiVerifikasi(warga.id, status); alert(`Warga berhasil di-${status.toLowerCase()}!`); router.refresh(); } 
    catch (error: any) { alert("Gagal update status: " + error.message); }
    setLoading(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await aksiEdit(warga.id, formData);
      alert("Data warga berhasil diperbarui!");
      setIsEditOpen(false);
      router.refresh();
    } catch (error: any) {
      alert("Gagal memperbarui data: " + error.message);
    }
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const formatWA = (nomor: string) => {
    if (!nomor) return "";
    let bersih = nomor.replace(/\D/g, '');
    if (bersih.startsWith('0')) bersih = '62' + bersih.slice(1);
    return bersih;
  };

  // INJEKSI MUTLAK: Fungsi Intelijen Pengecekan Dokumen
  const renderDokumenBadge = (path: string | null, label: string) => {
    if (!path || path === "MENYUSUL") {
      return <div className="bg-rose-900/50 text-rose-300 px-4 py-3 rounded-lg font-bold text-sm border border-rose-800">⚠️ {label} Menyusul (Fisik)</div>;
    }
    if (path === "-") {
      return <div className="bg-slate-700 text-slate-400 px-4 py-3 rounded-lg font-bold text-sm border border-slate-600 italic">🗄️ {label} Telah Diarsip / Dikosongkan</div>;
    }
    return <a href={`/api/admin/dokumen?path=${path}`} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-500 px-4 py-3 rounded-lg font-bold text-sm border border-blue-500 shadow transition-colors text-white">📄 Lihat {label}</a>;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans pb-20 relative">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link href="/admin/warga" className="text-blue-600 font-bold text-sm hover:underline mb-2 inline-block">&larr; Kembali ke Buku Induk</Link>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800">{warga.nama_lengkap}</h1>
            <p className="text-sm text-slate-500 font-mono font-bold mt-1">NIK: {warga.nik ? `${warga.nik.slice(0, 4)}********${warga.nik.slice(-4)}` : '-'}</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <span className={`px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest ${warga.status_verifikasi === 'Disetujui' ? 'bg-emerald-100 text-emerald-700' : warga.status_verifikasi === 'Ditolak' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700 animate-pulse'}`}>
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
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-blue-500 relative">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <h2 className="font-black text-slate-800">👤 Biodata Kepala Keluarga</h2>
              <button onClick={() => setIsEditOpen(true)} className="bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-bold px-3 py-1 rounded shadow-sm transition-colors">
                ✏️ Edit Biodata
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3"><span className="text-slate-500 font-bold">TTL</span><span className="col-span-2 font-black text-slate-800">{warga.tempat_lahir}, {warga.tanggal_lahir}</span></div>
              <div className="grid grid-cols-3"><span className="text-slate-500 font-bold">Gender</span><span className="col-span-2 font-black text-slate-800">{warga.jenis_kelamin}</span></div>
              <div className="grid grid-cols-3"><span className="text-slate-500 font-bold">Pekerjaan</span><span className="col-span-2 font-black text-slate-800">{warga.pekerjaan}</span></div>
              
              <div className="grid grid-cols-3 items-center">
                <span className="text-slate-500 font-bold">WhatsApp</span>
                <span className="col-span-2">
                  {warga.no_whatsapp && warga.no_whatsapp !== "-" ? (
                    <a href={`https://wa.me/${formatWA(warga.no_whatsapp)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 w-fit bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1 rounded-md border border-emerald-200 font-mono font-bold transition-colors shadow-sm">
                      💬 {warga.no_whatsapp}
                    </a>
                  ) : <span className="font-mono text-slate-400">-</span>}
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
              {FITUR_KTP_AKTIF && renderDokumenBadge(warga.ktp_path, "KTP")}
              {renderDokumenBadge(warga.kk_path, "Kartu Keluarga")}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-2">
            <h2 className="font-black text-slate-800 border-b pb-2 mb-4">👥 Daftar Anggota Keluarga ({warga.anggota_keluarga?.length || 0} Orang)</h2>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-100 text-xs text-slate-600">
                  <tr><th className="p-3 border-b-2">Nama & NIK</th><th className="p-3 border-b-2">TTL & Gender</th><th className="p-3 border-b-2">Hubungan</th><th className="p-3 border-b-2">Pekerjaan</th>{FITUR_KTP_AKTIF && <th className="p-3 border-b-2 text-center">Dokumen KTP</th>}</tr>
                </thead>
                <tbody>
                  {warga.anggota_keluarga?.length === 0 ? (
                    <tr><td colSpan={FITUR_KTP_AKTIF ? 5 : 4} className="p-6 text-center italic text-slate-400 font-bold">Tidak ada tanggungan tercatat.</td></tr>
                  ) : (
                    warga.anggota_keluarga?.map((ak: any) => (
                      <tr key={ak.id} className="border-b hover:bg-slate-50">
                        <td className="p-3"><div className="font-black text-slate-800">{ak.nama_lengkap}</div><div className="font-mono text-[10px] text-slate-500">{ak.nik ? `${ak.nik.slice(0, 4)}********${ak.nik.slice(-4)}` : '-'}</div></td>
                        <td className="p-3 text-xs"><div className="font-bold">{ak.tempat_lahir}, {ak.tanggal_lahir}</div><div className="text-slate-500">{ak.jenis_kelamin}</div></td>
                        <td className="p-3 font-black text-blue-700">{ak.hubungan_keluarga === 'Lainnya' ? ak.hubungan_detail : ak.hubungan_keluarga}</td>
                        <td className="p-3 text-xs font-bold text-slate-600">{ak.pekerjaan || '-'}</td>
                        {FITUR_KTP_AKTIF && (
                          <td className="p-3 text-center">
                            {(!ak.ktp_path || ak.ktp_path === 'MENYUSUL') ? (
                              <span className="text-[9px] text-rose-500 bg-rose-50 border border-rose-100 px-2 py-1 rounded font-bold">Tdk Ada/Menyusul</span>
                            ) : ak.ktp_path === '-' ? (
                              <span className="text-[9px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded font-bold italic">Diarsip</span>
                            ) : (
                              <a href={`/api/admin/dokumen?path=${ak.ktp_path}`} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-blue-100 text-blue-700 px-3 py-1.5 rounded font-bold hover:bg-blue-200 shadow-sm">Lihat KTP</a>
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

      {/* MODAL EDIT DATA WARGA (OTOT MEKANIK) */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <h3 className="font-black text-lg text-slate-800">✏️ Edit Data Warga</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-rose-500 font-bold text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-xs font-bold text-rose-700 mb-4">
                🔒 NIK sengaja digembok dan tidak dapat diedit demi menjaga integritas database dan login warga. Jika NIK salah, Anda harus menghapus akun ini dan mendaftarkannya ulang.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">NIK (Read-Only)</label>
                  <input type="text" value={warga.nik} disabled className="w-full border p-2 rounded bg-slate-100 text-slate-400 cursor-not-allowed font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Nama Lengkap</label>
                  <input type="text" name="nama_lengkap" value={formData.nama_lengkap} onChange={handleChange} required className="w-full border p-2 rounded bg-slate-50 text-slate-800 font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Tempat Lahir</label>
                  <input type="text" name="tempat_lahir" value={formData.tempat_lahir} onChange={handleChange} className="w-full border p-2 rounded bg-slate-50 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Tanggal Lahir</label>
                  <input type="date" name="tanggal_lahir" value={formData.tanggal_lahir} onChange={handleChange} className="w-full border p-2 rounded bg-slate-50 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Jenis Kelamin</label>
                  <select name="jenis_kelamin" value={formData.jenis_kelamin} onChange={handleChange} className="w-full border p-2 rounded bg-slate-50 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="Laki-Laki">Laki-Laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Pekerjaan</label>
                  <input type="text" name="pekerjaan" value={formData.pekerjaan} onChange={handleChange} className="w-full border p-2 rounded bg-slate-50 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">WhatsApp (Mulai dgn 08...)</label>
                  <input type="text" name="no_whatsapp" value={formData.no_whatsapp} onChange={handleChange} className="w-full border p-2 rounded bg-slate-50 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Status Tinggal</label>
                  <select name="status_tinggal" value={formData.status_tinggal} onChange={handleChange} className="w-full border p-2 rounded bg-slate-50 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="Warga Tetap">Warga Tetap</option>
                    <option value="Penyewa Kontrakan">Penyewa Kontrakan</option>
                    <option value="Pemilik Kos">Pemilik Kos</option>
                    <option value="Anak Kos">Anak Kos</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Detail Alamat (Nomor Rumah/Blok)</label>
                  <textarea name="detail_alamat" value={formData.detail_alamat} onChange={handleChange} rows={2} className="w-full border p-2 rounded bg-slate-50 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
                </div>
                
                {/* Bagian Profil Ekonomi */}
                <div className="md:col-span-2 mt-4 pt-4 border-t">
                  <h4 className="font-black text-slate-700 mb-3">Profil Ekonomi</h4>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Pendapatan Bulanan</label>
                  <select name="pendapatan_bulanan" value={formData.pendapatan_bulanan} onChange={handleChange} className="w-full border p-2 rounded bg-slate-50 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">-- Pilih --</option>
                    <option value="< Rp 1 Juta">&lt; Rp 1 Juta</option>
                    <option value="Rp 1 Juta - Rp 3 Juta">Rp 1 Juta - Rp 3 Juta</option>
                    <option value="Rp 3 Juta - Rp 5 Juta">Rp 3 Juta - Rp 5 Juta</option>
                    <option value="> Rp 5 Juta">&gt; Rp 5 Juta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Daya Listrik</label>
                  <select name="daya_listrik" value={formData.daya_listrik} onChange={handleChange} className="w-full border p-2 rounded bg-slate-50 text-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">-- Pilih --</option>
                    <option value="450 VA">450 VA</option>
                    <option value="900 VA">900 VA</option>
                    <option value="1300 VA">1300 VA</option>
                    <option value="2200 VA">2200 VA</option>
                    <option value="> 2200 VA">&gt; 2200 VA</option>
                  </select>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white pt-4 pb-2 mt-6 flex justify-end gap-3 border-t">
                <button type="button" onClick={() => setIsEditOpen(false)} className="px-4 py-2 font-bold text-sm text-slate-500 hover:bg-slate-100 rounded-lg">Batal</button>
                <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow disabled:opacity-50">
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan ✅'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}