"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type TabId = "lansia" | "balita" | "arisan";

export default function IbuIbuAdminClient({
  posyanduLansia,
  posyanduBalita,
  arisan,
  transaksi,
  aksiSimpanLansia,
  aksiSimpanBalita,
  aksiSimpanArisan,
  aksiSimpanTransaksi,
  aksiHapus,
}: {
  posyanduLansia: any[];
  posyanduBalita: any[];
  arisan: any[];
  transaksi: any[];
  aksiSimpanLansia: (payload: any) => Promise<{ success: boolean; message?: string }>;
  aksiSimpanBalita: (payload: any) => Promise<{ success: boolean; message?: string }>;
  aksiSimpanArisan: (payload: any) => Promise<{ success: boolean; message?: string }>;
  aksiSimpanTransaksi: (payload: any) => Promise<{ success: boolean; message?: string }>;
  aksiHapus: (tabel: string, id: string) => Promise<{ success: boolean; message?: string }>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("lansia");
  const [loading, setLoading] = useState(false);
  const [lansia, setLansia] = useState({ nama_peserta: "", tanggal_lahir: "", tanggal_kunjungan: "", tekanan_darah: "", gula_darah: "", berat_kg: "", catatan: "" });
  const [balita, setBalita] = useState({ nama_anak: "", nama_ibu: "", tanggal_lahir: "", tanggal_kunjungan: "", berat_kg: "", tinggi_cm: "", imunisasi: "", catatan: "" });
  const [arisanForm, setArisanForm] = useState({ nama_anggota: "", no_whatsapp: "", status_keanggotaan: "Aktif", setoran_terakhir: "0", pinjaman_berjalan: "0", catatan: "" });
  const [transaksiForm, setTransaksiForm] = useState({ arisan_id: "", jenis: "Setoran", nominal: "", catatan: "" });

  const simpan = async (jenis: TabId) => {
    setLoading(true);
    try {
      let res;
      if (jenis === "lansia") res = await aksiSimpanLansia(lansia);
      else if (jenis === "balita") res = await aksiSimpanBalita(balita);
      else res = await aksiSimpanArisan(arisanForm);
      if (!res.success) alert(res.message || "Gagal menyimpan");
      else router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  };

  const simpanTransaksi = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await aksiSimpanTransaksi(transaksiForm);
      if (!res.success) alert(res.message || "Gagal menyimpan transaksi");
      else {
        setTransaksiForm({ arisan_id: transaksiForm.arisan_id, jenis: "Setoran", nominal: "", catatan: "" });
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  };

  const hapus = async (tabel: string, id: string) => {
    if (!confirm("Hapus catatan ini?")) return;
    const res = await aksiHapus(tabel, id);
    if (!res.success) alert(res.message || "Gagal menghapus");
    else router.refresh();
  };

  const totalSetoran = arisan.reduce((sum, a) => sum + Number(a.setoran_terakhir || 0), 0);
  const totalPinjaman = arisan.reduce((sum, a) => sum + Number(a.pinjaman_berjalan || 0), 0);
  const anggotaMenunggu = arisan.filter((a) => a.status_keanggotaan === "Menunggu").length;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link href="/admin" className="text-blue-600 font-bold text-sm hover:underline">&larr; Kembali ke Pusat Komando</Link>
        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl">
          <h1 className="text-2xl font-black text-white">Modul Ibu-ibu RT</h1>
          <p className="text-slate-400 text-sm mt-1">Posyandu lansia, posyandu balita, dan simpan-pinjam arisan.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kunjungan Lansia</div>
            <div className="text-lg font-black text-violet-600">{posyanduLansia.length}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kunjungan Balita</div>
            <div className="text-lg font-black text-sky-600">{posyanduBalita.length}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Anggota Arisan</div>
            <div className="text-lg font-black text-rose-600">{arisan.length}</div>
            {anggotaMenunggu > 0 && <div className="text-[9px] font-bold text-amber-600 mt-0.5">{anggotaMenunggu} menunggu</div>}
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Setoran</div>
            <div className="text-lg font-black text-emerald-600">Rp {(totalSetoran / 1000).toFixed(0)}k</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pinjaman Berjalan</div>
            <div className="text-lg font-black text-amber-600">Rp {(totalPinjaman / 1000).toFixed(0)}k</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["lansia", "balita", "arisan"] as TabId[]).map((id) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`px-4 py-2 rounded-full text-xs font-black uppercase ${tab === id ? "bg-rose-600 text-white" : "bg-white border text-slate-600"}`}>
              {id === "lansia" ? "Posyandu Lansia" : id === "balita" ? "Posyandu Balita" : "Arisan"}
            </button>
          ))}
        </div>

        {tab === "lansia" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <form className="bg-white p-6 rounded-2xl border space-y-3" onSubmit={(e) => { e.preventDefault(); simpan("lansia"); }}>
              <h2 className="font-black">Catat kunjungan lansia</h2>
              <input required placeholder="Nama peserta" className="w-full border rounded-lg p-3 text-sm" value={lansia.nama_peserta} onChange={(e) => setLansia({ ...lansia, nama_peserta: e.target.value })} />
              <input type="date" className="w-full border rounded-lg p-3 text-sm" value={lansia.tanggal_kunjungan} onChange={(e) => setLansia({ ...lansia, tanggal_kunjungan: e.target.value })} />
              <input placeholder="Tekanan darah" className="w-full border rounded-lg p-3 text-sm" value={lansia.tekanan_darah} onChange={(e) => setLansia({ ...lansia, tekanan_darah: e.target.value })} />
              <input placeholder="Gula darah" className="w-full border rounded-lg p-3 text-sm" value={lansia.gula_darah} onChange={(e) => setLansia({ ...lansia, gula_darah: e.target.value })} />
              <input placeholder="Berat (kg)" className="w-full border rounded-lg p-3 text-sm" value={lansia.berat_kg} onChange={(e) => setLansia({ ...lansia, berat_kg: e.target.value })} />
              <textarea placeholder="Catatan" className="w-full border rounded-lg p-3 text-sm" value={lansia.catatan} onChange={(e) => setLansia({ ...lansia, catatan: e.target.value })} />
              <button disabled={loading} className="w-full bg-rose-600 text-white font-bold py-3 rounded-lg">{loading ? "Menyimpan..." : "Simpan"}</button>
            </form>
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border space-y-3">
              {posyanduLansia.map((row) => (
                <div key={row.id} className="border rounded-xl p-4 flex justify-between gap-3">
                  <div>
                    <p className="font-bold">{row.nama_peserta}</p>
                    <p className="text-xs text-slate-500">{row.tanggal_kunjungan} · TD {row.tekanan_darah || "-"} · Gula {row.gula_darah || "-"}</p>
                  </div>
                  <button onClick={() => hapus("posyandu_lansia", row.id)} className="text-xs text-rose-600 font-bold">Hapus</button>
                </div>
              ))}
              {posyanduLansia.length === 0 && <p className="text-sm text-slate-400">Belum ada data.</p>}
            </div>
          </div>
        )}

        {tab === "balita" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <form className="bg-white p-6 rounded-2xl border space-y-3" onSubmit={(e) => { e.preventDefault(); simpan("balita"); }}>
              <h2 className="font-black">Catat kunjungan balita</h2>
              <input required placeholder="Nama anak" className="w-full border rounded-lg p-3 text-sm" value={balita.nama_anak} onChange={(e) => setBalita({ ...balita, nama_anak: e.target.value })} />
              <input placeholder="Nama ibu" className="w-full border rounded-lg p-3 text-sm" value={balita.nama_ibu} onChange={(e) => setBalita({ ...balita, nama_ibu: e.target.value })} />
              <input type="date" className="w-full border rounded-lg p-3 text-sm" value={balita.tanggal_kunjungan} onChange={(e) => setBalita({ ...balita, tanggal_kunjungan: e.target.value })} />
              <input placeholder="Berat (kg)" className="w-full border rounded-lg p-3 text-sm" value={balita.berat_kg} onChange={(e) => setBalita({ ...balita, berat_kg: e.target.value })} />
              <input placeholder="Tinggi (cm)" className="w-full border rounded-lg p-3 text-sm" value={balita.tinggi_cm} onChange={(e) => setBalita({ ...balita, tinggi_cm: e.target.value })} />
              <input placeholder="Imunisasi" className="w-full border rounded-lg p-3 text-sm" value={balita.imunisasi} onChange={(e) => setBalita({ ...balita, imunisasi: e.target.value })} />
              <textarea placeholder="Catatan" className="w-full border rounded-lg p-3 text-sm" value={balita.catatan} onChange={(e) => setBalita({ ...balita, catatan: e.target.value })} />
              <button disabled={loading} className="w-full bg-rose-600 text-white font-bold py-3 rounded-lg">{loading ? "Menyimpan..." : "Simpan"}</button>
            </form>
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border space-y-3">
              {posyanduBalita.map((row) => (
                <div key={row.id} className="border rounded-xl p-4 flex justify-between gap-3">
                  <div>
                    <p className="font-bold">{row.nama_anak}</p>
                    <p className="text-xs text-slate-500">{row.nama_ibu || "Ibu tidak dicatat"} · {row.tanggal_kunjungan} · {row.berat_kg || "-"} kg</p>
                  </div>
                  <button onClick={() => hapus("posyandu_balita", row.id)} className="text-xs text-rose-600 font-bold">Hapus</button>
                </div>
              ))}
              {posyanduBalita.length === 0 && <p className="text-sm text-slate-400">Belum ada data.</p>}
            </div>
          </div>
        )}

        {tab === "arisan" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <form className="bg-white p-6 rounded-2xl border space-y-3" onSubmit={(e) => { e.preventDefault(); simpan("arisan"); }}>
              <h2 className="font-black">Anggota / simpan-pinjam</h2>
              <input required placeholder="Nama anggota" className="w-full border rounded-lg p-3 text-sm" value={arisanForm.nama_anggota} onChange={(e) => setArisanForm({ ...arisanForm, nama_anggota: e.target.value })} />
              <input placeholder="WhatsApp" className="w-full border rounded-lg p-3 text-sm" value={arisanForm.no_whatsapp} onChange={(e) => setArisanForm({ ...arisanForm, no_whatsapp: e.target.value })} />
              <select className="w-full border rounded-lg p-3 text-sm" value={arisanForm.status_keanggotaan} onChange={(e) => setArisanForm({ ...arisanForm, status_keanggotaan: e.target.value })}>
                <option>Aktif</option>
                <option>Menunggu</option>
                <option>Lunas</option>
                <option>Nonaktif</option>
              </select>
              <input placeholder="Setoran terakhir (Rp)" className="w-full border rounded-lg p-3 text-sm" value={arisanForm.setoran_terakhir} onChange={(e) => setArisanForm({ ...arisanForm, setoran_terakhir: e.target.value })} />
              <input placeholder="Pinjaman berjalan (Rp)" className="w-full border rounded-lg p-3 text-sm" value={arisanForm.pinjaman_berjalan} onChange={(e) => setArisanForm({ ...arisanForm, pinjaman_berjalan: e.target.value })} />
              <textarea placeholder="Catatan" className="w-full border rounded-lg p-3 text-sm" value={arisanForm.catatan} onChange={(e) => setArisanForm({ ...arisanForm, catatan: e.target.value })} />
              <button disabled={loading} className="w-full bg-rose-600 text-white font-bold py-3 rounded-lg">{loading ? "Menyimpan..." : "Simpan"}</button>
            </form>
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border space-y-3">
              {arisan.map((row) => (
                <div key={row.id} className="border rounded-xl p-4 flex justify-between gap-3">
                  <div>
                    <p className="font-bold">{row.nama_anggota}</p>
                    <p className="text-xs text-slate-500">{row.status_keanggotaan} · Setor Rp {Number(row.setoran_terakhir || 0).toLocaleString("id-ID")} · Pinjam Rp {Number(row.pinjaman_berjalan || 0).toLocaleString("id-ID")}</p>
                  </div>
                  <button onClick={() => hapus("arisan_ibu", row.id)} className="text-xs text-rose-600 font-bold">Hapus</button>
                </div>
              ))}
              {arisan.length === 0 && <p className="text-sm text-slate-400">Belum ada data.</p>}
            </div>
            <form className="lg:col-span-3 bg-white p-6 rounded-2xl border space-y-3" onSubmit={simpanTransaksi}>
              <h2 className="font-black">Catat simpan-pinjam</h2>
              <select required className="w-full border rounded-lg p-3 text-sm" value={transaksiForm.arisan_id} onChange={(e) => setTransaksiForm({ ...transaksiForm, arisan_id: e.target.value })}>
                <option value="">Pilih anggota</option>
                {arisan.map((row) => (
                  <option key={row.id} value={row.id}>{row.nama_anggota}</option>
                ))}
              </select>
              <select className="w-full border rounded-lg p-3 text-sm" value={transaksiForm.jenis} onChange={(e) => setTransaksiForm({ ...transaksiForm, jenis: e.target.value })}>
                <option>Setoran</option>
                <option>Pinjaman</option>
                <option>Angsuran</option>
              </select>
              <input required placeholder="Nominal (Rp)" className="w-full border rounded-lg p-3 text-sm" value={transaksiForm.nominal} onChange={(e) => setTransaksiForm({ ...transaksiForm, nominal: e.target.value })} />
              <input placeholder="Catatan" className="w-full border rounded-lg p-3 text-sm" value={transaksiForm.catatan} onChange={(e) => setTransaksiForm({ ...transaksiForm, catatan: e.target.value })} />
              <button disabled={loading} className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg">{loading ? "Menyimpan..." : "Catat transaksi"}</button>
              <div className="space-y-2 pt-2">
                {transaksi.slice(0, 8).map((row) => (
                  <div key={row.id} className="text-xs text-slate-600 border rounded-lg p-3 flex justify-between gap-3">
                    <span>{row.jenis} · Rp {Number(row.nominal || 0).toLocaleString("id-ID")}</span>
                    <button type="button" onClick={() => hapus("arisan_transaksi", row.id)} className="text-rose-600 font-bold">Hapus</button>
                  </div>
                ))}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
