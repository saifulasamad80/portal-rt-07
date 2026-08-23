"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function AdminKurban() {
  const [trxKurban, setTrxKurban] = useState<any[]>([]);
  const [trxSampah, setTrxSampah] = useState<any[]>([]);
  const [wargaList, setWargaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [wargaId, setWargaId] = useState("");
  const [jenis, setJenis] = useState("Setor");
  const [sumberDana, setSumberDana] = useState("Tunai / Transfer");
  const [nominal, setNominal] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const { data: dataKurban } = await supabase.from("tabungan_kurban").select("*, warga(nama_lengkap)").order("created_at", { ascending: false });
    const { data: dataSampah } = await supabase.from("transaksi_sampah").select("*");
    const { data: dataWarga } = await supabase.from("warga").select("id, nama_lengkap").eq("status_verifikasi", "Disetujui").order("nama_lengkap", { ascending: true });

    setTrxKurban(dataKurban || []);
    setTrxSampah(dataSampah || []);
    setWargaList(dataWarga || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getSaldoKurban = (id: string) => {
    const trx = trxKurban.filter(t => t.warga_id === id);
    return trx.filter(t => t.jenis_transaksi === "Setor").reduce((sum, t) => sum + t.nominal, 0) - trx.filter(t => t.jenis_transaksi === "Tarik").reduce((sum, t) => sum + t.nominal, 0);
  };

  const getSaldoSampah = (id: string) => {
    const trx = trxSampah.filter(t => t.warga_id === id);
    return trx.filter(t => t.jenis_transaksi === "Setor").reduce((sum, t) => sum + t.nominal_warga, 0) - trx.filter(t => t.jenis_transaksi === "Tarik").reduce((sum, t) => sum + t.nominal_warga, 0);
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wargaId) return alert("Pilih warga terlebih dahulu!");

    const uang = parseInt(nominal);
    const saldoSampah = getSaldoSampah(wargaId);
    const saldoKurban = getSaldoKurban(wargaId);

    if (jenis === "Tarik" && uang > saldoKurban) {
      return alert(`Ditolak! Saldo kurban tidak cukup. Saldo saat ini: Rp ${saldoKurban.toLocaleString("id-ID")}`);
    }
    if (jenis === "Setor" && sumberDana === "Potong Saldo Sampah" && uang > saldoSampah) {
      return alert(`Ditolak! Saldo Bank Sampah tidak cukup untuk dipotong. Saldo sampah: Rp ${saldoSampah.toLocaleString("id-ID")}`);
    }

    setSubmitLoading(true);

    const { error: errKurban } = await supabase.from("tabungan_kurban").insert([{
      warga_id: wargaId, jenis_transaksi: jenis, sumber_dana: jenis === "Setor" ? sumberDana : "-", nominal: uang, keterangan: keterangan
    }]);

    if (errKurban) {
      alert("Gagal mencatat kurban: " + errKurban.message);
      setSubmitLoading(false);
      return;
    }

    if (jenis === "Setor" && sumberDana === "Potong Saldo Sampah") {
      const { error: errSampah } = await supabase.from("transaksi_sampah").insert([{
        warga_id: wargaId, jenis_transaksi: "Tarik", keterangan: "Auto-Debet untuk Tabungan Kurban", berat_kg: 0, nominal_warga: uang, nominal_kas_rt: 0
      }]);
      if (errSampah) alert("Peringatan: Gagal memotong saldo sampah secara otomatis.");
    }

    alert("Transaksi Kurban Berhasil Dieksekusi!");
    setNominal(""); setKeterangan(""); setWargaId(""); setSumberDana("Tunai / Transfer");
    fetchData(); 
    setSubmitLoading(false);
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Membuka brankas kurban...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-amber-600 font-bold hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-8 border-amber-500">
          <h1 className="text-3xl font-bold text-slate-800">Panitia Kurban RT 07</h1>
          <p className="text-slate-500">Sistem Tabungan Mandiri (Terintegrasi Bank Sampah)</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-1 h-fit border-t-4 border-amber-500">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Catat Setoran</h2>
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Warga</label>
                <select required className="w-full border border-slate-300 rounded p-2 bg-white text-slate-900 text-sm" value={wargaId} onChange={(e) => setWargaId(e.target.value)}>
                  <option value="" disabled>-- Cari Warga --</option>
                  {wargaList.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.nama_lengkap} (Kurban: Rp {getSaldoKurban(w.id).toLocaleString("id-ID")} | Sampah: Rp {getSaldoSampah(w.id).toLocaleString("id-ID")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <label className="flex-1 cursor-pointer">
                  <input type="radio" className="peer sr-only" checked={jenis === "Setor"} onChange={() => setJenis("Setor")} />
                  <div className="text-center p-2 rounded-lg border-2 border-slate-200 peer-checked:border-amber-500 peer-checked:bg-amber-50 peer-checked:text-amber-700 font-bold transition-all">Setor Nabung</div>
                </label>
                <label className="flex-1 cursor-pointer">
                  <input type="radio" className="peer sr-only" checked={jenis === "Tarik"} onChange={() => {setJenis("Tarik"); setSumberDana("-");}} />
                  <div className="text-center p-2 rounded-lg border-2 border-slate-200 peer-checked:border-rose-500 peer-checked:bg-rose-50 peer-checked:text-rose-700 font-bold transition-all">Tarik / Batal</div>
                </label>
              </div>

              {jenis === "Setor" && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Sumber Dana</label>
                  <select className="w-full border border-slate-300 rounded p-2 bg-white text-slate-900" value={sumberDana} onChange={(e) => setSumberDana(e.target.value)}>
                    <option value="Tunai / Transfer">Uang Tunai / Transfer</option>
                    <option value="Potong Saldo Sampah">Potong Saldo Bank Sampah</option>
                  </select>
                  {sumberDana === "Potong Saldo Sampah" && wargaId && (
                    <div className="mt-1 text-xs text-rose-600 font-bold">*Sistem akan mengurangi saldo Bank Sampah secara otomatis.</div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-amber-700 mb-1">Nominal (Rp)</label>
                <input type="number" required min="1000" className="w-full border-2 border-amber-400 focus:border-amber-600 outline-none rounded-lg p-3 font-mono text-xl text-slate-900" placeholder="0" value={nominal} onChange={(e) => setNominal(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Keterangan</label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2 text-slate-900" placeholder="Cth: Setoran bulan berjalan" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>

              <button type="submit" disabled={submitLoading} className="w-full bg-amber-600 text-white font-bold rounded-lg p-3 shadow-md hover:bg-amber-700">
                {submitLoading ? "Mengeksekusi..." : "Simpan Transaksi"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-6">
            
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Riwayat Tabungan Kurban Warga</h2>
              <div className="max-h-[400px] overflow-y-auto relative border border-slate-200 rounded">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-800 text-white">
                      <th className="p-3 border">Tgl</th>
                      <th className="p-3 border">Warga</th>
                      <th className="p-3 border">Keterangan & Sumber Dana</th>
                      <th className="p-3 border text-right">Mutasi (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trxKurban.length === 0 ? (
                      <tr><td colSpan={4} className="p-4 text-center text-slate-400 font-bold italic">Belum ada warga yang menabung kurban.</td></tr>
                    ) : (
                      trxKurban.map((t) => (
                        <tr key={t.id} className="border-b hover:bg-slate-50">
                          <td className="p-3 border text-slate-600">{new Date(t.created_at).toLocaleDateString('id-ID')}</td>
                          <td className="p-3 border font-bold text-slate-800">{t.warga?.nama_lengkap}</td>
                          <td className="p-3 border">
                            <div className="font-bold text-slate-800">{t.keterangan}</div>
                            <span className={`text-xs px-2 py-0.5 rounded font-bold ${t.sumber_dana === 'Potong Saldo Sampah' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                              {t.jenis_transaksi === 'Setor' ? `Asal: ${t.sumber_dana}` : 'Penarikan Dana'}
                            </span>
                          </td>
                          <td className={`p-3 border text-right font-bold ${t.jenis_transaksi === 'Setor' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {t.jenis_transaksi === 'Setor' ? '+' : '-'} {t.nominal.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* REKAP SALDO KURBAN BIAR RT NGGAK BUTA */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Rekap Saldo Terkini Tabungan Kurban</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                {wargaList.map(w => {
                  const saldo = getSaldoKurban(w.id);
                  if (saldo === 0) return null;
                  return (
                    <div key={w.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col items-center text-center">
                      <span className="font-bold text-slate-700 text-sm mb-1">{w.nama_lengkap}</span>
                      <span className="font-mono font-black text-amber-600 text-lg">Rp {saldo.toLocaleString("id-ID")}</span>
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