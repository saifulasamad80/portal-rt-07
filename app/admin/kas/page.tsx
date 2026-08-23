"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function BukuKasAdmin() {
  const [transaksi, setTransaksi] = useState<any[]>([]);
  const [wargaList, setWargaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const [tipe, setTipe] = useState("Pemasukan");
  const [kategori, setKategori] = useState("");
  const [nominal, setNominal] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [wargaId, setWargaId] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const { data: dataKas, error: errKas } = await supabase
      .from("kas_rt")
      .select("*, warga(nama_lengkap)")
      .order("created_at", { ascending: false });

    const { data: dataWarga, error: errWarga } = await supabase
      .from("warga")
      .select("id, nama_lengkap, detail_alamat")
      .eq("status_verifikasi", "Disetujui")
      .order("nama_lengkap", { ascending: true });

    if (errKas || errWarga) {
      alert("Gagal menarik data dari database!");
    } else {
      setTransaksi(dataKas || []);
      setWargaList(dataWarga || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalPemasukan = transaksi.filter(t => t.tipe_transaksi === "Pemasukan").reduce((sum, t) => sum + t.nominal, 0);
  const totalPengeluaran = transaksi.filter(t => t.tipe_transaksi === "Pengeluaran").reduce((sum, t) => sum + t.nominal, 0);
  const saldoAkhir = totalPemasukan - totalPengeluaran;

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parseInt(nominal) < 10000 && kategori === "Iuran Warga") {
      alert("Batas minimal iuran adalah Rp 10.000 sesuai kebijakan.");
      return;
    }

    setLoadingSubmit(true);
    const payload = {
      tipe_transaksi: tipe,
      kategori: kategori,
      nominal: parseInt(nominal),
      keterangan: keterangan,
      warga_id: (kategori === "Iuran Warga" && wargaId !== "") ? wargaId : null
    };

    const { error } = await supabase.from("kas_rt").insert([payload]);

    if (error) {
      alert("Gagal mencatat transaksi: " + error.message);
    } else {
      alert("Transaksi berhasil dicatat ke Buku Kas RT!");
      setNominal(""); setKeterangan(""); setWargaId(""); setKategori("");
      fetchData();
    }
    setLoadingSubmit(false);
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Membuka brankas kas RT...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-blue-600 font-bold hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        {/* FAKTA PERBAIKAN: Kotak Saldo Akhir, Pemasukan, dan Pengeluaran ditampilkan secara eksplisit */}
        <div className="bg-white p-6 rounded-xl shadow-lg border-t-8 border-blue-800 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Buku Kas RT 07</h1>
              <p className="text-slate-500">Rekapitulasi Keuangan Transparan</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-inner">
              <div className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-1">Total Pemasukan</div>
              <div className="text-2xl font-black text-emerald-600">Rp {totalPemasukan.toLocaleString("id-ID")}</div>
            </div>
            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 shadow-inner">
              <div className="text-xs font-bold text-rose-700 uppercase tracking-widest mb-1">Total Pengeluaran</div>
              <div className="text-2xl font-black text-rose-600">Rp {totalPengeluaran.toLocaleString("id-ID")}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-md">
              <div className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-1">Saldo Akhir Kas</div>
              <div className={`text-3xl font-black ${saldoAkhir >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                Rp {saldoAkhir.toLocaleString("id-ID")}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-1 h-fit border-t-4 border-emerald-500">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Catat Transaksi Baru</h2>
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tipe Transaksi</label>
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer">
                    <input type="radio" name="tipe" className="peer sr-only" checked={tipe === "Pemasukan"} onChange={() => {setTipe("Pemasukan"); setKategori("");}} />
                    <div className="text-center p-2 rounded-lg border-2 border-slate-200 peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:text-emerald-700 font-bold transition-all">Pemasukan</div>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <input type="radio" name="tipe" className="peer sr-only" checked={tipe === "Pengeluaran"} onChange={() => {setTipe("Pengeluaran"); setKategori("");}} />
                    <div className="text-center p-2 rounded-lg border-2 border-slate-200 peer-checked:border-rose-500 peer-checked:bg-rose-50 peer-checked:text-rose-700 font-bold transition-all">Pengeluaran</div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Kategori</label>
                <select required className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900" value={kategori} onChange={(e) => setKategori(e.target.value)}>
                  <option value="" disabled>-- Pilih Kategori --</option>
                  {tipe === "Pemasukan" ? (
                    <>
                      <option value="Iuran Warga">Iuran Warga</option>
                      <option value="Donasi">Donasi / Bantuan</option>
                      <option value="Lainnya">Lainnya</option>
                    </>
                  ) : (
                    <>
                      <option value="Operasional">Operasional RT</option>
                      <option value="Infrastruktur">Infrastruktur & Perbaikan</option>
                      <option value="Sosial">Kegiatan Sosial</option>
                      <option value="Lainnya">Lainnya</option>
                    </>
                  )}
                </select>
              </div>

              {kategori === "Iuran Warga" && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <label className="block text-sm font-bold text-blue-800 mb-1">Pilih Warga (Penyetor)</label>
                  <select required className="w-full border border-slate-300 rounded p-2 bg-white text-slate-900 text-sm" value={wargaId} onChange={(e) => setWargaId(e.target.value)}>
                    <option value="" disabled>-- Cari Warga --</option>
                    {wargaList.map(w => (
                      <option key={w.id} value={w.id}>{w.nama_lengkap} ({w.detail_alamat})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nominal (Rp)</label>
                <input type="number" required min="1" className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-lg text-slate-900" placeholder="0" value={nominal} onChange={(e) => setNominal(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Keterangan / Catatan</label>
                <textarea required rows={2} className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900" placeholder="Cth: Iuran bulan Agustus, Beli sapu, dll..." value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>

              <button type="submit" disabled={loadingSubmit} className={`w-full text-white font-bold rounded-lg p-3 shadow-md ${tipe === 'Pemasukan' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                {loadingSubmit ? "Menyimpan..." : "Simpan Transaksi"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-2">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Riwayat Arus Kas</h2>
            <div className="max-h-[500px] overflow-y-auto relative">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-800 text-white">
                    <th className="p-3 border">Tanggal</th>
                    <th className="p-3 border">Kategori & Keterangan</th>
                    <th className="p-3 border">Penyetor (Jika Iuran)</th>
                    <th className="p-3 border text-right">Pemasukan</th>
                    <th className="p-3 border text-right">Pengeluaran</th>
                  </tr>
                </thead>
                <tbody>
                  {transaksi.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-slate-400 font-bold italic">Belum ada transaksi tercatat.</td></tr>
                  ) : (
                    transaksi.map((t) => (
                      <tr key={t.id} className="border-b hover:bg-slate-50">
                        <td className="p-3 border text-slate-600">{new Date(t.created_at).toLocaleDateString('id-ID')}</td>
                        <td className="p-3 border">
                          <div className="font-bold text-slate-800">{t.kategori}</div>
                          <div className="text-slate-500">{t.keterangan}</div>
                        </td>
                        <td className="p-3 border text-slate-700">{t.warga ? t.warga.nama_lengkap : '-'}</td>
                        <td className="p-3 border text-right font-bold text-emerald-600">{t.tipe_transaksi === 'Pemasukan' ? `Rp ${t.nominal.toLocaleString('id-ID')}` : '-'}</td>
                        <td className="p-3 border text-right font-bold text-rose-600">{t.tipe_transaksi === 'Pengeluaran' ? `Rp ${t.nominal.toLocaleString('id-ID')}` : '-'}</td>
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