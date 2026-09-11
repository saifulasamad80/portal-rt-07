import { buatGambarOpenGraph, TIPE_KONTEN_OG, UKURAN_OG } from "@/lib/gambar-open-graph";

export const alt = "Portal Warga RT 07/09";
export const size = UKURAN_OG;
export const contentType = TIPE_KONTEN_OG;
export const runtime = "nodejs";

export default async function GambarOpenGraphBeranda() {
  return buatGambarOpenGraph({
    kicker: "Portal Warga",
    catatan: "RT 07 / 09 · Kelurahan Tengah",
    judul: "Yang tertib terlihat dari angkanya.",
    deskripsi: "Sistem Informasi Terpadu dan Layanan Mandiri Warga",
  });
}
