"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function KurbanClient({ kurbanList, wargaList, aksiSimpan }: { kurbanList: any[], wargaList: any[], aksiSimpan: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [wargaId, setWargaId] = useState("");
  const [jenis, setJenis] = useState("Setoran");
  const [sumberDana, setSumberDana] = useState("Transfer Bank");
  const [nominal, setNominal] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);

  const totalTabungan = kurbanList.reduce((sum, k) => {
    return k.jenis_transaksi === "Setoran" ? sum + k.nominal : sum - k.nominal;
  }, 0);

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await aksiSimpan(wargaId, jenis, sumberDana, parseInt(nominal), keterangan, tanggal);
      setNominal(""); setKeterangan("");
      alert("Catatan Kurban berhasil disimpan!");
      router.refresh();
    } catch (error: any) {
      alert("Gagal menyimpan: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link href="/admin" className="text-pink-600 font-bold text-sm hover:underline mb-2 inline-block">&larr; Kembali ke Pusat Komando</Link>

        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-pink-500 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Tabungan Kurban</h1>
            <p className="text-slate-400 text-sm">Persiapan dana kolektif warga untuk Hari Raya Idul Adha.</p>
          </div>
          <div className="text-5xl hidden md:block grayscale brightness-200">🐄</div>
        </div>

        <div className="bg-pink-600 p-6 md:p-8 rounded-2xl shadow-lg text-white mb-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-xs font-black text-pink-200 uppercase tracking-widest">Total Akumulasi Dana Kurban Saat Ini</h3>
            <div className="text-4xl font-black mt-2">Rp {totalTabungan.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-pink-800/50 px-4 py-2 rounded-lg border border-pink-500 text-xs font-bold shadow-inner">
            Dikelola terpisah dari Kas Umum RT
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit border-t-[6px] border-t-slate-800">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">✍️ Catat Setoran Kurban</h2>
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Tanggal Transaksi</label>
                <input type="date" required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-pink-500 text-sm font-bold" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Pilih Warga (Shohibul Kurban)</label>
                <select required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-pink-500 text-sm font-bold" value={wargaId} onChange={(e) => setWargaId(e.target.value)}>
                  <option value="">-- Pilih Nasabah --</option>
                  {wargaList.map(w => <option key={w.id} value={w.id}>{w.nama_lengkap}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-2 uppercase">Jenis Transaksi</label>
                  <select className="w-full border-2 border-slate-200 rounded-lg p-2.5 text-xs font-bold outline-none focus:border-pink-500" value={jenis} onChange={(e) => setJenis(e.target.value)}>
                    <option value="Setoran">Setoran (+)</option><option value="Penarikan">Penarikan (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-2 uppercase">Sumber Dana</label>
                  <select className="w-full border-2 border-slate-200 rounded-lg p-2.5 text-xs font-bold outline-none focus:border-pink-500" value={sumberDana} onChange={(e) => setSumberDana(e.target.value)}>
                    <option value="Transfer Bank">Transfer Bank</option><option value="Tunai">Tunai / Cash</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Nominal (Rp)</label>
                <input type="number" required min="1000" className="w-full border-2 border-slate-200 rounded-lg p-3 font-mono font-black text-lg text-pink-600 outline-none focus:border-pink-500" placeholder="500000" value={nominal} onChange={(e) => setNominal(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Keterangan / Cicilan Ke-</label>
                <input type="text" required className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm outline-none focus:border-pink-500" placeholder="Cicilan ke-3 Sapi Tipe A" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>
              <button type="submit" disabled={loading} className={`w-full text-white font-black rounded-lg p-3.5 shadow-md mt-4 transition-colors ${loading ? 'bg-slate-400' : 'bg-pink-600 hover:bg-pink-700'}`}>
                {loading ? "Memproses..." : "Simpan Transaksi"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">📒 Buku Besar Kurban</h2>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-800 text-white text-[10px] uppercase tracking-widest">
                  <tr>
                    <th className="p-4 border-b-2 border-slate-900">Tanggal & Nasabah</th>
                    <th className="p-4 border-b-2 border-slate-900">Status & Keterangan</th>
                    <th className="p-4 border-b-2 border-slate-900 text-right">Nominal Transaksi</th>
                  </tr>
                </thead>
                <tbody>
                  {kurbanList.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-slate-400 font-bold italic">Belum ada dana kurban terkumpul.</td></tr>
                  ) : (
                    kurbanList.map((k) => (
                      <tr key={k.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                        <td className="p-4 align-top">
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            {k.tanggal_transaksi ? new Date(k.tanggal_transaksi).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'}) : '-'}
                          </div>
                          <div className="font-black text-slate-800 mt-1">{k.warga?.nama_lengkap}</div>
                        </td>
                        <td className="p-4 align-top">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-sm shadow-sm inline-block mb-1.5 ${k.jenis_transaksi === 'Setoran' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {k.jenis_transaksi} ({k.sumber_dana})
                          </span>
                          <div className="text-slate-600 text-xs">{k.keterangan}</div>
                        </td>
                        <td className={`p-4 align-top text-right font-mono font-black text-sm md:text-base ${k.jenis_transaksi === 'Setoran' ? 'text-pink-600' : 'text-rose-600'}`}>
                          {k.jenis_transaksi === 'Setoran' ? '+' : '-'} Rp {k.nominal.toLocaleString('id-ID')}
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