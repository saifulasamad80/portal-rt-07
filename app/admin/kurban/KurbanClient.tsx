"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ARSITEKTUR TIPE LU YANG PRESISI
type KurbanAdminClientProps = {
  adminAktif: any;
  transaksiList: any[];
  wargaList: any[];
  sampahList: any[];
  aksiSimpan: (...args: any[]) => Promise<any>;
};

// WAJIB PAKAI EXPORT DEFAULT AGAR PAGE.TSX BISA MEMBACA FILE INI
export default function KurbanAdminClient({
  adminAktif,
  transaksiList,
  wargaList,
  sampahList,
  aksiSimpan,
}: KurbanAdminClientProps) {
  
  const router = useRouter();
  const [submitLoading, setSubmitLoading] = useState(false);

  const [wargaId, setWargaId] = useState("");
  const [jenis, setJenis] = useState("Setoran (+)");
  const [sumberDana, setSumberDana] = useState("Transfer Bank");
  const [nominal, setNominal] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);

  // Kalkulasi Statistik Kurban
  const totalTerkumpul = transaksiList.reduce((sum, t) => {
    if (t.jenis_transaksi === "Setoran (+)") return sum + t.nominal;
    if (t.jenis_transaksi === "Tarikan (-)") return sum - t.nominal;
    return sum;
  }, 0);

  const saldoKurbanTerpilih = wargaId ? transaksiList.filter(t => t.warga_id === wargaId).reduce((sum, t) => {
    if (t.jenis_transaksi === "Setoran (+)") return sum + t.nominal;
    if (t.jenis_transaksi === "Tarikan (-)") return sum - t.nominal;
    return sum;
  }, 0) : 0;

  // Radar Saldo Sampah secara Real-Time
  const saldoSampahTerpilih = wargaId ? sampahList.filter((s: any) => s.warga_id === wargaId).reduce((sum: number, s: any) => {
    if (s.jenis_transaksi === "Setor") return sum + s.nominal_warga;
    if (s.jenis_transaksi === "Tarik") return sum - s.nominal_warga;
    return sum;
  }, 0) : 0;

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    const nom = parseInt(nominal);

    if (jenis === "Tarikan (-)" && nom > saldoKurbanTerpilih) {
      alert(`GAGAL: Saldo kurban tidak mencukupi! Maksimal tarikan: Rp ${saldoKurbanTerpilih.toLocaleString('id-ID')}`);
      setSubmitLoading(false);
      return;
    }

    // REM DARURAT: Cegah admin narik uang sampah melebihi saldo yang ada!
    if (jenis === "Setoran (+)" && sumberDana === "Saldo Tabungan Sampah" && nom > saldoSampahTerpilih) {
      alert(`GAGAL AUTO-DEBET: Saldo Tabungan Sampah nasabah tidak mencukupi!\nSaldo Sampah saat ini: Rp ${saldoSampahTerpilih.toLocaleString('id-ID')}`);
      setSubmitLoading(false);
      return;
    }

    try {
      const res = await aksiSimpan(wargaId, jenis, sumberDana, nom, keterangan, tanggal);
      
      if (res && !res.success) {
        alert("Database menolak transaksi: " + res.message);
      } else {
        setNominal(""); setKeterangan("");
        alert(sumberDana === "Saldo Tabungan Sampah" ? "Transaksi Kurban & Auto-Debet Sampah berhasil dicatat!" : "Transaksi Kurban berhasil dicatat!");
        router.refresh();
      }
    } catch (error: any) {
      alert("Gagal menyimpan transaksi: " + error.message);
    }
    setSubmitLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-pink-600 font-bold text-sm hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        {/* HEADER KURBAN */}
        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-pink-500 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Tabungan Kurban</h1>
            <p className="text-slate-400 text-sm">Persiapan Idul Adha & Manajemen Shohibul Kurban RT 07.</p>
          </div>
          <div className="text-5xl hidden md:block grayscale brightness-125">🐄</div>
        </div>

        {/* WIDGET STATISTIK */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-pink-600 p-6 rounded-2xl shadow-lg text-white">
            <h3 className="text-xs font-black text-pink-200 uppercase tracking-widest flex justify-between">
              <span>Total Dana Terkumpul</span>
              <span className="bg-pink-700 px-2 py-1 rounded text-[9px]">Dikelola terpisah dari Kas Umum RT</span>
            </h3>
            <div className="text-3xl md:text-4xl font-black mt-3">Rp {totalTerkumpul.toLocaleString('id-ID')}</div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-blue-500 flex flex-col justify-center">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Estimasi Hewan (Asumsi Sapi @ Rp 25 Juta)</h3>
            <div className="text-2xl font-black text-blue-600">
              {Math.floor(totalTerkumpul / 25000000)} <span className="text-sm text-slate-500">Ekor Sapi</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width: `${(totalTerkumpul % 25000000) / 25000000 * 100}%` }}></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
          
          {/* FORM INPUT TRANSAKSI */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit border-t-[6px] border-t-slate-800">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">✍️ Catat Setoran Kurban</h2>
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Tanggal Transaksi</label>
                <input type="date" required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-pink-500 text-sm font-bold text-slate-700" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Pilih Warga (Shohibul Kurban)</label>
                <select required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-pink-500 text-sm font-bold text-slate-700" value={wargaId} onChange={(e) => setWargaId(e.target.value)}>
                  <option value="">-- Pilih Nasabah --</option>
                  {wargaList.map(w => <option key={w.id} value={w.id}>{w.nama_lengkap}</option>)}
                </select>
                
                {wargaId && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] text-pink-600 font-bold bg-pink-50 p-2 rounded border border-pink-200">
                      Saldo Kurban: Rp {saldoKurbanTerpilih.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[10px] text-amber-600 font-bold bg-amber-50 p-2 rounded border border-amber-200">
                      Saldo Sampah: Rp {saldoSampahTerpilih.toLocaleString('id-ID')}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Jenis Transaksi</label>
                  <select className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm font-bold outline-none focus:border-pink-500" value={jenis} onChange={(e) => setJenis(e.target.value)}>
                    <option value="Setoran (+)" className="text-pink-600">Setoran (+)</option>
                    <option value="Tarikan (-)" className="text-rose-600">Tarikan (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Sumber Dana</label>
                  <select className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm font-bold outline-none focus:border-pink-500" value={sumberDana} onChange={(e) => setSumberDana(e.target.value)}>
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="Tunai">Tunai</option>
                    <option value="Saldo Tabungan Sampah" className="text-amber-600 font-black">Tabungan Sampah</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Nominal (Rp)</label>
                <input type="number" required min="1000" className="w-full border-2 border-pink-300 rounded-lg p-3 font-mono font-black text-xl text-pink-600 outline-none focus:border-pink-500 shadow-inner" placeholder="500000" value={nominal} onChange={(e) => setNominal(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Keterangan / Cicilan Ke-</label>
                <input type="text" required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-pink-500 text-sm" placeholder="Cicilan ke-3 Sapi Tipe A" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>
              
              <button type="submit" disabled={submitLoading} className={`w-full text-white font-black rounded-lg p-3.5 shadow-md mt-4 transition-colors ${submitLoading ? 'bg-slate-400' : 'bg-pink-600 hover:bg-pink-700'}`}>
                {submitLoading ? "Memproses..." : "Simpan Transaksi"}
              </button>
            </form>
          </div>

          {/* TABEL RIWAYAT TRANSAKSI */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">📒 Buku Besar Kurban</h2>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-900 text-white text-[11px] uppercase tracking-widest">
                  <tr>
                    <th className="p-4 border-b-2 border-slate-900">Tanggal & Nasabah</th>
                    <th className="p-4 border-b-2 border-slate-900">Status & Keterangan</th>
                    <th className="p-4 border-b-2 border-slate-900 text-right">Nominal Transaksi</th>
                  </tr>
                </thead>
                <tbody>
                  {transaksiList.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-slate-400 font-bold italic">Belum ada dana kurban terkumpul.</td></tr>
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
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-sm shadow-sm inline-block ${t.jenis_transaksi === 'Setoran (+)' ? 'bg-pink-100 text-pink-700' : 'bg-rose-100 text-rose-700'}`}>
                              {t.jenis_transaksi}
                            </span>
                            <span className="text-[9px] bg-slate-200 text-slate-600 px-2 py-1 rounded-sm font-bold uppercase tracking-wider">{t.sumber_dana}</span>
                          </div>
                          <div className="text-slate-600 text-xs mt-1">{t.keterangan}</div>
                        </td>
                        <td className={`p-4 align-top text-right font-mono font-black text-base ${t.jenis_transaksi === 'Setoran (+)' ? 'text-pink-600' : 'text-rose-600'}`}>
                          {t.jenis_transaksi === 'Setoran (+)' ? '+' : '-'} Rp {t.nominal.toLocaleString('id-ID')}
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