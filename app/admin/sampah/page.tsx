"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminSampah() {
  const [transaksi, setTransaksi] = useState<any[]>([]);
  const [wargaList, setWargaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [adminAktif, setAdminAktif] = useState<any>(null);
  const router = useRouter();

  const [wargaId, setWargaId] = useState("");
  const [jenis, setJenis] = useState("Setor");
  const [berat, setBerat] = useState("");
  const [nominalWarga, setNominalWarga] = useState("");
  const [nominalKas, setNominalKas] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const { data: dataSampah } = await supabase.from("transaksi_sampah").select("*, warga(nama_lengkap)").order("created_at", { ascending: false });
    const { data: dataWarga } = await supabase.from("warga").select("id, nama_lengkap").eq("status_verifikasi", "Disetujui");
    
    if (dataSampah) setTransaksi(dataSampah);
    if (dataWarga) setWargaList(dataWarga);
    setLoading(false);
  };

  useEffect(() => {
    const cekSesi = async () => {
      // FAKTA: Pengecekan JWT Server-side
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

  const getSaldoWarga = (id: string) => {
    const trxWarga = transaksi.filter(s => s.warga_id === id);
    const setor = trxWarga.filter(t => t.jenis_transaksi === "Setor").reduce((sum, t) => sum + t.nominal_warga, 0);
    const tarik = trxWarga.filter(t => t.jenis_transaksi === "Tarik").reduce((sum, t) => sum + t.nominal_warga, 0);
    return setor - tarik;
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wargaId) return alert("Pilih warga penyetor/penarik!");
    setSubmitLoading(true);

    const nilaiWarga = parseInt(nominalWarga) || 0;
    const nilaiKas = parseInt(nominalKas) || 0;
    const nilaiBerat = parseFloat(berat) || 0;

    if (jenis === "Tarik" && nilaiWarga > getSaldoWarga(wargaId)) {
      alert("DITOLAK: Saldo warga tidak mencukupi untuk penarikan.");
      setSubmitLoading(false);
      return;
    }

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: `Transaksi Sampah: ${jenis}`,
      tabel_target: "transaksi_sampah",
      detail: `Warga ID: ${wargaId} | Rp ${nilaiWarga}`
    }]);

    const { error } = await supabase.from("transaksi_sampah").insert([{
      warga_id: wargaId, 
      jenis_transaksi: jenis, 
      berat_kg: nilaiBerat, 
      nominal_warga: nilaiWarga, 
      nominal_kas_rt: nilaiKas, 
      keterangan 
    }]);
    
    if (error) {
      alert("Gagal mencatat transaksi: " + error.message);
    } else {
      setBerat(""); setNominalWarga(""); setNominalKas(""); setKeterangan("");
      fetchData();
    }
    setSubmitLoading(false);
  };

  if (!adminAktif) return null;
  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Memuat data Bank Sampah...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-emerald-700 font-bold hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-8 border-emerald-700">
          <h1 className="text-3xl font-bold text-slate-800">Manajemen Bank Sampah</h1>
          <p className="text-slate-500">Konversi daur ulang warga menjadi tabungan finansial.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-1 border-t-4 border-emerald-600">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Catat Penimbangan / Tarik</h2>
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Nasabah (Warga)</label>
                <select required className="w-full border border-slate-300 rounded-lg p-2.5" value={wargaId} onChange={(e) => setWargaId(e.target.value)}>
                  <option value="">-- Pilih Warga --</option>
                  {wargaList.map(w => (
                    <option key={w.id} value={w.id}>{w.nama_lengkap} {wargaId === w.id ? `(Saldo: Rp ${getSaldoWarga(w.id).toLocaleString('id-ID')})` : ''}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Jenis Layanan</label>
                <select className="w-full border border-slate-300 rounded-lg p-2.5 font-bold" value={jenis} onChange={(e) => setJenis(e.target.value)}>
                  <option value="Setor" className="text-emerald-600">Setor Sampah (+)</option>
                  <option value="Tarik" className="text-amber-600">Tarik Saldo (-)</option>
                </select>
              </div>

              {jenis === "Setor" && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Berat Timbangan (Kg)</label>
                  <input type="number" step="0.1" className="w-full border border-slate-300 rounded-lg p-2.5" placeholder="Cth: 2.5" value={berat} onChange={(e) => setBerat(e.target.value)} />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  {jenis === "Setor" ? "Nilai Rupiah untuk Warga" : "Nominal Ditarik (Rp)"}
                </label>
                <input type="number" required min="500" className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-lg" placeholder="10000" value={nominalWarga} onChange={(e) => setNominalWarga(e.target.value)} />
              </div>
              
              {jenis === "Setor" && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nilai Margin untuk Kas RT</label>
                  <input type="number" className="w-full border border-slate-300 rounded-lg p-2.5 font-mono" placeholder="2000" value={nominalKas} onChange={(e) => setNominalKas(e.target.value)} />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Keterangan Barang</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm" placeholder="Kardus & Botol plastik..." value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>
              
              <button type="submit" disabled={submitLoading} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg p-3 shadow-md mt-2">
                {submitLoading ? "Memproses..." : "Eksekusi Transaksi"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-2">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Riwayat Transaksi Bank Sampah</h2>
            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                  <tr className="bg-slate-100 text-slate-600">
                    <th className="p-3 border-b-2">Tanggal / Warga</th>
                    <th className="p-3 border-b-2">Transaksi</th>
                    <th className="p-3 border-b-2 text-right">Nilai Warga</th>
                    <th className="p-3 border-b-2 text-right">Margin RT</th>
                  </tr>
                </thead>
                <tbody>
                  {transaksi.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-slate-50">
                      <td className="p-3">
                        <div className="text-xs text-slate-500">{new Date(t.created_at).toLocaleString('id-ID')}</div>
                        <div className="font-bold text-slate-800 mt-1">{t.warga?.nama_lengkap}</div>
                      </td>
                      <td className="p-3">
                        {t.jenis_transaksi === 'Setor' ? 
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded">SETOR {t.berat_kg} Kg</span> : 
                          <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded">TARIK SALDO</span>
                        }
                        <div className="text-slate-600 text-[10px] mt-1 italic max-w-[150px] truncate">{t.keterangan || "-"}</div>
                      </td>
                      <td className={`p-3 text-right font-mono font-bold ${t.jenis_transaksi === 'Setor' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {t.jenis_transaksi === 'Setor' ? '+' : '-'} Rp {t.nominal_warga.toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-blue-600">
                        {t.nominal_kas_rt > 0 ? `+ Rp ${t.nominal_kas_rt.toLocaleString('id-ID')}` : '-'}
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