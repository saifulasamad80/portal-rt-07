export type ItemKotakSampah = {
  id: string;
  tabel_asal: "warga" | "anggota_keluarga";
  baris_id: string;
  bundel_id: string;
  nama_tampil: string;
  alasan: string | null;
  aktor: string | null;
  dihapus_pada: string;
  dipulihkan_pada: string | null;
};

export type BundelKotakSampah = {
  bundel_id: string;
  dihapus_pada: string;
  aktor: string | null;
  alasan: string | null;
  kepala: ItemKotakSampah | null;
  anggota: ItemKotakSampah[];
};

export type HasilKotakSampah = {
  success: boolean;
  message: string;
  dipulihkan?: number;
};
