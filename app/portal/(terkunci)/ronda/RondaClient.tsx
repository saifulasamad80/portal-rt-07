"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PesanDialog, { type PesanDialogData } from "@/components/PesanDialog";

type JadwalRonda = {
  id: string;
  tanggal_tugas: string;
  status?: string | null;
  alasan_izin?: string | null;
};

const BADGE_STATUS: Record<string, string> = {
  "Siap Hadir": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Izin Berhalangan": "bg-rose-100 text-rose-700 border-rose-200",
  "Menunggu Konfirmasi": "bg-amber-100 text-amber-700 border-amber-200",
};

export default function RondaClient({ jadwal, konfirmasiKehadiran }: { jadwal: JadwalRonda[]; konfirmasiKehadiran: (id: string, aksi: string, alasan: string) => Promise<unknown> }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState("");
  const [pesan, setPesan] = useState<PesanDialogData | null>(null);

  const handleKonfirmasi = async (idJadwal: string, aksi: string) => {
    let alasan = "";
    if (aksi === "Izin Berhalangan") {
      alasan = prompt("Tuliskan alasan Anda berhalangan hadir (Sakit/Dinas/dll):") || "";
      if (!alasan) return;
    } else {
      if (!confirm("Yakin ingin konfirmasi SIAP HADIR?")) return;
    }

    setLoadingId(idJadwal);
    try {
      await konfirmasiKehadiran(idJadwal, aksi, alasan);
      setPesan({
        tipe: "sukses",
        judul: "Konfirmasi berhasil dikirim",
        teks: "Pengurus Keamanan RT sudah menerima konfirmasi kehadiran Anda.",
      });
      router.refresh();
    } catch (error: unknown) {
      setPesan({
        tipe: "gagal",
        judul: "Konfirmasi belum tersimpan",
        teks: error instanceof Error ? error.message : "Kesalahan tidak diketahui.",
      });
    }
    setLoadingId("");
  };

  const jadwalMendatang = jadwal.filter((j) => !j.status || j.status === "Menunggu Konfirmasi").length;

  return (
    <div className="min-h-screen bg-[#eef2f6] p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/portal" className="text-blue-700 font-semibold text-sm hover:underline inline-block">
          &larr; Kembali ke Dasbor
        </Link>

        <div className="bg-slate-900 rounded-2xl p-6 md:p-8 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300 mb-2">Keamanan Lingkungan</p>
          <h1 className="text-2xl font-bold text-white">Jadwal Siskamling RT 07</h1>
          <p className="text-slate-400 text-sm mt-2">Pastikan Anda mengonfirmasi kehadiran tepat waktu agar regu keamanan dapat mengatur giliran dengan baik.</p>
          {jadwalMendatang > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs font-semibold px-3 py-1.5 rounded-lg">
              ⏳ {jadwalMendatang} jadwal menunggu konfirmasi Anda
            </div>
          )}
        </div>

        <div className="space-y-3">
          {jadwal.length === 0 ? (
            <div className="bg-white border border-slate-200 p-10 rounded-2xl text-center shadow-sm">
              <div className="text-3xl mb-2">🔦</div>
              <p className="text-slate-500 font-medium">Belum ada jadwal tugas ronda untuk Anda.</p>
            </div>
          ) : (
            jadwal.map((j) => {
              const statusLabel = j.status || "Menunggu Konfirmasi";
              return (
                <div key={j.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex-1 text-center md:text-left">
                    <div className="text-[10px] font-bold text-blue-700 uppercase tracking-[0.16em] mb-1.5">Jadwal Tugas Malam</div>
                    <div className="text-lg font-bold text-slate-900 mb-2">
                      {new Date(j.tanggal_tugas).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </div>
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${BADGE_STATUS[statusLabel] || BADGE_STATUS["Menunggu Konfirmasi"]}`}>
                      {statusLabel}
                    </span>
                    {j.alasan_izin && <div className="mt-2 text-sm text-slate-500 italic">&ldquo;{j.alasan_izin}&rdquo;</div>}
                  </div>
                  {(!j.status || j.status === "Menunggu Konfirmasi") && (
                    <div className="flex w-full md:w-auto gap-2">
                      <button
                        onClick={() => handleKonfirmasi(j.id, "Siap Hadir")}
                        disabled={loadingId === j.id}
                        className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-3 px-6 rounded-xl shadow-sm disabled:opacity-50 transition-colors active:scale-95"
                      >
                        {loadingId === j.id ? "..." : "Siap Hadir"}
                      </button>
                      <button
                        onClick={() => handleKonfirmasi(j.id, "Izin Berhalangan")}
                        disabled={loadingId === j.id}
                        className="flex-1 md:flex-none bg-white hover:bg-rose-50 text-rose-600 text-sm font-bold py-3 px-6 rounded-xl border border-rose-200 disabled:opacity-50 transition-colors active:scale-95"
                      >
                        {loadingId === j.id ? "..." : "Ajukan Izin"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      <PesanDialog pesan={pesan} onClose={() => setPesan(null)} />
    </div>
  );
}
