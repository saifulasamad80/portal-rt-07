import {
  USIA_MAKS_POSYANDU_BALITA,
  USIA_MIN_POSYANDU_LANSIA,
  umurDariTanggalIso,
} from "@/lib/kebijakan-privasi";

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export function tanggalLahirIso(nilai: unknown): string | null {
  const teks = String(nilai ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(teks)) return teks.slice(0, 10);
  return null;
}

export function jiwaLayakPosyanduBalita(tanggalLahir: unknown, acuan = new Date()): boolean {
  const iso = tanggalLahirIso(tanggalLahir);
  if (!iso) return false;
  const umur = umurDariTanggalIso(iso, acuan);
  return umur != null && umur >= 0 && umur <= USIA_MAKS_POSYANDU_BALITA;
}

export function jiwaLayakPosyanduLansia(tanggalLahir: unknown, acuan = new Date()): boolean {
  const iso = tanggalLahirIso(tanggalLahir);
  if (!iso) return false;
  const umur = umurDariTanggalIso(iso, acuan);
  return umur != null && umur >= USIA_MIN_POSYANDU_LANSIA;
}

export function tanggalKunjunganSah(nilai: unknown): string | null {
  const tanggal = String(nilai ?? "").trim();
  if (!POLA_TANGGAL.test(tanggal)) return null;
  const [tahun, bulan, hari] = tanggal.split("-").map(Number);
  const pemeriksaan = new Date(Date.UTC(tahun, bulan - 1, hari));
  return pemeriksaan.getUTCFullYear() === tahun
    && pemeriksaan.getUTCMonth() === bulan - 1
    && pemeriksaan.getUTCDate() === hari
    ? tanggal
    : null;
}

export function angkaKunjunganOpsional(
  nilai: unknown,
  maksimum: number
): { ok: true; nilai: number | null } | { ok: false } {
  if (nilai == null || nilai === "") return { ok: true, nilai: null };
  const angka = Number(nilai);
  if (!Number.isFinite(angka) || angka < 0 || angka > maksimum) return { ok: false };
  return { ok: true, nilai: angka };
}

export const KUNCI_JIWA_KEPALA = "kepala";

export type JiwaPosyandu = {
  kunci: string;
  anggota_id: string | null;
  nama: string;
};

export type KartuIzinPosyandu = {
  id: string;
  nama: string;
  jiwaBalita: JiwaPosyandu[];
  jiwaLansia: JiwaPosyandu[];
};

export type BarisKunjunganBalita = {
  id: string;
  created_at: string;
  nama_anak: string;
  nama_ibu: string | null;
  tanggal_kunjungan: string;
  berat_kg: number | null;
  tinggi_cm: number | null;
  imunisasi: string | null;
  catatan: string | null;
};

export type BarisKunjunganLansia = {
  id: string;
  created_at: string;
  nama_peserta: string;
  tanggal_kunjungan: string;
  tensi_darah: string | null;
  gula_darah: number | null;
  berat_kg: number | null;
  catatan: string | null;
};

export function kunciJiwaPosyandu(anggotaId: string | null | undefined): string {
  return anggotaId ? String(anggotaId) : KUNCI_JIWA_KEPALA;
}

export function anggotaIdDariKunciJiwa(kunci: string): string | null {
  const bersih = String(kunci || "").trim();
  if (!bersih || bersih === KUNCI_JIWA_KEPALA) return null;
  return bersih;
}
