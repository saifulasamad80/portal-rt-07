"use client";

import { useEffect, useState } from "react";
import PesanDialog, { type PesanDialogData } from "./PesanDialog";

const KATA_ERROR = [
  "gagal",
  "error",
  "ditolak",
  "menolak",
  "belum",
  "tidak dapat",
  "tidak valid",
  "wajib",
  "format",
  "pelanggaran",
  "sistem error",
  "jaringan",
  "bentrok",
];

function adalahError(teks: string) {
  const normal = teks.toLowerCase();
  return KATA_ERROR.some((kata) => normal.includes(kata));
}

export default function PesanDialogProvider() {
  const [pesan, setPesan] = useState<PesanDialogData | null>(null);

  useEffect(() => {
    const alertAsli = window.alert.bind(window);

    window.alert = (nilai?: unknown) => {
      const teks = String(nilai ?? "");
      const gagal = adalahError(teks);
      setPesan({
        tipe: gagal ? "gagal" : "sukses",
        judul: gagal ? "Tindakan belum berhasil" : "Pesan dari sistem",
        deskripsi: gagal
          ? "Periksa keterangan di bawah untuk mengetahui alasan kegagalan."
          : "Sistem menyampaikan informasi berikut.",
        teks: teks || "Tidak ada keterangan tambahan.",
      });
    };

    return () => {
      window.alert = alertAsli;
    };
  }, []);

  return <PesanDialog pesan={pesan} onClose={() => setPesan(null)} />;
}
