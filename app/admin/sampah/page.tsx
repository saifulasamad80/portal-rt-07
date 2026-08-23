"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function AdminBankSampah() {
  const [transaksi, setTransaksi] = useState<any[]>([]);
  const [wargaList, setWargaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const [wargaId, setWargaId] = useState("");
  const [jenis, setJenis] = useState("Setor");
  const [keterangan, setKeterangan] = useState("");
  const [berat, setBerat] = useState("");
  const [totalUang, setTotalUang] = useState(""); 

  const fetchData = async () => {
    setLoading(true);
    const { data: dataTrx } = await supabase
      .from("transaksi_sampah")
      .select("*, warga(nama_lengkap)")
      .order("created_at", { ascending: false });

    const { data: dataWarga } = await supabase
      .from("warga")
      .select("id, nama_lengkap, detail_alamat")
      .eq("status_verifikasi", "Disetujui")
      .order("nama_lengkap", { ascending: true });

    setTransaksi(dataTrx || []);
    setWargaList(dataWarga || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getSaldoWarga = (id: string) => {
    const trxWarga = transaksi.filter(t => t.warga_id === id);
    const totalSetor = trxWarga.filter(t => t.jenis_transaksi === "Setor").reduce((sum, t) => sum + t.nominal_warga, 0);
    const totalTarik = trxWarga.filter(t => t.jenis_transaksi === "Tarik").reduce((sum, t) => sum + t.nominal_warga, 0);
    return totalSetor - totalTarik;
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wargaId) {
      alert("Pilih warga terlebih dahulu!");
      return;
    }

    const uang = parseInt(totalUang);
    let nominalWarga = 0;
    let nominalKasRT = 0;

    if (jenis === "Setor") {
      nominalWarga = Math.floor(uang * 0.85);
      nominalKasRT = uang - nominalWarga; 
    } else {
      const saldoSaatIni = getSaldoWarga(wargaId);
      if (uang > saldoSaatIni) {
        alert(`Ditolak! Saldo tidak cukup. Saldo saat ini hanya: Rp ${saldoSaatIni.toLocaleString("id-ID")}`);
        return;
      }
      nominalWarga = uang;
      nominalKasRT = 0;
    }

    setLoadingSubmit(true);
    const payload = {
      warga_id: wargaId,
      jenis_transaksi: jenis,
      keterangan: keterangan,
      berat_kg: jenis === "Setor" ? parseFloat(berat) : 0,
      nominal_warga: nominalWarga,
      nominal_kas_rt: nominalKasRT
    };

    const { error } = await supabase.from("transaksi_sampah").insert([payload]);

    if (error) {
      alert("Gagal mencatat transaksi: " + error.message);
    } else {
      alert("Transaksi Bank Sampah Berhasil Dicatat!");
      setKeterangan(""); setBerat(""); setTotalUang(""); setWargaId("");
      fetchData();
    }
    setLoadingSubmit(false);
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Menghubungkan ke posko timbang...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-emerald-600 font-bold hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-8 border-emerald-600 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Posko Bank Sampah RT 07</h1>
            <p className="text-slate-500">Sistem Pencatatan & Kalkulasi Otomatis (85% Warga, 15% Kas RT)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-1 h-fit border-t-4 border-emerald-500">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Catat Transaksi</h2>
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Jenis Transaksi</label>
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer">
                    <input type="radio" className="peer sr-only" checked={jenis === "Setor"} onChange={() => {setJenis("Setor"); setKeterangan(""); setTotalUang("");}} />
                    <div className="text-center p-2 rounded-lg border-2 border-slate-200 peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:text-emerald-700 font-bold transition-all">Setor Sampah</div>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <input type="radio" className="peer sr-only" checked={jenis === "Tarik"} onChange={() => {setJenis("Tarik"); setKeterangan("Tarik Tunai Tabungan"); setTotalUang("");}} />
                    <div className="text-center p-2 rounded-lg border-2 border-slate-200 peer-checked:border-rose-500 peer-checked:bg-rose-50 peer-checked:text-rose-700 font-bold transition-all">Tarik Tunai</div>
                  </label>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Nasabah (Warga)</label>
                <select required className="w-full border border-slate-300 rounded p-2 bg-white text-slate-900 text-sm" value={wargaId} onChange={(e) => setWargaId(e.target.value)}>
                  <option value="" disabled>-- Cari Warga --</option>
                  {wargaList.map(w => (
                    <option key={w.id} value={w.id}>{w.nama_lengkap} - Saldo: Rp {getSaldoWarga(w.id).toLocaleString("id-ID")}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  {jenis === "Setor" ? "Jenis Sampah" : "Keterangan Tarik"}
                </label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2 text-slate-900" placeholder={jenis === "Setor" ? "Cth: Kardus Bekas & Botol" : ""} value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>

              {jenis === "Setor" && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Berat Timbangan (Kg)</label>
                  <input type="number" step="0.1" min="0.1" required={jenis === "Setor"} className="w-full border border-slate-300 rounded-lg p-2 font-mono text-slate-900" placeholder="0.0" value={berat} onChange={(e) => setBerat(e.target.value)} />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-emerald-700 mb-1">
                  {jenis === "Setor" ? "Total Uang Dari Pengepul (Rp)" : "Nominal Tarik Tunai (Rp)"}
                </label>
                <input type="number" required min="1000" className="w-full border-2 border-emerald-400 focus:border-emerald-600 outline-none rounded-lg p-3 font-mono text-xl text-slate-900" placeholder="0" value={totalUang} onChange={(e) => setTotalUang(e.target.value)} />
                {jenis === "Setor" && totalUang && (
                  <div className="mt-2 text-xs font-bold text-slate-500 bg-emerald-50 p-2 rounded border border-emerald-100">
                    Proyeksi: Warga (+Rp {Math.floor(parseInt(totalUang) * 0.85).toLocaleString("id-ID")}) | Kas RT (+Rp {(parseInt(totalUang) - Math.floor(parseInt(totalUang) * 0.85)).toLocaleString("id-ID")})
                  </div>
                )}
              </div>

              <button type="submit" disabled={loadingSubmit} className={`w-full text-white font-bold rounded-lg p-3 shadow-md ${jenis === 'Setor' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                {loadingSubmit ? "Menyimpan Data..." : "Simpan Transaksi"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-6">
            
            {/* INI KODE SCROLL YANG LU HILANGIN TADI */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Riwayat Transaksi Bank Sampah</h2>
              <div className="max-h-[400px] overflow-y-auto relative border border-slate-200 rounded">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-800 text-white">
                      <th className="p-3 border">Tanggal</th>
                      <th className="p-3 border">Nasabah</th>
                      <th className="p-3 border">Transaksi</th>
                      <th className="p-3 border text-right">Saldo Warga</th>
                      <th className="p-3 border text-right">Margin RT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transaksi.length === 0 ? (
                      <tr><td colSpan={5} className="p-4 text-center text-slate-400 font-bold italic">Posko belum mencatat transaksi.</td></tr>
                    ) : (
                      transaksi.map((t) => (
                        <tr key={t.id} className="border-b hover:bg-slate-50">
                          <td className="p-3 border text-slate-600">{new Date(t.created_at).toLocaleDateString('id-ID')}</td>
                          <td className="p-3 border font-bold text-slate-800">{t.warga?.nama_lengkap}</td>
                          <td className="p-3 border">
                            <span className={`text-xs px-2 py-0.5 rounded font-bold ${t.jenis_transaksi === 'Setor' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {t.jenis_transaksi}
                            </span>
                            <div className="text-slate-500 mt-1">{t.keterangan} {t.berat_kg > 0 && `(${t.berat_kg} Kg)`}</div>
                          </td>
                          <td className={`p-3 border text-right font-bold ${t.jenis_transaksi === 'Setor' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {t.jenis_transaksi === 'Setor' ? '+' : '-'} {t.nominal_warga.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 border text-right font-bold text-slate-500">
                            {t.nominal_kas_rt > 0 ? `+ ${t.nominal_kas_rt.toLocaleString('id-ID')}` : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* REKAP SALDO WARGA BIKINAN BARU BIAR RT NGGAK BUTA */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Rekap Saldo Terkini Nasabah</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                {wargaList.map(w => {
                  const saldo = getSaldoWarga(w.id);
                  if (saldo === 0) return null; // Sembunyikan kalau saldonya 0
                  return (
                    <div key={w.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col items-center text-center">
                      <span className="font-bold text-slate-700 text-sm mb-1">{w.nama_lengkap}</span>
                      <span className="font-mono font-black text-emerald-600 text-lg">Rp {saldo.toLocaleString("id-ID")}</span>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
          
        </div>
      </div>
    </div>
  );
}