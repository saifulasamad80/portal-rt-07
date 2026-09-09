export const PILIHAN_STATUS_TINGGAL = [
  "Penduduk Tetap",
  "Penduduk Tidak Tetap",
  "Penyewa Kos",
  "Penyewa Kontrakan",
] as const;

/**
 * Impor buku induk dan CSV lawas menulis nilai yang Carik terima.
 * "Warga Tetap" warisan dipetakan ke Penduduk Tetap, bukan disimpan ulang.
 */
export function petaStatusTinggalImpor(nilai: unknown): (typeof PILIHAN_STATUS_TINGGAL)[number] {
  const n = String(nilai ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ");
  if (!n) return "Penduduk Tetap";
  if (n === "warga tetap" || n === "penduduk tetap") return "Penduduk Tetap";
  if (n.includes("tidak tetap") || n.includes("tdk tetap") || n === "pendatang") {
    return "Penduduk Tidak Tetap";
  }
  if (n.includes("kos")) return "Penyewa Kos";
  if (n.includes("kontrak")) return "Penyewa Kontrakan";
  if (n.includes("tetap")) return "Penduduk Tetap";
  return "Penduduk Tetap";
}
