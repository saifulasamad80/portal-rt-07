/**
 * Normalisasi kosakata data warga. Modul ini sengaja tanpa alias `@/`
 * agar tes Node bisa mengimpornya langsung.
 */

export const PILIHAN_STATUS_TINGGAL = [
  "Warga Tetap",
  "Penyewa Kos",
  "Penyewa Kontrakan",
] as const;

export const PILIHAN_AGAMA = [
  "Islam",
  "Kristen/Katolik",
  "Hindu",
  "Budha",
  "Konghucu",
] as const;

export const PILIHAN_JENIS_KELAMIN = ["Laki-laki", "Perempuan"] as const;

function teks(nilai: unknown) {
  return String(nilai ?? "").trim();
}

function dalamDaftar<T extends string>(nilai: string, daftar: readonly T[]) {
  return (daftar as readonly string[]).includes(nilai);
}

/**
 * Kosakata warisan dari impor CSV lama / isian bebas. Tanpa pemetaan ini,
 * select Carik tampil kosong lalu RPC simpan_sensus_mandiri menolak simpan —
 * warga terkunci dari seluruh layanan portal (terkunci).
 */
const ALIAS_STATUS_TINGGAL: Record<string, (typeof PILIHAN_STATUS_TINGGAL)[number]> = {
  "warga tetap": "Warga Tetap",
  "penyewa kos": "Penyewa Kos",
  kos: "Penyewa Kos",
  "penyewa kontrakan": "Penyewa Kontrakan",
  "warga kontrak": "Penyewa Kontrakan",
  kontrak: "Penyewa Kontrakan",
  pendatang: "Penyewa Kontrakan",
};

export function normalisasiJenisKelamin(nilai: unknown): (typeof PILIHAN_JENIS_KELAMIN)[number] | "" {
  const n = teks(nilai).toLowerCase();
  if (n.startsWith("l")) return "Laki-laki";
  if (n.startsWith("p")) return "Perempuan";
  return dalamDaftar(teks(nilai), PILIHAN_JENIS_KELAMIN) ? (teks(nilai) as (typeof PILIHAN_JENIS_KELAMIN)[number]) : "";
}

export function normalisasiStatusTinggal(nilai: unknown): (typeof PILIHAN_STATUS_TINGGAL)[number] | "" {
  const asli = teks(nilai);
  if (!asli) return "";
  const alias = ALIAS_STATUS_TINGGAL[asli.toLowerCase()];
  if (alias) return alias;
  return dalamDaftar(asli, PILIHAN_STATUS_TINGGAL) ? (asli as (typeof PILIHAN_STATUS_TINGGAL)[number]) : "";
}

export function normalisasiAgama(nilai: unknown): (typeof PILIHAN_AGAMA)[number] | "" {
  const n = teks(nilai).toLowerCase();
  if (!n) return "";
  if (n.includes("islam")) return "Islam";
  if (n.includes("kristen") || n.includes("katolik") || n.includes("katholik")) return "Kristen/Katolik";
  if (n.includes("hindu")) return "Hindu";
  if (n.includes("budh") || n.includes("budd")) return "Budha";
  if (n.includes("konghucu") || n.includes("khonghucu") || n.includes("confuc")) return "Konghucu";
  return dalamDaftar(teks(nilai), PILIHAN_AGAMA) ? (teks(nilai) as (typeof PILIHAN_AGAMA)[number]) : "";
}

/**
 * Nested `anggota_keluarga` sudah terikat `warga_id` rumah tangga ini.
 * `rt_id` kosong = stempel tenant warisan belum diisi, bukan silang-RT.
 * Hanya UUID yang berbeda yang disembunyikan.
 */
export function anggotaSamaWilayah(rtIdAnggota: unknown, rtIdWarga: unknown): boolean {
  const wilayahWarga = String(rtIdWarga || "").trim();
  const wilayahAnggota = String(rtIdAnggota || "").trim();
  if (!wilayahWarga) return false;
  if (!wilayahAnggota) return true;
  return wilayahAnggota === wilayahWarga;
}

export type BarisImporWarga = {
  nik: string;
  nama_lengkap: string;
  no_whatsapp: string;
  status_tinggal: (typeof PILIHAN_STATUS_TINGGAL)[number];
  detail_alamat: string;
  tanggal_lahir: string | null;
  tempat_lahir: string;
  jenis_kelamin: (typeof PILIHAN_JENIS_KELAMIN)[number];
  pekerjaan: string;
};

/**
 * Sanitasi satu baris CSV Buku Induk. Nilai status tinggal warisan dipetakan
 * ke kosakata kanonik; nilai asing ditolak (bukan diam-diam jadi Warga Tetap).
 */
export function siapkanBarisImporWarga(baris: Record<string, unknown>): { ok: true; data: BarisImporWarga } | { ok: false } {
  const nik = teks(baris.nik).replace(/\D/g, "");
  const namaLengkap = teks(baris.nama_lengkap).slice(0, 150);
  if (nik.length !== 16 || !namaLengkap) return { ok: false };

  const statusMentah = teks(baris.status_tinggal);
  const statusTinggal = normalisasiStatusTinggal(statusMentah) || (statusMentah === "" ? "Warga Tetap" : "");
  if (!statusTinggal) return { ok: false };

  const jkMentah = teks(baris.jenis_kelamin);
  const jenisKelamin = normalisasiJenisKelamin(jkMentah) || (jkMentah === "" ? "Laki-laki" : "");
  if (!jenisKelamin) return { ok: false };

  const tanggalLahir = teks(baris.tanggal_lahir).slice(0, 10);

  return {
    ok: true,
    data: {
      nik,
      nama_lengkap: namaLengkap,
      no_whatsapp: teks(baris.no_whatsapp).replace(/[^\d+]/g, ""),
      status_tinggal: statusTinggal,
      detail_alamat: teks(baris.detail_alamat).slice(0, 300),
      tanggal_lahir: /^\d{4}-\d{2}-\d{2}$/.test(tanggalLahir) ? tanggalLahir : null,
      tempat_lahir: teks(baris.tempat_lahir).slice(0, 100),
      jenis_kelamin: jenisKelamin,
      pekerjaan: teks(baris.pekerjaan).slice(0, 100),
    },
  };
}
