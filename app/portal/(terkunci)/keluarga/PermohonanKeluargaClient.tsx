"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HasilCarik } from "@/lib/verifikasi-carik";
import PesanDialog, { type PesanDialogData } from "@/components/PesanDialog";

type TiketPermohonan = {
  id: string;
  status: string | null;
  deskripsi: string | null;
  tanggapan_rt: string | null;
  created_at: string | null;
};

function kelasStatus(status: string) {
  if (status === "Selesai") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "Diproses") return "bg-blue-50 text-blue-800 border-blue-200";
  if (status === "Ditolak") return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

export default function PermohonanKeluargaClient({
  riwayat,
  tiketTerbuka,
  aksiAjukan,
}: {
  riwayat: TiketPermohonan[];
  tiketTerbuka: boolean;
  aksiAjukan: (alasan: string) => Promise<HasilCarik>;
}) {
  const router = useRouter();
  const [alasan, setAlasan] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const [pesan, setPesan] = useState<PesanDialogData | null>(null);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (tiketTerbuka || mengirim) return;
    setMengirim(true);
    setPesan(null);
    try {
      const hasil = await aksiAjukan(alasan);
      if (hasil.success) {
        setAlasan("");
        setPesan({ tipe: "sukses", teks: hasil.message });
        router.refresh();
      } else {
        setPesan({ tipe: "gagal", teks: hasil.message });
      }
    } catch {
      setPesan({ tipe: "gagal", teks: "Permohonan belum dapat dikirim. Coba lagi nanti." });
    }
    setMengirim(false);
  }

  return (
    <section className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
        <h2 className="text-lg font-bold text-slate-900">Ajukan perubahan ke pengurus</h2>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          NIK tetap terkunci. Jelaskan data mana yang perlu dikoreksi. Pengurus akan meninjau dan
          mengubah catatan RT bila sesuai.
        </p>

        {tiketTerbuka ? (
          <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            Anda masih punya permohonan yang menunggu atau sedang diproses. Tunggu tanggapan pengurus
            sebelum mengajukan yang baru.
          </p>
        ) : (
          <form onSubmit={kirim} className="mt-4 space-y-3">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Uraian perubahan
            </label>
            <textarea
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Contoh: nama anak kedua terlanjur salah eja, atau istri perlu ditambahkan ke KK."
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="submit"
              disabled={mengirim}
              className="w-full md:w-auto rounded-lg bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider px-4 py-2.5 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500"
            >
              {mengirim ? "Mengirim..." : "Kirim permohonan"}
            </button>
          </form>
        )}

      </div>

      {riwayat.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Riwayat permohonan
          </h3>
          {riwayat.map((tiket) => {
            const status = tiket.status || "Menunggu";
            return (
              <article key={tiket.id} className={`rounded-xl border p-4 ${kelasStatus(status)}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{tiket.deskripsi}</p>
                  <span className="text-[10px] font-bold uppercase tracking-wider shrink-0">{status}</span>
                </div>
                {tiket.created_at && (
                  <p className="text-[11px] mt-1 opacity-80">
                    {new Date(tiket.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}
                {tiket.tanggapan_rt && (
                  <p className="text-sm mt-2 pt-2 border-t border-black/10">
                    Tanggapan pengurus: {tiket.tanggapan_rt}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <PesanDialog
        pesan={
          pesan
            ? {
                ...pesan,
                judul:
                  pesan.tipe === "gagal"
                    ? "Permohonan belum dapat dikirim"
                    : "Permohonan berhasil dikirim",
                deskripsi:
                  pesan.tipe === "gagal"
                    ? "Periksa keterangan di bawah sebelum mencoba mengirim kembali."
                    : "Pengurus RT akan meninjau permohonan perubahan data Anda.",
              }
            : null
        }
        onClose={() => setPesan(null)}
      />
    </section>
  );
}
