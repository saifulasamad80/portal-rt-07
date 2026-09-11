"use client";
import { useState } from "react";
import TautanHalus from "@/components/TautanHalus";
import { useRouter } from "next/navigation";
import PesanDialog, { type PesanDialogData } from "@/components/PesanDialog";
import ThumbnailPdf from "@/components/ThumbnailPdf";
import { BATAS_BYTE_PDF } from "@/lib/batas-berkas-unggah";
import { berkasKeDataUrl, kompresGambarKeDataUrl } from "@/lib/kompresi-gambar-klien";
import { adalahUrlGambar, adalahUrlPdf, labelAksiLampiran } from "@/lib/lampiran-pengumuman";

type PengumumanBaris = {
  id: string;
  judul: string;
  deskripsi: string;
  link_dokumen: string | null;
  tanggal_publikasi: string;
};

type HasilAksi = { success: boolean; message?: string };

export default function PengumumanAdminClient({
  pengumumanList,
  aksiSimpan,
  aksiEdit,
  aksiHapus,
}: {
  adminAktif: { id: string; nama: string; role: string; rt_id: string };
  pengumumanList: PengumumanBaris[];
  aksiSimpan: (payload: unknown) => Promise<HasilAksi>;
  aksiEdit: (id: string, payload: unknown) => Promise<HasilAksi>;
  aksiHapus: (id: string) => Promise<HasilAksi>;
}) {
  const router = useRouter();
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [fileLampiran, setFileLampiran] = useState<File | null>(null);
  const [hapusLampiran, setHapusLampiran] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [modeEditId, setModeEditId] = useState<string | null>(null);
  const [lampiranLama, setLampiranLama] = useState<string | null>(null);
  const [loadingHapusId, setLoadingHapusId] = useState<string | null>(null);
  const [pesan, setPesan] = useState<PesanDialogData | null>(null);

  const handleKlikEdit = (p: PengumumanBaris) => {
    setModeEditId(p.id);
    setJudul(p.judul);
    setDeskripsi(p.deskripsi);
    setLampiranLama(p.link_dokumen || null);
    setFileLampiran(null);
    setHapusLampiran(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const batalkanEdit = () => {
    setModeEditId(null);
    setJudul("");
    setDeskripsi("");
    setLampiranLama(null);
    setFileLampiran(null);
    setHapusLampiran(false);
  };

  const shareKeWhatsApp = (teksJudul: string) => {
    const appUrl = window.location.origin;
    const pesanWa = `📢 *INFO PENTING RT 07* 📢\n\n*${teksJudul.toUpperCase()}*\n\nSilakan cek detail informasi lengkapnya di Mading Portal Warga sekarang:\n👉 ${appUrl}\n\n_Harap segera dibaca agar tidak tertinggal informasi!_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(pesanWa)}`, "_blank");
  };

  const siapkanLampiran = async (file: File) => {
    if (file.type === "application/pdf") {
      return { lampiranDataUrl: await berkasKeDataUrl(file, BATAS_BYTE_PDF) };
    }
    if (file.type.startsWith("image/")) {
      return { lampiranDataUrl: await kompresGambarKeDataUrl(file, "fotoPublik") };
    }
    throw new Error("Lampiran harus berupa foto (JPEG/PNG/WebP) atau PDF.");
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const lampiran = fileLampiran
        ? await siapkanLampiran(fileLampiran)
        : { lampiranDataUrl: "" };
      const payload = {
        judul,
        deskripsi,
        lampiranDataUrl: lampiran.lampiranDataUrl,
        hapusLampiran: hapusLampiran && !fileLampiran,
      };
      const hasil = modeEditId ? await aksiEdit(modeEditId, payload) : await aksiSimpan(payload);
      if (!hasil?.success) {
        setPesan({ tipe: "gagal", judul: "Pengumuman belum tersimpan", teks: hasil?.message || "Siaran gagal diproses." });
        return;
      }

      if (!modeEditId && confirm("Pengumuman sudah di portal. Sebarkan judulnya ke grup WhatsApp RT sekarang?")) {
        shareKeWhatsApp(judul);
      } else {
        setPesan({ tipe: "sukses", judul: "Pengumuman tersimpan", teks: hasil.message || "Siaran berhasil dipublikasikan." });
      }

      batalkanEdit();
      router.refresh();
    } catch (error: unknown) {
      setPesan({
        tipe: "gagal",
        judul: "Pengumuman belum tersimpan",
        teks: error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui.",
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleHapus = async (id: string, judulPengumuman: string) => {
    if (!confirm(`YAKIN INGIN MENGHAPUS PERMANEN pengumuman "${judulPengumuman}"? Siaran ini akan hilang dari halaman warga.`)) return;

    setLoadingHapusId(id);
    try {
      const hasil = await aksiHapus(id);
      if (!hasil?.success) {
        setPesan({ tipe: "gagal", judul: "Pengumuman belum terhapus", teks: hasil?.message || "Penghapusan gagal." });
        return;
      }
      if (modeEditId === id) batalkanEdit();
      router.refresh();
    } catch (error: unknown) {
      setPesan({
        tipe: "gagal",
        judul: "Pengumuman belum terhapus",
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

        <TautanHalus href="/admin" className="text-blue-600 font-bold text-sm hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </TautanHalus>

        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] mb-8 border border-slate-800">
          <h1 className="text-2xl md:text-3xl font-black text-white mb-2">Pusat Informasi RT 07</h1>
          <p className="text-slate-400 text-sm font-medium">Sebarkan, edit, atau tarik siaran edaran resmi dari portal warga.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 lg:col-span-1 h-fit transition-all duration-300 ${modeEditId ? "ring-2 ring-amber-400 shadow-amber-100/50" : ""}`}>

            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h2 className="font-black text-lg text-slate-800 flex items-center gap-2">
                {modeEditId ? "✏️ Edit Siaran" : "📢 Buat Siaran Baru"}
              </h2>
              {modeEditId && (
                <button type="button" onClick={batalkanEdit} className="text-[10px] bg-rose-50 text-rose-600 font-bold px-3 py-1.5 rounded hover:bg-rose-100 transition-colors uppercase tracking-widest">
                  Batal Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSimpan} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Judul Pengumuman</label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors bg-slate-50 focus:bg-white" placeholder="Cth: Undangan Kerja Bakti" value={judul} onChange={(e) => setJudul(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Isi Pesan / Deskripsi</label>
                <textarea required rows={5} className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors bg-slate-50 focus:bg-white" placeholder="Tuliskan detail waktu, tempat, atau instruksinya di sini..." value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Lampiran (opsional)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => {
                    setFileLampiran(e.target.files?.[0] || null);
                    setHapusLampiran(false);
                  }}
                  className="w-full text-xs text-slate-700"
                />
                <p className="text-[10px] text-slate-400 mt-2 font-medium">
                  Foto dikompres otomatis. PDF maksimal 1,5 MB. Tidak perlu Google Drive.
                </p>
                {modeEditId && lampiranLama && !fileLampiran && !hapusLampiran ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-600 font-medium truncate">Lampiran saat ini terpasang.</p>
                    <button type="button" onClick={() => setHapusLampiran(true)} className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mt-1">
                      Lepas lampiran
                    </button>
                  </div>
                ) : null}
                {hapusLampiran && !fileLampiran ? (
                  <p className="text-[11px] text-rose-600 font-semibold mt-2">Lampiran akan dilepas saat disimpan.</p>
                ) : null}
              </div>

              <button type="submit" disabled={submitLoading} className={`w-full h-12 flex items-center justify-center text-white font-bold rounded-lg shadow-md mt-6 transition-all active:scale-95 ${submitLoading ? "bg-slate-300 cursor-not-allowed shadow-none" : (modeEditId ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700")}`}>
                {submitLoading ? "Memproses..." : (modeEditId ? "Update Siaran" : "Sebarkan Sekarang")}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 lg:col-span-2">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">📋 Riwayat Siaran Anda</h2>
            <div className="space-y-5">
              {pengumumanList.length === 0 ? (
                <div className="p-10 text-center text-slate-400 font-medium italic border border-dashed border-slate-300 rounded-xl bg-slate-50">Belum ada pengumuman yang disebarkan.</div>
              ) : (
                pengumumanList.map((p) => (
                  <div key={p.id} className={`p-6 border rounded-xl transition-all shadow-sm flex flex-col md:flex-row gap-6 ${modeEditId === p.id ? "border-amber-400 bg-amber-50/30" : "border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-200 hover:shadow-md"}`}>

                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                        <h3 className="font-black text-slate-800 text-lg leading-tight">{p.judul}</h3>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full font-black uppercase tracking-widest shrink-0">
                          {new Date(p.tanggal_publikasi).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm whitespace-pre-wrap mb-5 leading-relaxed">{p.deskripsi}</p>

                      {p.link_dokumen && adalahUrlGambar(p.link_dokumen) ? (
                        <img src={p.link_dokumen} alt="" className="mb-4 max-h-40 rounded-lg border border-slate-200 object-cover" />
                      ) : null}
                      {p.link_dokumen && adalahUrlPdf(p.link_dokumen) ? (
                        <div className="mb-4 h-40 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                          <ThumbnailPdf url={p.link_dokumen} alt="" />
                        </div>
                      ) : null}

                      {p.link_dokumen && (
                        <a href={p.link_dokumen} target="_blank" rel="noopener noreferrer" className="text-xs bg-white border border-slate-200 text-blue-700 px-5 py-2.5 rounded-lg font-bold hover:bg-blue-50 transition-colors inline-flex items-center gap-2 shadow-sm w-fit active:scale-95">
                          <span>{labelAksiLampiran(p.link_dokumen)}</span>
                        </a>
                      )}
                    </div>

                    <div className="flex flex-row md:flex-col gap-2 shrink-0 md:border-l md:border-slate-200 md:pl-6 pt-4 md:pt-0 border-t border-slate-200 md:border-t-0 justify-end md:justify-start">

                      <button
                        onClick={() => shareKeWhatsApp(p.judul)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-4 py-2.5 rounded shadow-sm transition-colors uppercase tracking-wider flex-1 md:flex-none text-center active:scale-95"
                      >
                        📲 Share WA
                      </button>

                      <button
                        onClick={() => handleKlikEdit(p)}
                        disabled={loadingHapusId === p.id}
                        className="bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-amber-600 text-[10px] font-bold px-4 py-2.5 rounded shadow-sm transition-colors uppercase tracking-wider disabled:opacity-50 flex-1 md:flex-none text-center"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleHapus(p.id, p.judul)}
                        disabled={loadingHapusId === p.id}
                        className="bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-rose-600 text-[10px] font-bold px-4 py-2.5 rounded shadow-sm transition-colors uppercase tracking-wider disabled:opacity-50 flex-1 md:flex-none text-center"
                      >
                        {loadingHapusId === p.id ? "⌛" : "🗑️ Hapus"}
                      </button>
                    </div>

                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
