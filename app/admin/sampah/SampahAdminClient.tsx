"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SampahAdminClient({ adminAktif, transaksiList, wargaList, aksiSimpan }: { adminAktif: any, transaksiList: any[], wargaList: any[], aksiSimpan: any }) {
  const router = useRouter();
  const [submitLoading, setSubmitLoading] = useState(false);

  const [wargaId, setWargaId] = useState("");
  const [jenis, setJenis] = useState("Setor Sampah");
  const [keterangan, setKeterangan] = useState("");
  const [beratKg, setBeratKg] = useState("");
  const [nominalWarga, setNominalWarga] = useState("");
  const [nominalKasRt, setNominalKasRt] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);

  // Kalkulasi Statistik Cepat
  const totalSaldoWarga = transaksiList.reduce((sum, t) => {
    if (t.jenis_transaksi === "Setor Sampah") return sum + t.nominal_warga;
    if (t.jenis_transaksi === "Tarik Saldo") return sum - t.nominal_warga;
    return sum;
  }, 0);
  
  const totalKasRtMasuk = transaksiList.reduce((sum, t) => sum + (t.nominal_kas_rt || 0), 0);
  const totalBerat = transaksiList.reduce((sum, t) => sum + (t.berat_kg || 0), 0);

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    try {
      await aksiSimpan(wargaId, jenis, keterangan, beratKg ? parseFloat(beratKg) : null, parseInt(nominalWarga), nominalKasRt ? parseInt(nominalKasRt) : 0, tanggal);
      setKeterangan(""); setBeratKg(""); setNominalWarga(""); setNominalKasRt("");
      alert("Transaksi Bank Sampah berhasil dicatat!");
      router.refresh();
    } catch (error: any) {
      alert("Gagal menyimpan transaksi: " + error.message);
    }
    setSubmitLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-emerald-600 font-bold text-sm hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        {/* HEADER BANK SAMPAH */}
        <div className="bg-slate-800 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-emerald-500 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Manajemen Bank Sampah</h1>
            <p className="text-slate-300 text-sm">Catat setoran limbah anorganik warga dan kelola bagi hasil kas RT.</p>
          </div>
          <div className="text-5xl hidden md:block grayscale brightness-125">♻️</div>
        </div>

        {/* WIDGET STATISTIK */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-blue-500">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Sampah Terkumpul</h3>
            <div className="text-2xl md:text-3xl font-black text-blue-600 mt-2">{totalBerat.toFixed(1)} <span className="text-lg">Kg</span></div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-amber-500">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Saldo Tersimpan Warga</h3>
            <div className="text-2xl md:text-3xl font-black text-amber-600 mt-2">Rp {totalSaldoWarga.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-emerald-600 p-5 rounded-2xl shadow-lg text-white">
            <h3 className="text-[10px] font-black text-emerald-200 uppercase tracking-widest">Total Pemasukan Kas RT</h3>
            <div className="text-2xl md:text-3xl font-black mt-2">Rp {totalKasRtMasuk.toLocaleString('id-ID')}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
          
          {/* FORM INPUT TRANSAKSI */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit border-t-[6px] border-t-slate-800">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">✍️ Catat Setoran/Tarikan</h2>
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Tanggal Transaksi</label>
                <input type="date" required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-emerald-500 text-sm font-bold text-slate-700" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Jenis Transaksi</label>
                <select className="w-full border-2 border-slate-200 rounded-lg p-3 font-bold outline-none focus:border-emerald-500" value={jenis} onChange={(e) => setJenis(e.target.value)}>
                  <option value="Setor Sampah" className="text-emerald-600">Setor Sampah (+)</option>
                  <option value="Tarik Saldo" className="text-rose-600">Tarik Saldo Warga (-)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Pilih Nasabah (Warga)</label>
                <select required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-emerald-500 text-sm font-bold text-slate-700" value={wargaId} onChange={(e) => setWargaId(e.target.value)}>
                  <option value="">-- Pilih Nasabah --</option>
                  {wargaList.map(w => <option key={w.id} value={w.id}>{w.nama_lengkap}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Keterangan / Jenis Barang</label>
                <input type="text" required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-emerald-500 text-sm" placeholder="Cth: Kardus & Botol Plastik" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>

              {jenis === "Setor Sampah" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Berat (Kg)</label>
                    <input type="number" step="0.1" min="0.1" required className="w-full border-2 border-slate-200 rounded-lg p-3 font-mono text-slate-800 focus:border-emerald-500 outline-none text-sm" placeholder="2.5" value={beratKg} onChange={(e) => setBeratKg(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Masuk Kas RT (Rp)</label>
                    <input type="number" min="0" required className="w-full border-2 border-slate-200 rounded-lg p-3 font-mono text-emerald-600 focus:border-emerald-500 outline-none text-sm" placeholder="1000" value={nominalKasRt} onChange={(e) => setNominalKasRt(e.target.value)} />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Nominal Hak Warga (Rp)</label>
                <input type="number" required min="100" className="w-full border-2 border-slate-200 rounded-lg p-3 font-mono font-black text-lg text-amber-600 outline-none focus:border-emerald-500" placeholder="5000" value={nominalWarga} onChange={(e) => setNominalWarga(e.target.value)} />
              </div>
              
              <button type="submit" disabled={submitLoading} className={`w-full text-white font-black rounded-lg p-3.5 shadow-md mt-4 transition-colors ${submitLoading ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                {submitLoading ? "Memproses..." : "Simpan Transaksi"}
              </button>
            </form>
          </div>

          {/* TABEL RIWAYAT TRANSAKSI */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">📒 Buku Rekapitulasi Sampah</h2>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-800 text-white text-[11px] uppercase tracking-widest">
                  <tr>
                    <th className="p-4 border-b-2 border-slate-900">Tanggal & Nasabah</th>
                    <th className="p-4 border-b-2 border-slate-900">Jenis & Keterangan</th>
                    <th className="p-4 border-b-2 border-slate-900 text-right">Saldo Warga</th>
                    <th className="p-4 border-b-2 border-slate-900 text-right">Potongan Kas RT</th>
                  </tr>
                </thead>
                <tbody>
                  {transaksiList.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold italic">Belum ada transaksi bank sampah tercatat.</td></tr>
                  ) : (
                    transaksiList.map((t) => (
                      <tr key={t.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                        <td className="p-4 align-top">
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            {t.tanggal_transaksi ? new Date(t.tanggal_transaksi).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'}) : '-'}
                          </div>
                          <div className="font-black text-slate-800 mt-1">{t.warga?.nama_lengkap}</div>
                        </td>
                        <td className="p-4 align-top">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-sm shadow-sm inline-block mb-1.5 ${t.jenis_transaksi === 'Setor Sampah' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {t.jenis_transaksi} {t.berat_kg ? `(${t.berat_kg} kg)` : ''}
                          </span>
                          <div className="text-slate-600 text-xs">{t.keterangan}</div>
                        </td>
                        <td className={`p-4 align-top text-right font-mono font-black text-sm ${t.jenis_transaksi === 'Setor Sampah' ? 'text-amber-600' : 'text-rose-600'}`}>
                          {t.jenis_transaksi === 'Setor Sampah' ? '+' : '-'} Rp {t.nominal_warga.toLocaleString('id-ID')}
                        </td>
                        <td className="p-4 align-top text-right font-mono font-bold text-sm text-emerald-600">
                          {t.nominal_kas_rt > 0 ? `+ Rp ${t.nominal_kas_rt.toLocaleString('id-ID')}` : '-'}
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