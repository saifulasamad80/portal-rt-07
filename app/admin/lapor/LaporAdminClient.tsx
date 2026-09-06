"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  adalahTiketPerubahanKeluarga,
  tiketKeluargaMasihTerbuka,
} from "@/lib/kebijakan-sensus";

type HasilAksiLapor = { success: boolean; message?: string };

type TiketLaporan = {
  id: string;
  judul_laporan: string | null;
  deskripsi: string | null;
  status: string | null;
  tanggapan_rt: string | null;
  created_at: string | null;
  warga: { nama_lengkap: string | null } | null;
};

export default function LaporAdminClient({
  laporanList,
  aksiTanggapi,
  aksiIzinkanRevisi,
  aksiTolakRevisi,
}: {
  laporanList: TiketLaporan[];
  aksiTanggapi: (laporanId: string, statusBaru: string, tanggapanTeks: string) => Promise<HasilAksiLapor>;
  aksiIzinkanRevisi: (laporanId: string) => Promise<HasilAksiLapor>;
  aksiTolakRevisi: (laporanId: string, alasan: string) => Promise<HasilAksiLapor>;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState("");
  const [pesan, setPesan] = useState<{ tipe: "sukses" | "gagal"; teks: string } | null>(null);
  const [laporanAktif, setLaporanAktif] = useState<TiketLaporan | null>(null);
  const [tanggapan, setTanggapan] = useState("");
  const [status, setStatus] = useState("");
  const [alasanTolak, setAlasanTolak] = useState("");

  const bukaPanelTanggapan = (laporan: TiketLaporan) => {
    setLaporanAktif(laporan);
    setTanggapan(laporan.tanggapan_rt || "");
    setStatus(laporan.status || "Menunggu");
    setAlasanTolak("");
    setPesan(null);
  };

  const tutupPanel = () => {
    setLaporanAktif(null);
    setTanggapan("");
    setStatus("");
    setAlasanTolak("");
  };

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!laporanAktif) return;
    setLoadingId(laporanAktif.id);
    setPesan(null);
    try {
      const hasil = await aksiTanggapi(laporanAktif.id, status, tanggapan);
      if (!hasil.success) {
        setPesan({ tipe: "gagal", teks: hasil.message || "Tanggapan gagal disimpan." });
      } else {
        tutupPanel();
        router.refresh();
      }
    } catch {
      setPesan({ tipe: "gagal", teks: "Tanggapan gagal disimpan." });
    }
    setLoadingId("");
  };

  const handleIzinkanRevisi = async () => {
    if (!laporanAktif) return;
    if (!window.confirm("Buka kunci data keluarga agar warga dapat mengoreksi form Carik? NIK tetap terkunci.")) {
      return;
    }
    setLoadingId(laporanAktif.id);
    setPesan(null);
    try {
      const hasil = await aksiIzinkanRevisi(laporanAktif.id);
      if (!hasil.success) {
        setPesan({ tipe: "gagal", teks: hasil.message || "Revisi belum dapat diizinkan." });
      } else {
        tutupPanel();
        router.refresh();
      }
    } catch {
      setPesan({ tipe: "gagal", teks: "Revisi belum dapat diizinkan." });
    }
    setLoadingId("");
  };

  const handleTolakRevisi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!laporanAktif) return;
    setLoadingId(laporanAktif.id);
    setPesan(null);
    try {
      const hasil = await aksiTolakRevisi(laporanAktif.id, alasanTolak);
      if (!hasil.success) {
        setPesan({ tipe: "gagal", teks: hasil.message || "Penolakan gagal disimpan." });
      } else {
        tutupPanel();
        router.refresh();
      }
    } catch {
      setPesan({ tipe: "gagal", teks: "Penolakan gagal disimpan." });
    }
    setLoadingId("");
  };

  const totalMenunggu = laporanList.filter((l) => l.status === "Menunggu" || !l.status).length;
  const totalDiproses = laporanList.filter((l) => l.status === "Diproses").length;
  const isUnchanged =
    laporanAktif && status === (laporanAktif.status || "Menunggu") && tanggapan === (laporanAktif.tanggapan_rt || "");
  const tiketKeluargaAktif = laporanAktif ? adalahTiketPerubahanKeluarga(laporanAktif.judul_laporan) : false;
  const tiketKeluargaTerbuka = tiketKeluargaAktif && tiketKeluargaMasihTerbuka(laporanAktif?.status);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link href="/admin" className="text-blue-600 font-bold text-sm hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-lg mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Tiket Laporan Warga</h1>
            <p className="text-slate-400 text-sm">Tindak lanjuti permohonan perubahan data keluarga.</p>
          </div>
          <div className="text-5xl hidden md:block grayscale brightness-200">📥</div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Menunggu Respons</h3>
              <div className="text-3xl font-black text-amber-500 mt-1">{totalMenunggu}</div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sedang Diproses</h3>
              <div className="text-3xl font-black text-blue-500 mt-1">{totalDiproses}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-2">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 h-fit">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">Kotak Masuk Laporan</h2>

            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
              {laporanList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold italic border-2 border-dashed border-slate-200 rounded-xl">
                  Belum ada permohonan perubahan data keluarga.
                </div>
              ) : (
                laporanList.map((l) => (
                  <div
                    key={l.id}
                    onClick={() => bukaPanelTanggapan(l)}
                    className={`p-5 border rounded-xl cursor-pointer transition-all shadow-sm ${
                      laporanAktif?.id === l.id
                        ? "border-blue-400 bg-blue-50 shadow-md"
                        : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div>
                        <h3 className="font-black text-slate-800 text-lg leading-tight">{l.judul_laporan}</h3>
                        {adalahTiketPerubahanKeluarga(l.judul_laporan) && (
                          <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Data keluarga
                          </span>
                        )}
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                          Pelapor: <span className="text-slate-600">{l.warga?.nama_lengkap}</span> •{" "}
                          {l.created_at
                            ? new Date(l.created_at).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </p>
                      </div>
                      <span
                        className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0 ${
                          !l.status || l.status === "Menunggu"
                            ? "bg-amber-100 text-amber-800"
                            : l.status === "Diproses"
                              ? "bg-blue-100 text-blue-800"
                              : l.status === "Selesai"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {l.status || "Menunggu"}
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed line-clamp-2">{l.deskripsi}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            {laporanAktif ? (
              <div className="bg-white p-6 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-200 sticky top-6">
                <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-3">
                  <h2 className="font-black text-lg text-slate-800">Tindak Lanjut</h2>
                  <button onClick={tutupPanel} className="text-slate-400 hover:text-rose-500 font-bold text-xl leading-none">
                    &times;
                  </button>
                </div>

                <div className="mb-5 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h3 className="font-black text-slate-800 text-sm mb-2">{laporanAktif.judul_laporan}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{laporanAktif.deskripsi}</p>
                </div>

                {pesan && (
                  <p
                    className={`mb-4 text-sm font-medium rounded-xl border px-4 py-3 ${
                      pesan.tipe === "gagal"
                        ? "bg-rose-50 border-rose-200 text-rose-800"
                        : "bg-emerald-50 border-emerald-200 text-emerald-800"
                    }`}
                  >
                    {pesan.teks}
                  </p>
                )}

                {tiketKeluargaTerbuka ? (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Izinkan Revisi membuka form Carik untuk warga ini. NIK tetap terkunci. Tolak menutup
                      tiket tanpa mengubah data KK.
                    </p>
                    <button
                      type="button"
                      disabled={loadingId === laporanAktif.id}
                      onClick={handleIzinkanRevisi}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold rounded-lg p-3.5 transition-all"
                    >
                      {loadingId === laporanAktif.id ? "Memproses..." : "Izinkan Revisi"}
                    </button>
                    <form onSubmit={handleTolakRevisi} className="space-y-3 pt-2 border-t border-slate-100">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Alasan penolakan
                      </label>
                      <textarea
                        required
                        minLength={10}
                        maxLength={1000}
                        rows={4}
                        className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-blue-500 text-sm text-slate-800"
                        placeholder="Jelaskan mengapa permohonan ditolak..."
                        value={alasanTolak}
                        onChange={(e) => setAlasanTolak(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={loadingId === laporanAktif.id}
                        className="w-full border border-slate-300 text-slate-700 font-bold rounded-lg p-3 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Tolak permohonan
                      </button>
                    </form>
                  </div>
                ) : tiketKeluargaAktif ? (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Tiket ini sudah ditutup. Cap Carik tidak diubah dari panel ini.
                    {laporanAktif.tanggapan_rt ? ` Tanggapan: ${laporanAktif.tanggapan_rt}` : ""}
                  </p>
                ) : (
                  <form onSubmit={handleSimpan} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                        Update Status
                      </label>
                      <select
                        className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-blue-500 text-sm font-bold text-slate-700 bg-white"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <option value="Menunggu">Menunggu Respons</option>
                        <option value="Diproses">Sedang Diproses</option>
                        <option value="Selesai">Telah Selesai</option>
                        <option value="Ditolak">Ditolak / Batal</option>
                      </select>
                    </div>
                    <div className="mb-4">
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                        Tanggapan Resmi Pengurus
                      </label>
                      <textarea
                        required
                        rows={5}
                        className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-blue-500 text-sm text-slate-800"
                        placeholder="Ketik jawaban atau tindak lanjut dari laporan ini..."
                        value={tanggapan}
                        onChange={(e) => setTanggapan(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loadingId === laporanAktif.id || Boolean(isUnchanged)}
                      className={`w-full text-white font-bold rounded-lg p-3.5 mt-2 transition-all ${
                        loadingId === laporanAktif.id || isUnchanged
                          ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                          : "bg-blue-600 hover:bg-blue-700 shadow-md active:scale-95"
                      }`}
                    >
                      {loadingId === laporanAktif.id ? "Menyimpan..." : "Simpan Tanggapan"}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 p-8 rounded-2xl border border-dashed border-slate-300 text-center flex flex-col items-center justify-center h-full min-h-[300px]">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                  Klik salah satu tiket
                  <br />
                  untuk memberikan tanggapan
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
