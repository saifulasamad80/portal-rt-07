import { buatGambarOpenGraph, TIPE_KONTEN_OG, UKURAN_OG } from "@/lib/gambar-open-graph";
import { ringkasTeksPengumuman } from "@/lib/pesan-whatsapp-pengumuman";
import { ambilPengumumanPublik } from "@/lib/pengumuman-publik";

export const alt = "Pengumuman resmi Portal Warga";
export const size = UKURAN_OG;
export const contentType = TIPE_KONTEN_OG;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function namaWilayah(masterRt: { nama_rt: string | null; nama_rw: string | null; kelurahan: string | null } | null) {
  return [masterRt?.kelurahan ? `Kel. ${masterRt.kelurahan}` : null, masterRt?.nama_rw, masterRt?.nama_rt || "RT"]
    .filter(Boolean)
    .join(" · ");
}

export default async function GambarOpenGraphPengumuman({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const muatan = await ambilPengumumanPublik(id);
  if (!muatan) {
    return buatGambarOpenGraph({
      kicker: "Pengumuman resmi",
      catatan: "Portal Warga",
      judul: "Pengumuman tidak ditemukan",
      deskripsi: "Siaran ini sudah tidak tersedia di mading portal.",
    });
  }

  const { siaran, masterRt } = muatan;
  return buatGambarOpenGraph({
    kicker: "Pengumuman resmi",
    catatan: namaWilayah(masterRt),
    judul: siaran.judul,
    deskripsi: ringkasTeksPengumuman(siaran.deskripsi || "", 140) || "Pengumuman resmi pengurus RT.",
  });
}
