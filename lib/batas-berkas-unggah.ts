/** Batas berkas setelah kompresi. Server menolak di atas angka ini. */
export const BATAS_BYTE_FOTO = 200 * 1024;
/** Surat RT rata-rata ~1 MB; 1,5 MB menyisakan ruang tanpa menembus kuota Storage. */
export const BATAS_BYTE_PDF = 1536 * 1024;
export const BATAS_DATA_URL_FOTO = 280_000;
export const BATAS_DATA_URL_PDF = 2_200_000;

export const KUOTA_FOTO_GALERI = 40;

export const KATEGORI_GALERI = [
  "Kerja bakti",
  "Posyandu",
  "Hajatan",
  "Rapat RT",
  "Perayaan",
  "Lainnya",
] as const;

export type KategoriGaleri = (typeof KATEGORI_GALERI)[number];

export const BUCKET_GALERI = "galeri_kegiatan";
export const BUCKET_LAMPIRAN_PENGUMUMAN = "lampiran_pengumuman";
export const BUCKET_LAPAK = "lapak_warga";
