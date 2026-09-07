/**
 * PostgREST sering mengirim kolom numeric/int Postgres sebagai string.
 * Penjumlahan mentah (`sum + row.nominal`) menjadi concatenasi; null.toLocaleString meledak.
 */
export function angkaPostgrest(nilai: unknown): number {
  if (nilai == null || nilai === "") return 0;
  const n = typeof nilai === "number" ? nilai : Number(nilai);
  return Number.isFinite(n) ? n : 0;
}
