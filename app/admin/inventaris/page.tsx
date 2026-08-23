"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function AdminInventaris() {
  const [riwayat, setRiwayat] = useState<any[]>([]);
  const [masterBarang, setMasterBarang] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Tambah Barang
  const [namaBarangBaru, setNamaBarangBaru] = useState("");
  const [deskripsiBarang, setDeskripsiBarang] = useState("");
  const [loadingBarang, setLoadingBarang] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: dataRiwayat } = await supabase
      .from("peminjaman_inventaris")
      .select("*, warga(nama_lengkap, no_whatsapp)")
      .order("tanggal_pinjam", { ascending: false });

    const { data: dataMaster } = await supabase
      .from("master_inventaris")
      .select("*")
      .order("nama_barang", { ascending: true });

    if (dataRiwayat) setRiwayat(dataRiwayat);
    if (dataMaster) setMasterBarang(dataMaster);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTambahBarang = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingBarang(true);
    
    const { error } = await supabase.from("master_inventaris").insert([{
      nama_barang: namaBarangBaru,
      deskripsi: deskripsiBarang
    }]);

    if (error) alert("Gagal menambah barang: " + error.message);
    else {
      setNamaBarangBaru("");
      setDeskripsiBarang("");
      fetchData();
    }
    setLoadingBarang(false);
  };

  const handleHapusBarang = async (id: string, nama: string) => {
    if (!confirm(`Yakin ingin menghapus ${nama} dari daftar inventaris? Warga tidak akan bisa meminjam ini lagi.`)) return;
    
    const { error } = await supabase.from("master_inventaris").delete().eq("id", id);
    if (error) alert("Gagal menghapus barang: " + error.message);
    else fetchData();
  };

  const updateStatus = async (id: string, statusBaru: string, namaBarang: string, namaWarga: string) => {
    if (!confirm(`Yakin ingin mengubah status booking ini menjadi: ${statusBaru}?`)) return;

    // FAKTA: Inject Audit Log otomatis di background
    await supabase.from("audit_log").insert([{
      aktor: "Admin RT",
      aksi: `Ubah Status Peminjaman: ${statusBaru}`,
      tabel_target: "peminjaman_inventaris",
      detail: `Barang: ${namaBarang}, Peminjam: ${namaWarga}`
    }]);

    const { error } = await supabase.from("peminjaman_inventaris").update({ status: statusBaru }).eq("id", id);
    if (error) alert("Gagal update status: " + error.message);
    else fetchData();
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Membuka catatan inventaris...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link href="/admin" className="text-amber-600 font-bold hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-8 border-amber-500">
          <h1 className="text-3xl font-bold text-slate-800">Manajemen Inventaris RT</h1>
          <p className="text-slate-500">Kelola daftar aset RT dan persetujuan peminjaman warga.</p>
        </div>

        {/* PANEL KONTROL MASTER BARANG */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-1 border-t-4 border-amber-600 h-fit">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Tambah Aset Baru</h2>
            <form onSubmit={handleTambahBarang} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nama Barang / Fasilitas</label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2 text-slate-900" placeholder="Cth: Mesin Potong Rumput" value={namaBarangBaru} onChange={(e) => setNamaBarangBaru(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Deskripsi Singkat</label>
                <textarea required rows={2} className="w-full border border-slate-300 rounded-lg p-2 text-slate-900" placeholder="Kondisi atau kelengkapan..." value={deskripsiBarang} onChange={(e) => setDeskripsiBarang(e.target.value)} />
              </div>
              <button type="submit" disabled={loadingBarang} className="w-full bg-amber-600 text-white font-bold rounded-lg p-2.5 shadow hover:bg-amber-700 transition-colors">
                {loadingBarang ? "Menyimpan..." : "Tambahkan ke Katalog"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-2">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Katalog Aset Tersedia</h2>
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-800 text-white">
                    <th className="p-3 border">Nama Barang</th>
                    <th className="p-3 border">Deskripsi</th>
                    <th className="p-3 border text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {masterBarang.map((b) => (
                    <tr key={b.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 border font-bold text-slate-800">{b.nama_barang}</td>
                      <td className="p-3 border text-slate-600">{b.deskripsi}</td>
                      <td className="p-3 border text-center">
                        <button onClick={() => handleHapusBarang(b.id, b.nama_barang)} className="bg-rose-100 text-rose-700 hover:bg-rose-200 text-xs font-bold px-3 py-1.5 rounded">Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* PANEL PERSETUJUAN PEMINJAMAN */}
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Antrean Peminjaman Warga</h2>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto relative">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-800 text-white">
                  <th className="p-3 border">Tanggal Pinjam</th>
                  <th className="p-3 border">Peminjam</th>
                  <th className="p-3 border">Barang & Keperluan</th>
                  <th className="p-3 border">Status</th>
                  <th className="p-3 border text-center">Aksi RT</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-slate-400 font-bold italic">Belum ada permohonan masuk.</td></tr>
                ) : (
                  riwayat.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 border font-bold text-slate-700">
                        {new Date(t.tanggal_pinjam).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </td>
                      <td className="p-3 border">
                        <div className="font-bold text-slate-800">{t.warga?.nama_lengkap}</div>
                        <a href={`https://wa.me/${t.warga?.no_whatsapp}`} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">WA: {t.warga?.no_whatsapp}</a>
                      </td>
                      <td className="p-3 border">
                        <div className="font-bold text-slate-800">{t.nama_barang}</div>
                        <div className="text-slate-600 mt-1 italic">"{t.keterangan}"</div>
                      </td>
                      <td className="p-3 border font-bold">
                        {t.status === 'Disetujui' && <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Disetujui</span>}
                        {t.status === 'Ditolak' && <span className="text-rose-600 bg-rose-50 px-2 py-1 rounded">Ditolak</span>}
                        {t.status === 'Dikembalikan' && <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded">Dikembalikan</span>}
                        {t.status === 'Menunggu' && <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded">Menunggu</span>}
                      </td>
                      <td className="p-3 border text-center space-y-2">
                        {t.status === 'Menunggu' && (
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => updateStatus(t.id, 'Disetujui', t.nama_barang, t.warga?.nama_lengkap)} className="bg-emerald-500 text-white text-xs px-3 py-2 rounded shadow hover:bg-emerald-600 font-bold transition-colors">Setujui</button>
                            <button onClick={() => updateStatus(t.id, 'Ditolak', t.nama_barang, t.warga?.nama_lengkap)} className="bg-rose-500 text-white text-xs px-3 py-2 rounded shadow hover:bg-rose-600 font-bold transition-colors">Tolak</button>
                          </div>
                        )}
                        {t.status === 'Disetujui' && (
                          <button onClick={() => updateStatus(t.id, 'Dikembalikan', t.nama_barang, t.warga?.nama_lengkap)} className="block w-full bg-blue-500 text-white text-xs px-3 py-2 rounded shadow hover:bg-blue-600 font-bold transition-colors">Tandai Barang Kembali</button>
                        )}
                        {(t.status === 'Ditolak' || t.status === 'Dikembalikan') && (
                          <span className="text-xs text-slate-400 font-bold">Selesai</span>
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