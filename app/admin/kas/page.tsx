"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminKas() {
  const [transaksi, setTransaksi] = useState<any[]>([]);
  const [wargaList, setWargaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [adminAktif, setAdminAktif] = useState<any>(null);
  const router = useRouter();

  const [wargaId, setWargaId] = useState("");
  const [tipe, setTipe] = useState("Pemasukan");
  const [kategori, setKategori] = useState("Iuran Wajib Bulanan");
  const [nominal, setNominal] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const { data: dataKas } = await supabase.from("kas_rt").select("*, warga(nama_lengkap)").order("created_at", { ascending: false });
    const { data: dataWarga } = await supabase.from("warga").select("id, nama_lengkap").eq("status_verifikasi", "Disetujui");
    
    if (dataKas) setTransaksi(dataKas);
    if (dataWarga) setWargaList(dataWarga);
    setLoading(false);
  };

  useEffect(() => {
    const cekSesi = async () => {
      // FAKTA: Pengecekan JWT Server-side!
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin");
        return;
      }
      
      const { data: profil } = await supabase
        .from("pengurus_rt")
        .select("*")
        .eq("email", session.user.email)
        .single();

      if (profil) {
        setAdminAktif({ id: profil.id, nama: profil.nama_lengkap });
        fetchData();
      }
    };
    cekSesi();
  }, [router]);

  const totalPemasukan = transaksi.filter(t => t.tipe_transaksi === "Pemasukan").reduce((sum, t) => sum + t.nominal, 0);
  const totalPengeluaran = transaksi.filter(t => t.tipe_transaksi === "Pengeluaran").reduce((sum, t) => sum + t.nominal, 0);
  const saldoAkhir = totalPemasukan - totalPengeluaran;

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    const uang = parseInt(nominal);

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: `Input Transaksi Kas: ${tipe}`,
      tabel_target: "kas_rt",
      detail: `${kategori} - Rp ${uang}`
    }]);

    const payload: any = { tipe_transaksi: tipe, kategori, nominal: uang, keterangan };
    if (wargaId) payload.warga_id = wargaId;

    const { error } = await supabase.from("kas_rt").insert([payload]);
    
    if (error) {
      alert("Gagal menyimpan transaksi: " + error.message);
    } else {
      setNominal(""); setKeterangan("");
      fetchData();
    }
    setSubmitLoading(false);
  };

  if (!adminAktif) return null;
  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Membuka brankas Kas RT...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-emerald-600 font-bold hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-8 border-emerald-600">
          <h1 className="text-3xl font-bold text-slate-800">Manajemen Kas RT</h1>
          <p className="text-slate-500">Rekapitulasi iuran warga dan biaya operasional lingkungan.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-blue-500">
            <h3 className="text-xs font-bold text-slate-500 uppercase">Total Pemasukan</h3>
            <div className="text-2xl font-black text-blue-600 mt-1">Rp {totalPemasukan.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-rose-500">
            <h3 className="text-xs font-bold text-slate-500 uppercase">Total Pengeluaran</h3>
            <div className="text-2xl font-black text-rose-600 mt-1">Rp {totalPengeluaran.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-emerald-600 p-5 rounded-xl shadow-lg text-white">
            <h3 className="text-xs font-bold text-emerald-200 uppercase">Saldo Akhir Tersedia</h3>
            <div className="text-3xl font-black mt-1">Rp {saldoAkhir.toLocaleString('id-ID')}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-1 h-fit border border-slate-200">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Catat Transaksi</h2>
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tipe Transaksi</label>
                <select className="w-full border border-slate-300 rounded-lg p-2.5 font-bold" value={tipe} onChange={(e) => setTipe(e.target.value)}>
                  <option value="Pemasukan" className="text-blue-600">Pemasukan (+)</option>
                  <option value="Pengeluaran" className="text-rose-600">Pengeluaran (-)</option>
                </select>
              </div>
              
              {tipe === "Pemasukan" && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Sumber Dana</label>
                  <select className="w-full border border-slate-300 rounded-lg p-2.5" value={wargaId} onChange={(e) => setWargaId(e.target.value)}>
                    <option value="">-- Pemasukan Umum / Non-Warga --</option>
                    {wargaList.map(w => <option key={w.id} value={w.id}>{w.nama_lengkap}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Kategori</label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5" placeholder="Cth: Iuran Keamanan / Bayar Listrik Gapura" value={kategori} onChange={(e) => setKategori(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nominal (Rp)</label>
                <input type="number" required min="100" className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-lg" placeholder="50000" value={nominal} onChange={(e) => setNominal(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Keterangan (Opsional)</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" placeholder="Bulan Maret..." value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>
              
              <button type="submit" disabled={submitLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg p-3 shadow-md mt-2">
                {submitLoading ? "Mencatat..." : "Simpan ke Buku Kas"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-2 border border-slate-200">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Buku Besar Transaksi</h2>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="bg-slate-100 text-slate-600">
                    <th className="p-3 border-b-2">Tanggal & Kategori</th>
                    <th className="p-3 border-b-2">Detail Sumber/Keterangan</th>
                    <th className="p-3 border-b-2 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {transaksi.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-slate-50">
                      <td className="p-3">
                        <div className="text-xs text-slate-500">{new Date(t.created_at).toLocaleString('id-ID')}</div>
                        <div className={`font-bold mt-1 text-xs px-2 py-1 inline-block rounded ${t.tipe_transaksi === 'Pemasukan' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                          {t.kategori}
                        </div>
                      </td>
                      <td className="p-3">
                        {t.warga_id && <div className="font-bold text-slate-800">{t.warga?.nama_lengkap}</div>}
                        <div className="text-slate-600 text-xs italic">{t.keterangan || "-"}</div>
                      </td>
                      <td className={`p-3 text-right font-mono font-black ${t.tipe_transaksi === 'Pemasukan' ? 'text-blue-600' : 'text-rose-600'}`}>
                        {t.tipe_transaksi === 'Pemasukan' ? '+' : '-'} Rp {t.nominal.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}