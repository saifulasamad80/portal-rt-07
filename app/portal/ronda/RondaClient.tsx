"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RondaClient({ jadwal, konfirmasiKehadiran, generateTest }: { jadwal: any[], konfirmasiKehadiran: any, generateTest: any }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState("");

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
      alert("Konfirmasi berhasil dikirim ke Pengurus Keamanan RT!");
      router.refresh(); // FAKTA: Tarik ulang data jadwal terbaru dari server secara mulus
    } catch (error: any) {
      alert("Gagal menyimpan konfirmasi: " + error.message);
    }
    setLoadingId("");
  };

  const handleGenerateTest = async () => {
    try {
      await generateTest();
      router.refresh();
    } catch (error: any) {
      alert("Gagal membuat jadwal test: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/portal" className="text-emerald-400 font-bold hover:underline mb-4 inline-block">&larr; Kembali ke Dasbor</Link>
        <div className="bg-slate-800 p-6 rounded-xl shadow-2xl border-l-8 border-emerald-500 text-white">
          <h1 className="text-2xl font-bold text-emerald-400 mb-1">Jadwal Siskamling RT 07</h1>
          <p className="text-slate-400 text-sm">Pastikan Anda mengonfirmasi kehadiran tepat waktu.</p>
        </div>
        <div className="space-y-4">
          {jadwal.length === 0 ? (
            <div className="bg-slate-800 p-8 rounded-xl text-center shadow-lg border border-slate-700">
              <p className="text-slate-400 font-bold mb-4">Belum ada jadwal tugas ronda untuk Anda.</p>
              <button onClick={handleGenerateTest} className="text-xs bg-slate-700 text-slate-300 px-4 py-2 rounded hover:bg-slate-600 transition-colors">
                [Testing] + Buatkan Saya 1 Jadwal Besok
              </button>
            </div>
          ) : (
            jadwal.map((j) => (
              <div key={j.id} className="bg-slate-800 p-5 rounded-xl shadow border border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex-1 text-center md:text-left">
                  <div className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-1">Jadwal Tugas Malam</div>
                  <div className="text-xl font-black text-white mb-2">{new Date(j.tanggal_tugas).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  <div className="inline-block bg-slate-700 px-3 py-1 rounded text-xs font-bold text-slate-300">
                    Status: <span className={j.status === 'Siap Hadir' ? 'text-emerald-400' : j.status === 'Izin Berhalangan' ? 'text-rose-400' : 'text-amber-400'}>{j.status || "Menunggu Konfirmasi"}</span>
                  </div>
                  {j.alasan_izin && <div className="mt-2 text-sm text-slate-400 italic">"Alasan: {j.alasan_izin}"</div>}
                </div>
                {(!j.status || j.status === 'Menunggu Konfirmasi') && (
                  <div className="flex w-full md:w-auto gap-2">
                    <button onClick={() => handleKonfirmasi(j.id, "Siap Hadir")} disabled={loadingId === j.id} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-lg shadow disabled:opacity-50">
                      {loadingId === j.id ? "..." : "Siap Hadir"}
                    </button>
                    <button onClick={() => handleKonfirmasi(j.id, "Izin Berhalangan")} disabled={loadingId === j.id} className="flex-1 md:flex-none bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-3 px-6 rounded-lg border border-slate-600 disabled:opacity-50">
                      {loadingId === j.id ? "..." : "Ajukan Izin"}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}