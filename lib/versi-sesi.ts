export const VERSI_SESI_AWAL = 1;
export const KLAIM_VERSI_SESI = "session_version";

const BATAS_AMAN = Number.MAX_SAFE_INTEGER;

/**
 * Klaim JWT lama tidak membawa session_version. Anggap itu versi 1 agar
 * deploy kolom baru tidak mematikan sesi yang masih sah. Nilai cacat
 * (bukan integer >= 1) ditolak, bukan dinormalisasi diam-diam.
 */
export function angkaVersiSesi(nilai: unknown): number | null {
  if (nilai == null) return VERSI_SESI_AWAL;
  if (typeof nilai === "number") {
    return Number.isInteger(nilai) && nilai >= VERSI_SESI_AWAL && nilai <= BATAS_AMAN
      ? nilai
      : null;
  }
  if (typeof nilai === "string" && /^\d+$/.test(nilai)) {
    const angka = Number(nilai);
    return Number.isInteger(angka) && angka >= VERSI_SESI_AWAL && angka <= BATAS_AMAN
      ? angka
      : null;
  }
  return null;
}

export function sesiVersiMasihHidup(klaimJwt: unknown, versiDatabase: unknown): boolean {
  const klaim = angkaVersiSesi(klaimJwt);
  const basis = angkaVersiSesi(versiDatabase);
  return klaim !== null && basis !== null && klaim === basis;
}
