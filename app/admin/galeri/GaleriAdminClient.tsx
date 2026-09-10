"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PesanDialog, { type PesanDialogData } from "@/components/PesanDialog";
import { KATEGORI_GALERI } from "@/lib/batas-berkas-unggah";
import { kompresGambarKeDataUrl } from "@/lib/kompresi-gambar-klien";

type FotoGaleri = {
  id: string;
  judul: string;
  deskripsi: string | null;
  url_foto: string;
  kategori: string | null;
  tanggal_kegiatan: string | null;
  dipublikasikan: boolean;
  urutan: number;
};

type HasilAksi = { success: boolean; message?: string };

export default function GaleriAdminClient({
  daftarFoto,
  kuota,
  aksiSimpan,
  aksiUbah,
  aksiHapus,
}: {
  adminAktif: { id: string; nama: string; role: string; rt_id: string };
  daftarFoto: FotoGaleri[];
  kuota: number;
  aksiSimpan: (payload: unknown) => Promise<HasilAksi>;
  aksiUbah: (id: string, payload: unknown) => Promise<HasilAksi>;
  aksiHapus: (id: string) => Promise<HasilAksi>;
}) {
  const router = useRouter();
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [kategori, setKategori] = useState<string>(KATEGORI_GALERI[0]);
  const [tanggalKegiatan, setTanggalKegiatan] = useState("");
  const [urutan, setUrutan] = useState(0);
  const [dipublikasikan, setDipublikasikan] = useState(true);
  const [fileFoto, setFileFoto] = useState<File | null>(null);
  const [modeEditId, setModeEditId] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [loadingHapusId, setLoadingHapusId] = useState<string | null>(null);
  const [pesan, setPesan] = useState<PesanDialogData | null>(null);

  const kuotaHabis = daftarFoto.length >= kuota && !modeEditId;

  const resetForm = () => {
    setModeEditId(null);
    setJudul("");
    setDeskripsi("");
    setKategori(KATEGORI_GALERI[0]);
    setTanggalKegiatan("");
    setUrutan(0);
    setDipublikasikan(true);
    setFileFoto(null);
  };

  const handleKlikEdit = (foto: FotoGaleri) => {
    setModeEditId(foto.id);
    setJudul(foto.judul);
    setDeskripsi(foto.deskripsi || "");
    setKategori(foto.kategori && KATEGORI_GALERI.includes(foto.kategori as (typeof KATEGORI_GALERI)[number]) ? foto.kategori : "Lainnya");
    setTanggalKegiatan(foto.tanggal_kegiatan || "");
    setUrutan(Number(foto.urutan) || 0);
    setDipublikasikan(foto.dipublikasikan !== false);
    setFileFoto(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modeEditId && !fileFoto) {
      setPesan({ tipe: "gagal", judul: "Foto belum dipilih", teks: "Pilih satu foto kegiatan sebelum mengunggah." });
      return;
    }
    setSubmitLoading(true);
    try {
      const fotoDataUrl = fileFoto ? await kompresGambarKeDataUrl(fileFoto, "fotoPublik") : "";
      const payload = {
        judul,
        deskripsi,
        kategori,
        tanggalKegiatan,
        urutan,
        dipublikasikan,
        fotoDataUrl,
      };
      const hasil = modeEditId ? await aksiUbah(modeEditId, payload) : await aksiSimpan(payload);
      if (!hasil?.success) {
        setPesan({ tipe: "gagal", judul: "Galeri belum tersimpan", teks: hasil?.message || "Unggah gagal diproses." });
        return;
      }
      setPesan({ tipe: "sukses", judul: "Galeri diperbarui", teks: hasil.message || "Foto berhasil disimpan." });
      resetForm();
      router.refresh();
    } catch (error: unknown) {
      setPesan({
        tipe: "gagal",
        judul: "Galeri belum tersimpan",
        teks: error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui.",
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleHapus = async (foto: FotoGaleri) => {
    if (!confirm(`Hapus permanen foto "${foto.judul}" dari galeri warga?`)) return;
    setLoadingHapusId(foto.id);
    try {
      const hasil = await aksiHapus(foto.id);
      if (!hasil?.success) {
        setPesan({ tipe: "gagal", judul: "Foto belum terhapus", teks: hasil?.message || "Penghapusan gagal." });
        return;
      }
      if (modeEditId === foto.id) resetForm();
      router.refresh();
    } catch (error: unknown) {
      setPesan({
        tipe: "gagal",
        judul: "Foto belum terhapus",
        teks: error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui.",
      });
    } finally {
      setLoadingHapusId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <PesanDialog pesan={pesan} onClose={() => setPesan(null)} />
      <div className="max-w-6xl mx-auto space-y-6">
        <Link href="/admin" className="text-blue-600 font-bold text-sm hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-sm border border-slate-800">
          <h1 className="text-2xl md:text-3xl font-black text-white mb-2">Galeri Kegiatan</h1>
          <p className="text-slate-400 text-sm font-medium">
            Unggah foto kerja bakti, posyandu, atau hajatan. Foto dikompres otomatis ke JPEG ±160 KB agar kuota Storage tidak cepat penuh.
          </p>
          <p className="text-[11px] text-slate-500 mt-3 font-semibold uppercase tracking-widest">
            Kuota {daftarFoto.length} / {kuota} foto
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 h-fit ${modeEditId ? "ring-2 ring-amber-400" : ""}`}>
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h2 className="font-black text-lg text-slate-800">{modeEditId ? "Edit foto" : "Unggah foto"}</h2>
              {modeEditId ? (
                <button type="button" onClick={resetForm} className="text-[10px] bg-rose-50 text-rose-600 font-bold px-3 py-1.5 rounded uppercase tracking-widest">
                  Batal
                </button>
              ) : null}
            </div>

            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Judul</label>
                <input required value={judul} onChange={(e) => setJudul(e.target.value)} className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 text-sm bg-slate-50 focus:bg-white outline-none focus:border-blue-500" placeholder="Cth: Kerja bakti saluran" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Kategori</label>
                <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 text-sm bg-slate-50 focus:bg-white outline-none focus:border-blue-500">
                  {KATEGORI_GALERI.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Tanggal kegiatan</label>
                <input type="date" value={tanggalKegiatan} onChange={(e) => setTanggalKegiatan(e.target.value)} className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 text-sm bg-slate-50 focus:bg-white outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Deskripsi (opsional)</label>
                <textarea rows={3} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 text-sm bg-slate-50 focus:bg-white outline-none focus:border-blue-500" placeholder="Keterangan singkat untuk warga" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Urutan tampil</label>
                <input type="number" min={0} max={999} value={urutan} onChange={(e) => setUrutan(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 text-sm bg-slate-50 focus:bg-white outline-none focus:border-blue-500" />
                <p className="text-[10px] text-slate-400 mt-1">Angka kecil tampil lebih dulu di halaman publik.</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                <input type="checkbox" checked={dipublikasikan} onChange={(e) => setDipublikasikan(e.target.checked)} />
                Tampilkan di portal publik
              </label>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">
                  {modeEditId ? "Ganti foto (opsional)" : "Foto"}
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required={!modeEditId}
                  disabled={kuotaHabis}
                  onChange={(e) => setFileFoto(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-700 disabled:opacity-50"
                />
                <p className="text-[10px] text-slate-400 mt-1">JPEG/PNG/WebP. Dikompres di HP sebelum dikirim. Maksimal 8 MB asli.</p>
              </div>
              <button
                type="submit"
                disabled={submitLoading || kuotaHabis}
                className={`w-full h-12 text-white font-bold rounded-lg shadow-md active:scale-95 ${submitLoading || kuotaHabis ? "bg-slate-300" : modeEditId ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"}`}
              >
                {kuotaHabis ? "Kuota penuh" : submitLoading ? "Mengompres & mengunggah..." : modeEditId ? "Simpan perubahan" : "Unggah ke galeri"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-100 pb-4">Isi dinding galeri</h2>
            {daftarFoto.length === 0 ? (
              <div className="p-10 text-center text-slate-400 font-medium italic border border-dashed border-slate-300 rounded-xl bg-slate-50">
                Belum ada foto. Unggah yang pertama dari panel kiri.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {daftarFoto.map((foto) => (
                  <article key={foto.id} className={`overflow-hidden rounded-xl border ${modeEditId === foto.id ? "border-amber-400" : "border-slate-200"}`}>
                    <img src={foto.url_foto} alt={foto.judul} className="h-40 w-full object-cover bg-slate-900" />
                    <div className="p-4 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                        {foto.kategori || "Kegiatan"} {foto.dipublikasikan ? "· Terbit" : "· Disembunyikan"}
                      </p>
                      <h3 className="font-black text-slate-800 text-sm leading-tight">{foto.judul}</h3>
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => handleKlikEdit(foto)} className="flex-1 text-[10px] font-bold uppercase tracking-wider bg-white border border-slate-200 text-amber-700 py-2 rounded">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleHapus(foto)} disabled={loadingHapusId === foto.id} className="flex-1 text-[10px] font-bold uppercase tracking-wider bg-white border border-slate-200 text-rose-600 py-2 rounded disabled:opacity-50">
                          {loadingHapusId === foto.id ? "..." : "Hapus"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
