"use client";

import { parseTeksOcr, type HasilOcrIdentitas } from "@/lib/ocr-dokumen-identitas";

const MAKS_SISI_OCR = 1800;
const MAKS_BYTE_ASLI = 8 * 1024 * 1024;

async function siapkanGambarOcr(berkas: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return berkas;
  const bitmap = await createImageBitmap(berkas);
  const skala = Math.min(1, MAKS_SISI_OCR / Math.max(bitmap.width, bitmap.height));
  const lebar = Math.max(1, Math.round(bitmap.width * skala));
  const tinggi = Math.max(1, Math.round(bitmap.height * skala));
  const canvas = document.createElement("canvas");
  canvas.width = lebar;
  canvas.height = tinggi;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return berkas;
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, lebar, tinggi);
  ctx.filter = "contrast(1.15) grayscale(1)";
  ctx.drawImage(bitmap, 0, 0, lebar, tinggi);
  bitmap.close();
  const blob = await new Promise<Blob | null>((selesai) => {
    canvas.toBlob((hasil) => selesai(hasil), "image/jpeg", 0.92);
  });
  return blob && blob.size > 0 ? blob : berkas;
}

/**
 * Menjalankan Tesseract di peramban. Gambar tidak diunggah ke mesin OCR
 * pihak ketiga; yang diunduh dari jsDelivr hanya model huruf.
 */
export async function bacaFotoIdentitasDiPerangkat(
  berkas: Blob,
  onProgress?: (persen: number) => void,
): Promise<HasilOcrIdentitas> {
  if (!berkas || berkas.size <= 0) {
    return parseTeksOcr("");
  }
  if (berkas.size > MAKS_BYTE_ASLI) {
    return {
      jenis: "tidak_dikenali",
      no_kk: "",
      alamat: "",
      kepala: null,
      anggota: [],
      peringatan: ["Berkas terlalu besar untuk dibaca di HP. Pilih foto di bawah 8 MB."],
    };
  }

  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (info) => {
      if (info.status === "recognizing text" && typeof info.progress === "number") {
        onProgress?.(Math.max(0, Math.min(100, Math.round(info.progress * 100))));
      }
    },
  });

  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const gambar = await siapkanGambarOcr(berkas).catch(() => berkas);
    const url = URL.createObjectURL(gambar);
    try {
      const { data } = await worker.recognize(url);
      return parseTeksOcr(data.text || "");
    } finally {
      URL.revokeObjectURL(url);
    }
  } finally {
    await worker.terminate();
  }
}
