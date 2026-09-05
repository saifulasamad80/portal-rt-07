export const BATAS_ANGGOTA_KELUARGA = 30;
export const PESAN_TINJAUAN_PENGURUS =
  "Data salah satu anggota sudah tercatat dan perlu diperiksa pengurus RT.";

export type IdentitasAnggotaTersimpan = {
  id: string;
  nik: string | null;
};

export type IdentitasAnggotaMasuk = {
  id?: string;
  nik: string;
};

export type HasilKebijakanAnggota =
  | { ok: true; nikBaru: string[] }
  | { ok: false };

/**
 * Keputusan kepemilikan murni, tanpa database dan tanpa data korban di hasil.
 * ID asing/stale dan perubahan NIK anggota lama sama-sama ditolak.
 */
export function periksaKepemilikanAnggota(
  anggotaLama: IdentitasAnggotaTersimpan[],
  anggotaMasuk: IdentitasAnggotaMasuk[]
): HasilKebijakanAnggota {
  const berdasarkanId = new Map(anggotaLama.map((anggota) => [anggota.id, anggota]));
  const idMasuk = new Set<string>();
  const nikBaru: string[] = [];

  for (const anggota of anggotaMasuk) {
    if (!anggota.id) {
      nikBaru.push(anggota.nik);
      continue;
    }

    if (idMasuk.has(anggota.id)) return { ok: false };
    idMasuk.add(anggota.id);

    const tersimpan = berdasarkanId.get(anggota.id);
    if (!tersimpan || tersimpan.nik !== anggota.nik) return { ok: false };
  }

  return { ok: true, nikBaru };
}
