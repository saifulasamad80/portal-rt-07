"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { angkaPostgrest } from "@/lib/angka-postgrest";

// REFACTOR MUTLAK: Tambahan prop rakBinList dan teknisiList
export default function SampahAdminClient({ adminAktif, transaksiList, wargaList, rakBinList, teknisiList, aksiSimpan, aksiUpdateRakBin }: { adminAktif: any, transaksiList: any[], wargaList: any[], rakBinList: any[], teknisiList: any[], aksiSimpan: any, aksiUpdateRakBin: any }) {
  const router = useRouter();
  
  // STATE NAVIGASI TAB
  const [tabAktif, setTabAktif] = useState("kiloan"); 

  // STATE KILOAN
  const [submitLoading, setSubmitLoading] = useState(false);
  const [wargaId, setWargaId] = useState("");
  const [jenis, setJenis] = useState("Setor"); 
  const [keterangan, setKeterangan] = useState("");
  const [hargaPengepul, setHargaPengepul] = useState("");
  const [beratKg, setBeratKg] = useState("");
  const [nominalWarga, setNominalWarga] = useState("");
  const [nominalKasRt, setNominalKasRt] = useState("0");
  const [tanggal, setTanggal] = useState(new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]);
  
  // STATE RAK BIN (Tugaskan Teknisi)
  const [loadingRakBinId, setLoadingRakBinId] = useState("");
  const [selectedTeknisiId, setSelectedTeknisiId] = useState("");

  // KALKULASI STATISTIK
  const totalSaldoWarga = transaksiList.reduce((sum, t) => {
    const nominal = angkaPostgrest(t.nominal_warga);
    if (t.jenis_transaksi === "Setor") return sum + nominal;
    if (t.jenis_transaksi === "Tarik") return sum - nominal;
    return sum;
  }, 0);
  const totalKasRtMasuk = transaksiList.reduce((sum, t) => sum + angkaPostgrest(t.nominal_kas_rt), 0);
  const totalBerat = transaksiList.reduce((sum, t) => sum + angkaPostgrest(t.berat_kg), 0);

  const saldoUserTerpilih = wargaId ? transaksiList.filter(t => t.warga_id === wargaId).reduce((sum, t) => {
    const nominal = angkaPostgrest(t.nominal_warga);
    if (t.jenis_transaksi === "Setor") return sum + nominal;
    if (t.jenis_transaksi === "Tarik") return sum - nominal;
    return sum;
  }, 0) : 0;

  // HANDLER SIMPAN TRANSAKSI KILOAN
  const handleSimpanKiloan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    const nomWarga = parseInt(nominalWarga);

    if (jenis === "Tarik" && nomWarga > saldoUserTerpilih) {
      alert(`GAGAL: Saldo nasabah tidak mencukupi! Saldo maksimal yang dapat ditarik: Rp ${saldoUserTerpilih.toLocaleString('id-ID')}`);
      setSubmitLoading(false);
      return;
    }

    try {
      const res = await aksiSimpan(wargaId, jenis, keterangan, beratKg ? parseFloat(beratKg) : null, nomWarga, nominalKasRt ? parseInt(nominalKasRt) : 0, tanggal);
      
      if (res && !res.success) {
        alert("Database menolak transaksi: " + res.message);
      } else {
        setKeterangan(""); setBeratKg(""); setNominalWarga(""); setNominalKasRt("0"); setHargaPengepul("");
        alert("Transaksi Bank Sampah berhasil dicatat!");
        router.refresh();
      }
    } catch (error: any) { alert("Gagal menyimpan transaksi: " + error.message); }
    setSubmitLoading(false);
  };

  // HANDLER UPDATE STATUS RAK BIN (Tugaskan Teknisi)
  const handleTugaskanRakBin = async (id: string, statusBaru: string, idTeknisi?: string) => {
    if (statusBaru === 'Sedang Direparasi' && !idTeknisi) {
      return alert("Pilih Teknisi Jasa / UMKM Warga terlebih dahulu!");
    }
    
    if (!confirm(`Tandai barang ini sebagai: ${statusBaru}?`)) return;
    
    setLoadingRakBinId(id);
    try {
      await aksiUpdateRakBin(id, statusBaru, idTeknisi || null);
      setSelectedTeknisiId(""); // Reset dropdown teknisi
      router.refresh();
    } catch (error: any) { alert("Gagal mengupdate Rak Bin: " + error.message); }
    setLoadingRakBinId("");
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
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Manajemen Sirkular Ekonomi</h1>
            <p className="text-slate-300 text-sm">Kelola setoran anorganik (Kiloan) dan distribusikan limbah ekonomis (Rak Bin) ke Jasa UMKM.</p>
          </div>
          <div className="text-5xl hidden md:block grayscale brightness-125">♻️</div>
        </div>

        {/* WIDGET STATISTIK */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-blue-500">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Sampah Kiloan</h3>
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

        {/* TOGGLE TAB */}
        <div className="bg-slate-200 p-1.5 rounded-xl flex gap-1 shadow-inner max-w-md mt-4">
          <button onClick={() => setTabAktif("kiloan")} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${tabAktif === 'kiloan' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>⚖️ Bank Sampah Kiloan</button>
          <button onClick={() => setTabAktif("ekonomis")} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${tabAktif === 'ekonomis' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>📺 Pusat Rak Bin (Satuan)</button>
        </div>

        {/* ======================= TAB 1: KILOAN ======================= */}
        {tabAktif === "kiloan" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4 animate-in fade-in slide-in-from-bottom-2">
            
            {/* FORM INPUT TRANSAKSI KILOAN */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit border-t-[6px] border-t-slate-800">
              <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">✍️ Catat Setoran/Tarikan</h2>
              <form onSubmit={handleSimpanKiloan} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Tanggal Transaksi</label>
                  <input type="date" required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-emerald-500 text-sm font-bold text-slate-700" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Jenis Transaksi</label>
                  <select className="w-full border-2 border-slate-200 rounded-lg p-3 font-bold outline-none focus:border-emerald-500" value={jenis} onChange={(e) => {
                    setJenis(e.target.value);
                    if (e.target.value === "Tarik") { setBeratKg(""); setHargaPengepul(""); setNominalKasRt("0"); setNominalWarga(""); }
                  }}>
                    <option value="Setor" className="text-emerald-600">Setor Sampah (+)</option>
                    <option value="Tarik" className="text-rose-600">Tarik Saldo Warga (-)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Pilih Nasabah (Warga)</label>
                  <select required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-emerald-500 text-sm font-bold text-slate-700" value={wargaId} onChange={(e) => setWargaId(e.target.value)}>
                    <option value="">-- Pilih Nasabah --</option>
                    {wargaList.map(w => <option key={w.id} value={w.id}>{w.nama_lengkap}</option>)}
                  </select>
                  
                  {jenis === "Tarik" && wargaId && (
                    <p className="text-[10px] text-amber-600 font-bold mt-2 bg-amber-50 p-2 rounded border border-amber-200">
                      Sisa Saldo: Rp {saldoUserTerpilih.toLocaleString('id-ID')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Keterangan / Jenis Barang</label>
                  <input type="text" required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-emerald-500 text-sm" placeholder="Cth: Kardus & Botol Plastik" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
                </div>

                {/* KALKULATOR PENGEPUL */}
                {jenis === "Setor" && (
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl mb-4 space-y-4">
                    <h3 className="text-xs font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2">🧮 Kalkulator Valuasi</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-700 mb-1 uppercase">Harga Pengepul / Kg</label>
                        <input type="number" min="0" className="w-full border border-emerald-300 rounded-lg p-2.5 font-mono text-emerald-900 focus:border-emerald-600 outline-none text-sm" placeholder="Cth: 2500" value={hargaPengepul} onChange={(e) => setHargaPengepul(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-700 mb-1 uppercase">Berat Timbangan (Kg)</label>
                        <input type="number" step="0.1" min="0.1" className="w-full border border-emerald-300 rounded-lg p-2.5 font-mono text-emerald-900 focus:border-emerald-600 outline-none text-sm" placeholder="Cth: 2.5" value={beratKg} onChange={(e) => setBeratKg(e.target.value)} />
                      </div>
                    </div>
                    
                    {hargaPengepul && beratKg && (
                      <div className="pt-3 border-t border-emerald-200">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[11px] font-bold text-emerald-700 uppercase">Total Uang Masuk:</span>
                          <span className="text-lg font-black text-emerald-800">Rp {(parseFloat(hargaPengepul) * parseFloat(beratKg)).toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => {
                            const total = Math.floor(parseFloat(hargaPengepul) * parseFloat(beratKg));
                            setNominalWarga(total.toString()); setNominalKasRt("0");
                          }} className="flex-1 bg-white border border-emerald-400 text-emerald-700 text-[10px] font-bold py-2 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm">100% Hak Warga</button>
                          <button type="button" onClick={() => {
                            const total = parseFloat(hargaPengepul) * parseFloat(beratKg);
                            setNominalWarga(Math.floor(total * 0.8).toString()); setNominalKasRt(Math.floor(total * 0.2).toString());
                          }} className="flex-1 bg-emerald-600 border border-emerald-600 text-white text-[10px] font-bold py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">Bagi Hasil 80:20</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Hak Warga (Rp)</label>
                    <input type="number" required min="100" className="w-full border-2 border-slate-200 rounded-lg p-3 font-mono font-black text-lg text-amber-600 outline-none focus:border-emerald-500" placeholder="0" value={nominalWarga} onChange={(e) => setNominalWarga(e.target.value)} />
                  </div>
                  {jenis === "Setor" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Kas RT (Rp)</label>
                      <input type="number" min="0" required className="w-full border-2 border-slate-200 rounded-lg p-3 font-mono font-black text-lg text-emerald-600 outline-none focus:border-emerald-500" placeholder="0" value={nominalKasRt} onChange={(e) => setNominalKasRt(e.target.value)} />
                    </div>
                  )}
                </div>
                
                <button type="submit" disabled={submitLoading} className={`w-full text-white font-black rounded-lg p-3.5 shadow-md mt-4 transition-colors ${submitLoading ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                  {submitLoading ? "Memproses..." : "Simpan Transaksi"}
                </button>
              </form>
            </div>

            {/* TABEL RIWAYAT TRANSAKSI KILOAN */}
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
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-sm shadow-sm inline-block mb-1.5 ${t.jenis_transaksi === 'Setor' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {t.jenis_transaksi === 'Setor' ? 'Setor Sampah' : 'Tarik Saldo'} {t.berat_kg ? `(${t.berat_kg} kg)` : ''}
                            </span>
                            <div className="text-slate-600 text-xs">{t.keterangan}</div>
                          </td>
                          <td className={`p-4 align-top text-right font-mono font-black text-sm ${t.jenis_transaksi === 'Setor' ? 'text-amber-600' : 'text-rose-600'}`}>
                            {t.jenis_transaksi === 'Setor' ? '+' : '-'} Rp {angkaPostgrest(t.nominal_warga).toLocaleString('id-ID')}
                          </td>
                          <td className="p-4 align-top text-right font-mono font-bold text-sm text-emerald-600">
                            {angkaPostgrest(t.nominal_kas_rt) > 0 ? `+ Rp ${angkaPostgrest(t.nominal_kas_rt).toLocaleString('id-ID')}` : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB 2: RAK BIN ======================= */}
        {tabAktif === "ekonomis" && (
          <div className="pt-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3 flex items-center gap-2">
                <span>🗄️</span> Antrean Barang di Rak Bin
              </h2>
              
              <div className="overflow-x-auto max-h-[700px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-indigo-50 text-indigo-900 text-[11px] uppercase tracking-widest border-b border-indigo-200">
                    <tr>
                      <th className="p-4 font-black">Barang & Pemilik</th>
                      <th className="p-4 font-black">Kerusakan</th>
                      <th className="p-4 font-black">Tujuan (Opsi Warga)</th>
                      <th className="p-4 font-black text-center">Status & Aksi Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!rakBinList || rakBinList.length === 0) ? (
                      <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold italic border-b border-slate-100">Gudang Rak Bin kosong. Belum ada warga yang melapor.</td></tr>
                    ) : (
                      rakBinList.map((r) => (
                        <tr key={r.id} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="p-4 align-top">
                            <div className="font-black text-slate-800 text-base">{r.nama_barang}</div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-200 px-2 py-1 rounded inline-block mt-1 mb-2">
                              {r.kategori}
                            </div>
                            <div className="text-xs font-bold text-slate-600">👤 {r.warga?.nama_lengkap}</div>
                          </td>
                          <td className="p-4 align-top text-xs text-slate-600 leading-relaxed max-w-[200px]">
                            {r.deskripsi}
                          </td>
                          <td className="p-4 align-top">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${
                              r.opsi_tujuan.includes('Hibah') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              r.opsi_tujuan.includes('Jual') ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}>
                              {r.opsi_tujuan}
                            </span>
                          </td>
                          <td className="p-4 align-top text-center min-w-[220px]">
                            
                            {/* Label Status Saat Ini */}
                            <div className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded w-full mb-3 text-center ${
                              r.status === 'Menunggu Verifikasi' ? 'bg-slate-200 text-slate-600' :
                              r.status === 'Sedang Direparasi' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                              r.status === 'Tersedia di Rak Bin' ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              STATUS: {r.status}
                            </div>

                            {/* AKSI JIKA OPSI REPARASI (Melempar ke Jasa UMKM) */}
                            {r.opsi_tujuan.includes('Reparasi') && (r.status === 'Menunggu Verifikasi' || r.status === 'Tersedia di Rak Bin') && (
                              <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-100 text-left">
                                <label className="block text-[9px] font-bold text-indigo-800 mb-1 uppercase tracking-wider">Tugaskan ke UMKM Jasa:</label>
                                <select 
                                  className="w-full text-xs p-2 rounded border border-indigo-200 mb-2 outline-none"
                                  onChange={(e) => setSelectedTeknisiId(e.target.value)}
                                >
                                  <option value="">-- Pilih Teknisi Warga --</option>
                                  {teknisiList.map((t: any) => (
                                    <option key={t.id} value={t.id}>{t.nama_usaha} ({t.warga?.nama_lengkap})</option>
                                  ))}
                                </select>
                                <button 
                                  onClick={() => handleTugaskanRakBin(r.id, 'Sedang Direparasi', selectedTeknisiId)} 
                                  disabled={loadingRakBinId === r.id} 
                                  className="w-full bg-indigo-600 text-white text-[10px] font-bold py-2 rounded hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                                >
                                  Tugaskan Pekerjaan 🛠️
                                </button>
                              </div>
                            )}

                            {/* TAMPILKAN NAMA TEKNISI JIKA SEDANG DIREPARASI */}
                            {r.status === 'Sedang Direparasi' && (
                              <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs font-bold text-slate-600">
                                Teknisi: <span className="text-indigo-600">{r.lapak_warga?.nama_usaha || 'Tidak Diketahui'}</span>
                              </div>
                            )}

                            {/* AKSI JIKA OPSI HIBAH / JUAL (Hanya ubah status ketersediaan) */}
                            {!r.opsi_tujuan.includes('Reparasi') && r.status === 'Menunggu Verifikasi' && (
                              <button 
                                onClick={() => handleTugaskanRakBin(r.id, 'Tersedia di Rak Bin')} 
                                disabled={loadingRakBinId === r.id} 
                                className="w-full bg-emerald-500 text-white text-[10px] font-bold py-2 rounded hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50"
                              >
                                Tandai Masuk Rak Bin ✅
                              </button>
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
        )}

      </div>
    </div>
  );
}