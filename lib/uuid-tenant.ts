/**
 * Satu-satunya pola UUID proyek. Vanity tenant seperti
 * 00000000-0000-0000-0000-000000000007 sah (8-4-4-4-12 hex).
 * Dilarang regex RFC 4122 versi/varian — itu menolak id RT 07.
 */
export const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const UUID_NOL = "00000000-0000-0000-0000-000000000000";
export const UUID_SENTINEL = UUID_NOL;

export function uuidFormatSah(nilai: unknown): boolean {
  return POLA_UUID.test(String(nilai || "").trim());
}

/** UUID kanonik yang boleh menjadi tenant key. UUID nol ditolak. */
export function uuidTenantSah(nilai: unknown): string | null {
  const bersih = String(nilai || "").trim();
  if (!POLA_UUID.test(bersih) || bersih.toLowerCase() === UUID_NOL) return null;
  return bersih;
}

export function adalahGalatTipeUuid(pesan: string | undefined): boolean {
  const teks = String(pesan || "").toLowerCase();
  return (
    teks.includes("invalid input syntax for type uuid") ||
    teks.includes("operator does not exist: uuid") ||
    teks.includes("uuid ~~")
  );
}
