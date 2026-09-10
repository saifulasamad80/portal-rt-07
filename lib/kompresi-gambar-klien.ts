"use client";

import imageCompression from "browser-image-compression";

export const PROFIL_KOMPRESI = {
  dokumenIdentitas: { maxSizeMB: 0.1, maxWidthOrHeight: 1024 },
  fotoLapak: { maxSizeMB: 0.12, maxWidthOrHeight: 1000 },
  fotoPublik: { maxSizeMB: 0.16, maxWidthOrHeight: 1280 },
} as const;

export type KunciProfilKompresi = keyof typeof PROFIL_KOMPRESI;

export const MAKS_BYTE_GAMBAR_ASLI: Record<KunciProfilKompresi, number> = {
  dokumenIdentitas: 5 * 1024 * 1024,
  fotoLapak: 8 * 1024 * 1024,
  fotoPublik: 8 * 1024 * 1024,
};

const TIPE_GAMBAR_SAH = new Set(["image/jpeg", "image/png", "image/webp"]);

function pesanBatasAsli(kunci: KunciProfilKompresi) {
  const mb = Math.round(MAKS_BYTE_GAMBAR_ASLI[kunci] / (1024 * 1024));
  return `Ukuran foto asli terlalu besar. Pilih file di bawah ${mb} MB.`;
}

export async function kompresGambarKeDataUrl(
  file: File,
  kunciProfil: KunciProfilKompresi,
): Promise<string> {
  if (!TIPE_GAMBAR_SAH.has(file.type.toLowerCase())) {
    throw new Error("Format foto harus JPEG, PNG, atau WebP.");
  }
  if (file.size <= 0 || file.size > MAKS_BYTE_GAMBAR_ASLI[kunciProfil]) {
    throw new Error(pesanBatasAsli(kunciProfil));
  }

  const profil = PROFIL_KOMPRESI[kunciProfil];
  const fileKompresi = await imageCompression(file, {
    maxSizeMB: profil.maxSizeMB,
    maxWidthOrHeight: profil.maxWidthOrHeight,
    useWebWorker: false,
    fileType: "image/jpeg",
  });

  return berkasKeDataUrl(fileKompresi, MAKS_BYTE_GAMBAR_ASLI[kunciProfil]);
}

export async function berkasKeDataUrl(file: File, maksByte: number): Promise<string> {
  if (file.size <= 0 || file.size > maksByte) {
    throw new Error("Berkas terlalu besar untuk diunggah.");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Gagal membaca berkas."));
    };
    reader.onerror = () => reject(new Error("Gagal membaca berkas."));
  });
}
