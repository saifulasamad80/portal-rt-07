"use client";

import { useState } from "react";
import {
  aksiAjukanHapusAkun,
  aksiTarikIzinPortal,
  aksiUnduhSalinanRumahTangga,
} from "@/app/portal/persetujuan-actions";

export default function HakSubjekPortal({
  bolehIsiIzin,
  izinKeuangan,
  izinKesehatan,
}: {
  bolehIsiIzin: boolean;
  izinKeuangan: boolean;
  izinKesehatan: boolean;
}) {
  const [pesan, setPesan] = useState<string | null>(null);
  const [loading, setLoading] = useState("");
  const [tarikKeuangan, setTarikKeuangan] = useState(false);
  const [tarikKesehatan, setTarikKesehatan] = useState(false);

  const unduh = async () => {
    setLoading("salinan");
    setPesan(null);
    try {
      const hasil = await aksiUnduhSalinanRumahTangga();
      if (!hasil.success || !hasil.berkas) {
        setPesan(hasil.message);
        return;
      }
      const blob = new Blob([hasil.berkas.isi], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const tautan = document.createElement("a");
      tautan.href = url;
      tautan.download = hasil.berkas.nama;
      tautan.click();
      URL.revokeObjectURL(url);
      setPesan(hasil.message);
    } catch {
      setPesan("Salinan belum dapat diunduh.");
    }
    setLoading("");
  };

  const tarik = async () => {
    setLoading("tarik");
    setPesan(null);
    try {
      const hasil = await aksiTarikIzinPortal({
        tarik_keuangan: tarikKeuangan,
        tarik_kesehatan: tarikKesehatan,
      });
      setPesan(hasil.message);
    } catch {
      setPesan("Penarikan izin belum dapat diproses.");
    }
    setLoading("");
  };

  const hapus = async () => {
    if (!confirm("Ajukan penghapusan akun dan data operasional rumah tangga ini ke pengurus?")) return;
    setLoading("hapus");
    setPesan(null);
    try {
      const hasil = await aksiAjukanHapusAkun();
      setPesan(hasil.message);
    } catch {
      setPesan("Permintaan hapus belum dapat dikirim.");
    }
    setLoading("");
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Hak Anda atas data</p>
      <p className="text-[13px] text-slate-600 leading-relaxed">
        Unduh salinan rumah tangga, tarik izin keuangan atau kesehatan, atau ajukan hapus akun. Buku induk identitas untuk surat dan iuran tetap diurus pengurus sampai permintaan hapus selesai.
      </p>
      {bolehIsiIzin ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={loading !== ""}
            onClick={unduh}
            className="rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-bold px-4 py-2 disabled:opacity-50"
          >
            {loading === "salinan" ? "Menyusun..." : "Unduh salinan data rumah tangga"}
          </button>
          {(izinKeuangan || izinKesehatan) ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
              {izinKeuangan ? (
                <label className="flex items-start gap-2 text-[13px] text-slate-700">
                  <input type="checkbox" className="mt-1" checked={tarikKeuangan} onChange={(e) => setTarikKeuangan(e.target.checked)} />
                  <span>Tarik izin keuangan (pendapatan dikosongkan sekarang)</span>
                </label>
              ) : null}
              {izinKesehatan ? (
                <label className="flex items-start gap-2 text-[13px] text-slate-700">
                  <input type="checkbox" className="mt-1" checked={tarikKesehatan} onChange={(e) => setTarikKesehatan(e.target.checked)} />
                  <span>Tarik izin kesehatan (catatan posyandu rumah tangga dianonimkan, kunjungan baru ditolak)</span>
                </label>
              ) : null}
              <button
                type="button"
                disabled={loading !== "" || (!tarikKeuangan && !tarikKesehatan)}
                onClick={tarik}
                className="rounded-lg bg-slate-800 text-white text-xs font-bold px-4 py-2 disabled:opacity-50"
              >
                {loading === "tarik" ? "Menyimpan..." : "Tarik izin yang dipilih"}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            disabled={loading !== ""}
            onClick={hapus}
            className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs font-bold px-4 py-2 disabled:opacity-50"
          >
            {loading === "hapus" ? "Mengirim..." : "Ajukan hapus akun"}
          </button>
        </div>
      ) : (
        <p className="text-[12px] text-slate-500">Hak rumah tangga dijalankan kepala keluarga.</p>
      )}
      {pesan ? <p className="text-[12px] text-slate-600">{pesan}</p> : null}
    </section>
  );
}
