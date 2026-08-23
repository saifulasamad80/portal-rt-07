"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminKurban() {
  const [transaksi, setTransaksi] = useState<any[]>([]);
  const [wargaList, setWargaList] = useState<any[]>([]);
  const [sampahList, setSampahList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  const [adminAktif, setAdminAktif] = useState<any>(null);
  const router = useRouter();

  const [wargaId, setWargaId] = useState("");
  const [jenis, setJenis] = useState("Setor");
  const [sumberDana, setSumberDana] = useState("Tunai");
  const [nominal, setNominal] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const { data: dataKurban } = await supabase.from("tabungan_kurban").select("*, warga(nama_lengkap)").order("created_at", { ascending: false });
    const { data: dataWarga } = await supabase.from("warga").select("id, nama_lengkap").eq("status_verifikasi", "Disetujui");
    const { data: dataSampah } = await supabase.from("transaksi_sampah").select("*");

    if (dataKurban) setTransaksi(dataKurban);
    if (dataWarga) setWargaList(dataWarga);
    if (dataSampah) setSampahList(dataSampah);
    
    setLoading(false);
  };

  useEffect(() => {
    const cekSesi = async () => {
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

  const getSaldoSampah = (id: string) => {
    const trxWarga = sampahList.filter(s => s.warga_id === id);
    const setor = trxWarga.filter(t => t.jenis_transaksi === "Setor").reduce((sum, t) => sum + t.nominal_warga, 0);
    const tarik = trxWarga.filter(t => t.jenis_transaksi === "Tarik").reduce((sum, t) => sum + t.nominal_warga, 0);
    return setor - tarik;
  };

  const getSaldoKurban = (id: string) => {
    const trxWarga = transaksi.filter(s => s.warga_id === id);
    const setor = trxWarga.filter(t => t.jenis_transaksi === "Setor").reduce((sum, t) => sum + t.nominal, 0);
    const tarik = trxWarga.filter(t => t.jenis_transaksi === "Tarik").reduce((sum, t) => sum + t.nominal, 0);
    return setor - tarik;
  };

  // FAKTA: Kalkulasi Total Keseluruhan Dana Kurban RT
  const totalDanaKeseluruhan = transaksi.filter(t => t.jenis_transaksi === "Setor").reduce((sum, t) => sum + t.nominal, 0) - 
                               transaksi.filter(t => t.jenis_transaksi === "Tarik").reduce((sum, t) => sum + t.nominal, 0);

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wargaId) return alert("Pilih warga terlebih dahulu!");

    setSubmitLoading(true);
    const uang = parseInt(nominal);

    if (jenis === "Tarik") {
      const saldoKurban = getSaldoKurban(wargaId);
      if (uang > saldoKurban) {
        alert(`Ditolak! Saldo kurban warga tidak cukup. Saldo saat ini: Rp ${saldoKurban.toLocaleString('id-ID')}`);
        setSubmitLoading(false);
        return;
      }

      await supabase.from("audit_log").insert([{
        aktor: adminAktif.nama,
        aksi: "Tarik Saldo Kurban",
        tabel_target: "tabungan_kurban",
        detail: `Menarik Rp ${uang} untuk Warga ID: ${wargaId}`
      }]);

      const { error } = await supabase.from("tabungan_kurban").insert([{
        warga_id: wargaId, jenis_transaksi: jenis, sumber_dana: sumberDana, nominal: uang, keterangan
      }]);

      if (error) alert("Gagal menarik kurban: " + error.message);
      else finishSimpan();

    } else if (jenis === "Setor" && sumberDana === "Potong Saldo Sampah") {
      
      const { error } = await supabase.rpc("eksekusi_autodebet_kurban", {
        p_warga_id: wargaId,
        p_nominal: uang,
        p_keterangan: keterangan || "Auto-debet kurban",
        p_aktor: adminAktif.nama
      });

      if (error) {
        if (error.message.includes("SALDO_TIDAK_CUKUP")) {
          alert("TRANSAKSI DITOLAK (SERVER): Saldo Bank Sampah warga tidak mencukupi untuk dipotong!");
        } else {
          alert("Gagal memproses auto-debet: " + error.message);
        }
      } else {
        alert("Transaksi Auto-Debet Berhasil dan Tercatat Aman!");
        finishSimpan();
      }

    } else {
      await supabase.from("audit_log").insert([{
        aktor: adminAktif.nama,
        aksi: "Setor Saldo Kurban",
        tabel_target: "tabungan_kurban",
        detail: `Setor Rp ${uang} (${sumberDana}) untuk Warga ID: ${wargaId}`
      }]);

      const { error } = await supabase.from("tabungan_kurban").insert([{
        warga_id: wargaId, jenis_transaksi: jenis, sumber_dana: sumberDana, nominal: uang, keterangan
      }]);

      if (error) alert("Gagal setor kurban: " + error.message);
      else finishSimpan();
    }
  };

  const finishSimpan = () => {
    setWargaId(""); setNominal(""); setKeterangan("");
    fetchData();
    setSubmitLoading(false);
  };

  if (!adminAktif) return null;
  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Membuka catatan kurban...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-amber-700 font-bold hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        {/* FAKTA: Brankas Utama dikembalikan ke UI */}
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-8 border-amber-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Manajemen Tabungan Kurban</h1>
            <p className="text-slate-500">Kelola cicilan kurban Idul Adha dengan fitur auto-debet bank sampah.</p>
          </div>
          <div className="bg-amber-100 border border-amber-200 p-4 rounded-xl text-left md:text-right min-w-[250px] shadow-inner">
            <div className="text-xs font-black text-amber-700 uppercase tracking-wider mb-1">Total Dana Terkumpul</div>
            <div className="text-3xl font-black text-amber-900">
              Rp {totalDanaKeseluruhan.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-1 h-fit border-t-4 border-amber-500">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Catat Transaksi</h2>
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Warga</label>
                <select required className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900" value={wargaId} onChange={(e) => setWargaId(e.target.value)}>
                  <option value="">-- Pilih Warga --</option>
                  {wargaList.map(w => (
                    <option key={w.id} value={w.id}>{w.nama_lengkap} {wargaId === w.id ? `(Saldo: Rp ${getSaldoKurban(w.id).toLocaleString('id-ID')})` : ''}</option>
                  ))}
                </select>
                {wargaId && jenis === "Setor" && sumberDana === "Potong Saldo Sampah" && (
                  <div className="text-[10px] font-bold text-blue-600 mt-1 bg-blue-50 p-2 rounded border border-blue-200">
                    Sisa Saldo Bank Sampah Warga ini: Rp {getSaldoSampah(wargaId).toLocaleString('id-ID')}
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Jenis</label>
                  <select className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 font-bold" value={jenis} onChange={(e) => setJenis(e.target.value)}>
                    <option value="Setor" className="text-emerald-600">Setor</option>
                    <option value="Tarik" className="text-rose-600">Tarik Dana</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Metode</label>
                  <select className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900" value={sumberDana} onChange={(e) => setSumberDana(e.target.value)}>
                    <option value="Tunai">Tunai</option>
                    <option value="Transfer">Transfer</option>
                    {jenis === "Setor" && <option value="Potong Saldo Sampah" className="font-bold text-amber-700">Auto-Debet Sampah</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nominal (Rp)</label>
                <input type="number" required min="1000" className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 font-mono text-lg" placeholder="50000" value={nominal} onChange={(e) => setNominal(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Keterangan (Opsional)</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm" placeholder="Koreksi salah transfer..." value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>
              
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-[10px] text-slate-500 italic mt-2">
                <span className="font-bold text-rose-600 block mb-1">ATURAN AUDIT:</span>
                Transaksi bersifat permanen (Immutable Ledger). Jika terjadi kesalahan input, lakukan pencatatan dengan jenis <b>Tarik Dana</b> sebagai kompensasi perbaikan.
              </div>

              <button type="submit" disabled={submitLoading} className={`w-full text-white font-bold rounded-lg p-3 shadow-md mt-2 ${submitLoading ? 'bg-slate-400' : 'bg-amber-700 hover:bg-amber-800'}`}>
                {submitLoading ? "Memproses..." : "Simpan Transaksi"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-2">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Riwayat Tabungan Kurban</h2>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-800 text-white">
                    <th className="p-3 border">Tanggal</th>
                    <th className="p-3 border">Nama Warga</th>
                    <th className="p-3 border">Transaksi & Metode</th>
                    <th className="p-3 border text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {transaksi.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 border text-slate-600 text-xs">{new Date(t.created_at).toLocaleString('id-ID')}</td>
                      <td className="p-3 border font-bold text-slate-800">{t.warga?.nama_lengkap}</td>
                      <td className="p-3 border">
                        {t.jenis_transaksi === 'Setor' ? 
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded">SETOR</span> : 
                          <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-1 rounded">TARIK</span>
                        }
                        <span className="text-xs text-slate-500 ml-2">via {t.sumber_dana}</span>
                        {t.keterangan && <div className="text-[10px] text-slate-400 mt-1 italic">{t.keterangan}</div>}
                      </td>
                      <td className={`p-3 border text-right font-mono font-bold ${t.jenis_transaksi === 'Setor' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.jenis_transaksi === 'Setor' ? '+' : '-'} Rp {t.nominal.toLocaleString('id-ID')}
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