"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ModulJumantik from "../ModulJumantik";

type TabId = "balita" | "lansia" | "arisan";
type PesanForm = { tipe: "sukses" | "gagal"; teks: string } | null;

type BarisKunjunganBalita = {
  id: string;
  created_at: string;
  nama_anak: string;
  nama_ibu: string;
  tanggal_kunjungan: string;
  berat_kg: number | null;
  tinggi_cm: number | null;
  imunisasi: string | null;
  catatan: string | null;
};

type BarisKunjunganLansia = {
  id: string;
  created_at: string;
  nama_peserta: string;
  tanggal_kunjungan: string;
  tensi_darah: string | null;
  gula_darah: number | null;
  berat_kg: number | null;
  catatan: string | null;
};

const FORM_BALITA_KOSONG = {
  nama_anak: "",
  nama_ibu: "",
  tanggal_kunjungan: "",
  berat_kg: "",
  tinggi_cm: "",
  imunisasi: "",
  catatan: "",
};

const FORM_LANSIA_KOSONG = {
  nama_peserta: "",
  tanggal_kunjungan: "",
  tensi_darah: "",
  gula_darah: "",
  berat_kg: "",
  catatan: "",
};

function tanggalHariIni() {
  const sekarang = new Date();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getDate()).padStart(2, "0");
  return `${sekarang.getFullYear()}-${bulan}-${hari}`;
}

function angkaOpsional(nilai: string) {
  const bersih = nilai.trim().replace(",", ".");
  if (!bersih) return null;
  const angka = Number(bersih);
  return Number.isFinite(angka) ? angka : null;
}

function teksOpsional(nilai: string) {
  const bersih = nilai.trim();
  return bersih ? bersih : null;
}

function formatTanggal(tanggal: string) {
  try {
    return new Date(tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return tanggal;
  }
}

const kelasIsian =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300";

export default function IbuIbuAdminClient({
  kunjunganLansia,
  kunjunganBalita,
  arisan,
  transaksi,
  aksiSimpanArisan,
  aksiSimpanTransaksi,
  aksiHapus,
      aksiSimpanKunjunganBalita,
      aksiSimpanKunjunganLansia,
      bolehKelolaKunjungan,
      laporanJumantik,
      aksiCatatJumantik,
    }: {
      kunjunganLansia: BarisKunjunganLansia[];
      kunjunganBalita: BarisKunjunganBalita[];
      arisan: any[];
      transaksi: any[];
      aksiSimpanArisan: (payload: any) => Promise<{ success: boolean; message?: string }>;
      aksiSimpanTransaksi: (payload: any) => Promise<{ success: boolean; message?: string }>;
      aksiHapus: (tabel: string, id: string) => Promise<{ success: boolean; message?: string }>;
      aksiSimpanKunjunganBalita: (payload: unknown) => Promise<{ success: boolean; message?: string; data?: BarisKunjunganBalita }>;
      aksiSimpanKunjunganLansia: (payload: unknown) => Promise<{ success: boolean; message?: string; data?: BarisKunjunganLansia }>;
      bolehKelolaKunjungan: boolean;
      laporanJumantik: {
        jumlah_rumah_diperiksa: number | null;
        warga_terjangkit_dbd: boolean | null;
        ditemukan_jentik: boolean | null;
      } | null;
      aksiCatatJumantik: (payload: {
        jumlah_rumah_diperiksa: number;
        warga_terjangkit_dbd: boolean;
        ditemukan_jentik: boolean;
      }) => Promise<{ success: boolean; message?: string }>;
    }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("balita");
  const [loading, setLoading] = useState(false);
  const [arisanForm, setArisanForm] = useState({ nama_anggota: "", no_whatsapp: "", status_keanggotaan: "Aktif", setoran_terakhir: "0", pinjaman_berjalan: "0", catatan: "" });
  const [transaksiForm, setTransaksiForm] = useState({ arisan_id: "", jenis: "Setoran", nominal: "", catatan: "" });

  const [formBalita, setFormBalita] = useState(FORM_BALITA_KOSONG);
  const [formLansia, setFormLansia] = useState(FORM_LANSIA_KOSONG);
  const [daftarBalita, setDaftarBalita] = useState<BarisKunjunganBalita[]>(kunjunganBalita);
  const [daftarLansia, setDaftarLansia] = useState<BarisKunjunganLansia[]>(kunjunganLansia);
  const [menyimpanBalita, setMenyimpanBalita] = useState(false);
  const [menyimpanLansia, setMenyimpanLansia] = useState(false);
  const [pesanBalita, setPesanBalita] = useState<PesanForm>(null);
  const [pesanLansia, setPesanLansia] = useState<PesanForm>(null);

  useEffect(() => {
    const hariIni = tanggalHariIni();
    setFormBalita((sebelum) => (sebelum.tanggal_kunjungan ? sebelum : { ...sebelum, tanggal_kunjungan: hariIni }));
    setFormLansia((sebelum) => (sebelum.tanggal_kunjungan ? sebelum : { ...sebelum, tanggal_kunjungan: hariIni }));
  }, []);

  const simpanArisan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await aksiSimpanArisan(arisanForm);
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

  const simpanKunjunganBalita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bolehKelolaKunjungan) {
      setPesanBalita({ tipe: "gagal", teks: "Rekam medis kunjungan legacy hanya dapat dikelola webmaster sampai pemetaan RT tersedia." });
      return;
    }
    setMenyimpanBalita(true);
    setPesanBalita(null);

    const hasil = await aksiSimpanKunjunganBalita({
      nama_anak: formBalita.nama_anak.trim(),
      nama_ibu: formBalita.nama_ibu.trim(),
      tanggal_kunjungan: formBalita.tanggal_kunjungan,
      berat_kg: angkaOpsional(formBalita.berat_kg),
      tinggi_cm: angkaOpsional(formBalita.tinggi_cm),
      imunisasi: teksOpsional(formBalita.imunisasi),
      catatan: teksOpsional(formBalita.catatan),
    });

    setMenyimpanBalita(false);

    if (!hasil.success || !hasil.data) {
      setPesanBalita({
        tipe: "gagal",
        teks: hasil.message || "Kunjungan balita gagal disimpan. Periksa koneksi, lalu tekan Simpan lagi.",
      });
      return;
    }

    const data = hasil.data;
    setDaftarBalita((sebelum) => [data, ...sebelum]);
    setFormBalita({ ...FORM_BALITA_KOSONG, tanggal_kunjungan: tanggalHariIni() });
    setPesanBalita({
      tipe: "sukses",
      teks: `Kunjungan ${data.nama_anak} berhasil dicatat ke rekam medis.`,
    });
  };

  const simpanKunjunganLansia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bolehKelolaKunjungan) {
      setPesanLansia({ tipe: "gagal", teks: "Rekam medis kunjungan legacy hanya dapat dikelola webmaster sampai pemetaan RT tersedia." });
      return;
    }
    setMenyimpanLansia(true);
    setPesanLansia(null);

    const hasil = await aksiSimpanKunjunganLansia({
      nama_peserta: formLansia.nama_peserta.trim(),
      tanggal_kunjungan: formLansia.tanggal_kunjungan,
      tensi_darah: teksOpsional(formLansia.tensi_darah),
      gula_darah: angkaOpsional(formLansia.gula_darah),
      berat_kg: angkaOpsional(formLansia.berat_kg),
      catatan: teksOpsional(formLansia.catatan),
    });

    setMenyimpanLansia(false);

    if (!hasil.success || !hasil.data) {
      setPesanLansia({
        tipe: "gagal",
        teks: hasil.message || "Kunjungan lansia gagal disimpan. Periksa koneksi, lalu tekan Simpan lagi.",
      });
      return;
    }

    const data = hasil.data;
    setDaftarLansia((sebelum) => [data, ...sebelum]);
    setFormLansia({ ...FORM_LANSIA_KOSONG, tanggal_kunjungan: tanggalHariIni() });
    setPesanLansia({
      tipe: "sukses",
      teks: `Kunjungan ${data.nama_peserta} berhasil dicatat ke rekam medis.`,
    });
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
          <p className="text-slate-400 text-sm mt-1">Rekam medis kunjungan per individu, Jumantik, dan simpan-pinjam arisan.</p>
        </div>
        {!bolehKelolaKunjungan && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Data kunjungan balita/lansia legacy belum memiliki pemetaan RT. Akses rekam medis ditahan untuk admin RT agar data warga lain tidak terbaca; webmaster dapat mengelolanya setelah migrasi.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kunjungan Lansia</div>
            <div className="text-lg font-black text-violet-600">{daftarLansia.length}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kunjungan Balita</div>
            <div className="text-lg font-black text-sky-600">{daftarBalita.length}</div>
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

        <div className="min-w-0">
          <ModulJumantik laporanTerbaru={laporanJumantik} aksiCatat={aksiCatatJumantik} />
        </div>

        <div className="flex flex-wrap gap-2">
          {(["balita", "lansia", "arisan"] as TabId[]).map((id) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`px-4 py-2 rounded-full text-xs font-black uppercase ${tab === id ? "bg-rose-600 text-white" : "bg-white border text-slate-600"}`}>
              {id === "balita" ? "Catat Kunjungan Balita" : id === "lansia" ? "Catat Kunjungan Lansia" : "Arisan"}
            </button>
          ))}
        </div>

        {tab === "balita" && (
          <div className="grid lg:grid-cols-5 gap-6 items-start">
            <form className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 space-y-3" onSubmit={simpanKunjunganBalita}>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-base shrink-0">👶</div>
                <div>
                  <h2 className="font-black text-slate-900">Catat Kunjungan Balita</h2>
                  <p className="text-[11px] text-slate-400">Rekam medis per anak</p>
                </div>
              </div>
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Nama anak</span>
                <input required placeholder="Nama lengkap anak" className={kelasIsian} value={formBalita.nama_anak} onChange={(e) => setFormBalita({ ...formBalita, nama_anak: e.target.value })} />
              </label>
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Nama ibu</span>
                <input required placeholder="Nama ibu" className={kelasIsian} value={formBalita.nama_ibu} onChange={(e) => setFormBalita({ ...formBalita, nama_ibu: e.target.value })} />
              </label>
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Tanggal kunjungan</span>
                <input required type="date" className={kelasIsian} value={formBalita.tanggal_kunjungan} onChange={(e) => setFormBalita({ ...formBalita, tanggal_kunjungan: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Berat (kg)</span>
                  <input type="number" min={0} step="0.1" inputMode="decimal" placeholder="Opsional" className={kelasIsian} value={formBalita.berat_kg} onChange={(e) => setFormBalita({ ...formBalita, berat_kg: e.target.value })} />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Tinggi (cm)</span>
                  <input type="number" min={0} step="0.1" inputMode="decimal" placeholder="Opsional" className={kelasIsian} value={formBalita.tinggi_cm} onChange={(e) => setFormBalita({ ...formBalita, tinggi_cm: e.target.value })} />
                </label>
              </div>
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Imunisasi</span>
                <input placeholder="Contoh: DPT, Campak" className={kelasIsian} value={formBalita.imunisasi} onChange={(e) => setFormBalita({ ...formBalita, imunisasi: e.target.value })} />
              </label>
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Catatan</span>
                <textarea placeholder="Catatan pemeriksaan" className={kelasIsian} value={formBalita.catatan} onChange={(e) => setFormBalita({ ...formBalita, catatan: e.target.value })} />
              </label>
              {pesanBalita && (
                <p className={`text-[12px] font-semibold leading-relaxed rounded-xl px-3 py-2 ${pesanBalita.tipe === "sukses" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {pesanBalita.teks}
                </p>
              )}
              <button type="submit" disabled={menyimpanBalita || !bolehKelolaKunjungan} className="w-full bg-sky-700 hover:bg-sky-800 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                {menyimpanBalita ? "Menyimpan..." : "Simpan"}
              </button>
            </form>
            <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200 space-y-3">
              <h2 className="font-black text-slate-900">Riwayat kunjungan balita</h2>
              {daftarBalita.map((row) => (
                <div key={row.id} className="border border-slate-200 rounded-xl p-4">
                  <p className="font-bold">{row.nama_anak}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ibu {row.nama_ibu} · {formatTanggal(row.tanggal_kunjungan)}
                    {row.berat_kg != null ? ` · ${row.berat_kg} kg` : ""}
                    {row.tinggi_cm != null ? ` · ${row.tinggi_cm} cm` : ""}
                    {row.imunisasi ? ` · ${row.imunisasi}` : ""}
                  </p>
                  {row.catatan && <p className="text-xs text-slate-400 mt-1">{row.catatan}</p>}
                </div>
              ))}
              {daftarBalita.length === 0 && <p className="text-sm text-slate-400">Belum ada kunjungan tercatat.</p>}
            </div>
          </div>
        )}

        {tab === "lansia" && (
          <div className="grid lg:grid-cols-5 gap-6 items-start">
            <form className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 space-y-3" onSubmit={simpanKunjunganLansia}>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-base shrink-0">🧓</div>
                <div>
                  <h2 className="font-black text-slate-900">Catat Kunjungan Lansia</h2>
                  <p className="text-[11px] text-slate-400">Rekam medis per peserta</p>
                </div>
              </div>
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Nama peserta</span>
                <input required placeholder="Nama lengkap peserta" className={kelasIsian} value={formLansia.nama_peserta} onChange={(e) => setFormLansia({ ...formLansia, nama_peserta: e.target.value })} />
              </label>
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Tanggal kunjungan</span>
                <input required type="date" className={kelasIsian} value={formLansia.tanggal_kunjungan} onChange={(e) => setFormLansia({ ...formLansia, tanggal_kunjungan: e.target.value })} />
              </label>
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Tensi darah</span>
                <input placeholder="120/80" className={kelasIsian} value={formLansia.tensi_darah} onChange={(e) => setFormLansia({ ...formLansia, tensi_darah: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Gula darah</span>
                  <input type="number" min={0} step="0.1" inputMode="decimal" placeholder="Opsional" className={kelasIsian} value={formLansia.gula_darah} onChange={(e) => setFormLansia({ ...formLansia, gula_darah: e.target.value })} />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Berat (kg)</span>
                  <input type="number" min={0} step="0.1" inputMode="decimal" placeholder="Opsional" className={kelasIsian} value={formLansia.berat_kg} onChange={(e) => setFormLansia({ ...formLansia, berat_kg: e.target.value })} />
                </label>
              </div>
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Catatan</span>
                <textarea placeholder="Catatan pemeriksaan" className={kelasIsian} value={formLansia.catatan} onChange={(e) => setFormLansia({ ...formLansia, catatan: e.target.value })} />
              </label>
              {pesanLansia && (
                <p className={`text-[12px] font-semibold leading-relaxed rounded-xl px-3 py-2 ${pesanLansia.tipe === "sukses" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {pesanLansia.teks}
                </p>
              )}
              <button type="submit" disabled={menyimpanLansia || !bolehKelolaKunjungan} className="w-full bg-violet-700 hover:bg-violet-800 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                {menyimpanLansia ? "Menyimpan..." : "Simpan"}
              </button>
            </form>
            <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200 space-y-3">
              <h2 className="font-black text-slate-900">Riwayat kunjungan lansia</h2>
              {daftarLansia.map((row) => (
                <div key={row.id} className="border border-slate-200 rounded-xl p-4">
                  <p className="font-bold">{row.nama_peserta}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatTanggal(row.tanggal_kunjungan)}
                    {row.tensi_darah ? ` · TD ${row.tensi_darah}` : ""}
                    {row.gula_darah != null ? ` · Gula ${row.gula_darah}` : ""}
                    {row.berat_kg != null ? ` · ${row.berat_kg} kg` : ""}
                  </p>
                  {row.catatan && <p className="text-xs text-slate-400 mt-1">{row.catatan}</p>}
                </div>
              ))}
              {daftarLansia.length === 0 && <p className="text-sm text-slate-400">Belum ada kunjungan tercatat.</p>}
            </div>
          </div>
        )}

        {tab === "arisan" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <form className="bg-white p-6 rounded-2xl border border-slate-200 space-y-3" onSubmit={simpanArisan}>
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
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 space-y-3">
              {arisan.map((row) => (
                <div key={row.id} className="border border-slate-200 rounded-xl p-4 flex justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{row.nama_anggota}</p>
                    <p className="text-xs text-slate-500">{row.status_keanggotaan} · Setor Rp {Number(row.setoran_terakhir || 0).toLocaleString("id-ID")} · Pinjam Rp {Number(row.pinjaman_berjalan || 0).toLocaleString("id-ID")}</p>
                  </div>
                  <button onClick={() => hapus("arisan_ibu", row.id)} className="text-xs text-rose-600 font-bold shrink-0">Hapus</button>
                </div>
              ))}
              {arisan.length === 0 && <p className="text-sm text-slate-400">Belum ada data.</p>}
            </div>
            <form className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200 space-y-3" onSubmit={simpanTransaksi}>
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
                  <div key={row.id} className="text-xs text-slate-600 border border-slate-200 rounded-lg p-3 flex justify-between gap-3">
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
