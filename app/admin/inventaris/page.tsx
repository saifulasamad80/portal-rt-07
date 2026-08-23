"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminInventaris() {
  const [barang, setBarang] = useState<any[]>([]);
  const [peminjaman, setPeminjaman] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [namaBarang, setNamaBarang] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  const [adminAktif, setAdminAktif] = useState<any>(null);
  const router = useRouter();

  const fetchData = async () => {
    setLoading(true);
    // FAKTA: Menggunakan master_inventaris sesuai database asli
    const { data: dataBarang } = await supabase.from("master_inventaris").select("*").order("nama_barang");
    const { data: dataPinjam } = await supabase.from("peminjaman_inventaris").select("*, warga(nama_lengkap), master_inventaris(nama_barang)").order("created_at", { ascending: false });
    
    if (dataBarang) setBarang(dataBarang);
    if (dataPinjam) setPeminjaman(dataPinjam);
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

  const handleTambahBarang = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    const qty = parseInt(jumlah);

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: "Tambah Barang Inventaris",
      tabel_target: "master_inventaris",
      detail: `${namaBarang} (${qty} unit)`
    }]);

    // FAKTA: Insert ke tabel asli dengan kolom asli (total_unit dan deskripsi)
    const { error } = await supabase.from("master_inventaris").insert([{
      nama_barang: namaBarang, total_unit: qty, deskripsi: deskripsi
    }]);

    if (error) {
      alert("Gagal menambahkan barang: " + error.message);
    } else {
      setNamaBarang(""); setJumlah(""); setDeskripsi("");
      fetchData();
    }
    setSubmitLoading(false);
  };

  const updateStatus = async (id: string, idBarang: string, qty: number, statusBaru: string, namaWarga: string, namaAlat: string) => {
    const konfirmasi = confirm(`Ubah status peminjaman menjadi: ${statusBaru}?`);
    if (!konfirmasi) return;

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: `Ubah Status Peminjaman: ${statusBaru}`,
      tabel_target: "peminjaman_inventaris",
      detail: `Barang: ${namaAlat} (${qty} unit), Peminjam: ${namaWarga}`
    }]);

    const payload: any = { status: statusBaru };
    if (statusBaru === 'Dikembalikan') {
      payload.tanggal_kembali = new Date().toISOString();
    }

    const { error } = await supabase.from("peminjaman_inventaris").update(payload).eq("id", id);
    if (error) {
      alert("Gagal update: " + error.message);
      return;
    }
    fetchData();
  };

  if (!adminAktif) return null;
  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Membuka gudang inventaris...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-amber-600 font-bold hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-8 border-amber-600">
          <h1 className="text-3xl font-bold text-slate-800">Manajemen Inventaris RT</h1>
          <p className="text-slate-500">Katalog aset barang dan persetujuan peminjaman warga.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-1 border-t-4 border-amber-500 h-fit">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Tambah Aset Baru</h2>
            <form onSubmit={handleTambahBarang} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nama Barang / Alat</label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5" placeholder="Tenda, Kursi, Sound System..." value={namaBarang} onChange={(e) => setNamaBarang(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Total Unit (Kapasitas)</label>
                <input type="number" required min="1" className="w-full border border-slate-300 rounded-lg p-2.5" placeholder="10" value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Deskripsi Tambahan</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2.5" placeholder="Tenda standar untuk warga" value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
              </div>
              <button type="submit" disabled={submitLoading} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg p-3 shadow-md mt-2">
                {submitLoading ? "Menyimpan..." : "Simpan Aset"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-2">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Katalog Aset Tersedia</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
              {barang.map((b) => (
                <div key={b.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
                  <div className="font-bold text-slate-800 truncate pr-2">{b.nama_barang}</div>
                  <div className="flex justify-between items-end mt-2">
                    <div className="text-[10px] text-slate-500">Kapasitas: <span className="font-bold text-slate-700">{b.total_unit}</span></div>
                    <div className="text-[10px] font-black px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                      Total: {b.total_unit} Unit
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 italic truncate">{b.deskripsi}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-slate-800">
          <h2 className="text-xl font-bold text-slate-700 mb-4 border-b pb-2">Antrean Peminjaman Warga</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-600">
                  <th className="p-3 border-b-2">Tanggal Request</th>
                  <th className="p-3 border-b-2">Peminjam</th>
                  <th className="p-3 border-b-2">Barang & Qty</th>
                  <th className="p-3 border-b-2">Tujuan Penggunaan</th>
                  <th className="p-3 border-b-2 text-center">Status / Aksi</th>
                </tr>
              </thead>
              <tbody>
                {peminjaman.length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-slate-400 italic">Belum ada permintaan pinjaman.</td></tr>
                ) : (
                  peminjaman.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 text-slate-500 text-xs">{new Date(p.created_at).toLocaleString('id-ID')}</td>
                      <td className="p-3 font-bold text-slate-800">{p.warga?.nama_lengkap}</td>
                      <td className="p-3">
                        <div className="font-bold text-blue-700">{p.master_inventaris?.nama_barang || p.nama_barang}</div>
                        <div className="text-xs bg-slate-200 inline-block px-2 py-0.5 rounded mt-1 font-bold">{p.jumlah_pinjam} Unit</div>
                      </td>
                      <td className="p-3 text-slate-600">{p.keperluan}</td>
                      <td className="p-3 text-center">
                        {p.status === 'Menunggu' && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 py-1 rounded mb-1 border border-amber-200">Pending</span>
                            <div className="flex justify-center gap-1">
                              <button onClick={() => updateStatus(p.id, p.barang_id, p.jumlah_pinjam, 'Disetujui', p.warga?.nama_lengkap, p.master_inventaris?.nama_barang || p.nama_barang)} className="bg-emerald-500 text-white text-[10px] px-2 py-1.5 rounded font-bold hover:bg-emerald-600">Terima</button>
                              <button onClick={() => updateStatus(p.id, p.barang_id, p.jumlah_pinjam, 'Ditolak', p.warga?.nama_lengkap, p.master_inventaris?.nama_barang || p.nama_barang)} className="bg-rose-500 text-white text-[10px] px-2 py-1.5 rounded font-bold hover:bg-rose-600">Tolak</button>
                            </div>
                          </div>
                        )}
                        {p.status === 'Disetujui' && (
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200 w-full mb-1">Sedang Dipakai</span>
                            <button onClick={() => updateStatus(p.id, p.barang_id, p.jumlah_pinjam, 'Dikembalikan', p.warga?.nama_lengkap, p.master_inventaris?.nama_barang || p.nama_barang)} className="bg-slate-700 text-white text-[10px] px-3 py-1.5 rounded font-bold hover:bg-slate-800 w-full">Tandai Kembali</button>
                          </div>
                        )}
                        {p.status === 'Ditolak' && <span className="text-xs font-bold text-rose-500 line-through">Ditolak RT</span>}
                        {p.status === 'Dikembalikan' && <span className="text-xs font-bold text-slate-400">Selesai Dikembalikan</span>}
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
  );
}