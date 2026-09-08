/**
 * Modul murni formulir Carik. Aman diimpor dari Client Component.
 * Mutasi database dan klien Supabase ada di lib/verifikasi-carik-server.ts.
 */
import {
  BATAS_ANGGOTA_KELUARGA,
  PESAN_TINJAUAN_PENGURUS,
} from "@/lib/kebijakan-sensus";
import { POLA_UUID } from "@/lib/uuid-tenant";
import {
  PILIHAN_AGAMA,
  PILIHAN_JENIS_KELAMIN,
  PILIHAN_STATUS_TINGGAL,
  normalisasiAgama,
  normalisasiJenisKelamin,
  normalisasiStatusTinggal,
} from "./normalisasi-warga";

export {
  PILIHAN_AGAMA,
  PILIHAN_JENIS_KELAMIN,
  PILIHAN_STATUS_TINGGAL,
  anggotaSamaWilayah,
  normalisasiAgama,
  normalisasiJenisKelamin,
  normalisasiStatusTinggal,
  siapkanBarisImporWarga,
} from "./normalisasi-warga";
export type { BarisImporWarga } from "./normalisasi-warga";

export const PILIHAN_PENDAPATAN = [
  "< 1 Juta",
  "1 - 3 Juta",
  "3 - 5 Juta",
  "5 - 10 Juta",
  "> 10 Juta",
] as const;

export const PILIHAN_DAYA_LISTRIK = [
  "450 VA (Subsidi)",
  "900 VA (Subsidi)",
  "900 VA (Non-Subsidi)",
  "1300 VA",
  "2200 VA",
  "> 2200 VA",
] as const;

export const PILIHAN_HUBUNGAN = ["Istri", "Suami", "Anak", "Lainnya"] as const;

export const BIDANG_WAJIB_CARIK = [
  "nama_lengkap",
  "tempat_lahir",
  "tanggal_lahir",
  "jenis_kelamin",
  "agama",
  "pekerjaan",
  "no_whatsapp",
  "status_tinggal",
  "detail_alamat",
  "pendapatan_bulanan",
  "daya_listrik",
] as const;

const TANGGAL_ARSIP = "1900-01-01";
const NAMA_ARSIP = "arsip pemilih";

export type HasilCarik = {
  success: boolean;
  message: string;
  arah?: string;
  code?: "PERLU_TINJAUAN_PENGURUS";
};

export type IdentitasSensusMandiri = {
  id: string;
  nik: string;
  rtId: string;
};

export type AnggotaInput = {
  id?: string;
  nama_lengkap: string;
  nik: string;
  hubungan_keluarga: string;
  hubungan_detail?: string | null;
  tanggal_lahir: string;
  tempat_lahir: string;
  jenis_kelamin: string;
  agama: string;
  pekerjaan: string;
};

export type BiodataInput = {
  nama_lengkap: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  jenis_kelamin: string;
  agama: string;
  pekerjaan: string;
  no_whatsapp: string;
  status_tinggal: string;
  detail_alamat: string;
  pendapatan_bulanan: string;
  daya_listrik: string;
};

export type DuplikatWarga = {
  id: string;
  nik: string;
  nama_lengkap: string;
  tanggal_lahir: string | null;
  alasan: "nik_sama" | "identitas_sama" | "nik_sebagai_anggota";
  sumber: "warga" | "anggota_keluarga";
  warga_induk_id?: string | null;
};

export type RingkasanCarik = {
  id: string;
  catatan_tambahan: string | null;
  status_validasi: string | null;
  created_at: string | null;
};

function teks(nilai: unknown) {
  return String(nilai ?? "").trim();
}

export function nilaiKosong(nilai: unknown) {
  const isi = teks(nilai);
  return isi === "" || isi === "-" || isi === "MENYUSUL";
}

export function adalahArsipPemilu(baris: { nama_lengkap?: string | null; tanggal_lahir?: string | null; nik?: string | null }) {
  const nama = teks(baris.nama_lengkap).toLowerCase();
  const tgl = teks(baris.tanggal_lahir).slice(0, 10);
  const nik = teks(baris.nik);
  return nama === NAMA_ARSIP || tgl === TANGGAL_ARSIP || (nik.startsWith("99") && nama === NAMA_ARSIP);
}

export function nilaiAda(nilai: unknown) {
  return !nilaiKosong(nilai);
}

export function hitungKelengkapan(warga: Record<string, unknown>) {
  const terisi = BIDANG_WAJIB_CARIK.filter((kolom) => nilaiAda(warga[kolom]));
  return {
    terisi: terisi.length,
    wajib: BIDANG_WAJIB_CARIK.length,
    persen: Math.round((terisi.length / BIDANG_WAJIB_CARIK.length) * 100),
    kosong: BIDANG_WAJIB_CARIK.filter((kolom) => !nilaiAda(warga[kolom])),
  };
}

export function validasiNik(nikInput: string, pemilik: string): string | null {
  const nik = teks(nikInput).replace(/\D/g, "");
  if (nik.length !== 16) return `NIK ${pemilik} harus 16 digit.`;
  if (/^(\d)\1{15}$/.test(nik)) return `NIK ${pemilik} terdeteksi tidak sah (angka berulang).`;
  if (nik === "1234567890123456") return `NIK ${pemilik} tidak valid.`;
  return null;
}

function normalisasiTanggal(nilai: unknown) {
  const isi = teks(nilai).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(isi) ? isi : "";
}

function dalamDaftar<T extends string>(nilai: string, daftar: readonly T[]) {
  return (daftar as readonly string[]).includes(nilai);
}

export function sanitasiBiodata(mentah: Record<string, unknown>): { ok: true; data: BiodataInput } | { ok: false; message: string } {
  // NIK sengaja dibuang di sini: kolom itu gembok identitas dan tidak boleh
  // ikut payload UPDATE, baik dari warga maupun pengurus.
  const { nik: _nikDiabaikan, pin: _pinDiabaikan, id: _idDiabaikan, ...sisa } = mentah;
  void _nikDiabaikan;
  void _pinDiabaikan;
  void _idDiabaikan;

  const data: BiodataInput = {
    nama_lengkap: teks(sisa.nama_lengkap).slice(0, 150),
    tempat_lahir: teks(sisa.tempat_lahir).slice(0, 100),
    tanggal_lahir: normalisasiTanggal(sisa.tanggal_lahir),
    jenis_kelamin: normalisasiJenisKelamin(sisa.jenis_kelamin),
    agama: normalisasiAgama(sisa.agama) || teks(sisa.agama),
    pekerjaan: teks(sisa.pekerjaan).slice(0, 100),
    no_whatsapp: teks(sisa.no_whatsapp).replace(/[^\d+]/g, ""),
    status_tinggal: normalisasiStatusTinggal(sisa.status_tinggal) || teks(sisa.status_tinggal),
    detail_alamat: teks(sisa.detail_alamat).slice(0, 300),
    pendapatan_bulanan: teks(sisa.pendapatan_bulanan),
    daya_listrik: teks(sisa.daya_listrik),
  };

  if (!data.nama_lengkap) return { ok: false, message: "Nama lengkap wajib diisi." };
  if (!data.tempat_lahir) return { ok: false, message: "Tempat lahir wajib diisi." };
  if (!data.tanggal_lahir) return { ok: false, message: "Tanggal lahir wajib diisi." };
  if (!dalamDaftar(data.jenis_kelamin, PILIHAN_JENIS_KELAMIN)) {
    return { ok: false, message: "Jenis kelamin belum dipilih dengan benar." };
  }
  if (!dalamDaftar(data.agama, PILIHAN_AGAMA)) {
    return { ok: false, message: "Agama belum dipilih dengan benar." };
  }
  if (!data.pekerjaan) return { ok: false, message: "Pekerjaan wajib diisi." };
  if (data.no_whatsapp.replace(/\D/g, "").length < 10) {
    return { ok: false, message: "Nomor WhatsApp wajib diisi (minimal 10 digit, mulai 08)." };
  }
  if (!dalamDaftar(data.status_tinggal, PILIHAN_STATUS_TINGGAL)) {
    return { ok: false, message: "Status tinggal harus Warga Tetap, Penyewa Kos, atau Penyewa Kontrakan." };
  }
  if (!data.detail_alamat) return { ok: false, message: "Detail alamat (gang/blok/nomor rumah) wajib diisi." };
  if (!dalamDaftar(data.pendapatan_bulanan, PILIHAN_PENDAPATAN)) {
    return { ok: false, message: "Pendapatan bulanan belum dipilih dengan benar." };
  }
  if (!dalamDaftar(data.daya_listrik, PILIHAN_DAYA_LISTRIK)) {
    return { ok: false, message: "Daya listrik terpasang belum dipilih dengan benar." };
  }

  return { ok: true, data };
}

export function sanitasiAnggota(
  daftar: unknown[],
  nikKepala: string
): { ok: true; data: AnggotaInput[] } | { ok: false; message: string } {
  if (daftar.length > BATAS_ANGGOTA_KELUARGA) {
    return { ok: false, message: `Maksimal ${BATAS_ANGGOTA_KELUARGA} anggota keluarga per rumah tangga.` };
  }

  const nikTerpakai = new Set<string>([teks(nikKepala)]);
  const idTerpakai = new Set<string>();
  const bersih: AnggotaInput[] = [];

  for (let i = 0; i < daftar.length; i++) {
    const mentah = daftar[i];
    if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) {
      return { ok: false, message: PESAN_TINJAUAN_PENGURUS };
    }

    const a = mentah as Record<string, unknown>;
    const label = teks(a.nama_lengkap) || `Anggota ${i + 1}`;
    const nama = teks(a.nama_lengkap).slice(0, 150);
    const nik = teks(a.nik).replace(/\D/g, "");
    const hubungan = teks(a.hubungan_keluarga);
    const membawaId = Object.prototype.hasOwnProperty.call(a, "id");
    const id = membawaId && typeof a.id === "string" ? teks(a.id) : undefined;
    const errNik = validasiNik(nik, label);
    if (errNik) return { ok: false, message: errNik };
    // Jika properti ID hadir, nilainya wajib UUID valid. Nilai kosong/0/null
    // tidak boleh diam-diam diturunkan menjadi INSERT anggota baru.
    if (membawaId && (!id || !POLA_UUID.test(id))) {
      return { ok: false, message: PESAN_TINJAUAN_PENGURUS };
    }
    if (id && idTerpakai.has(id)) {
      return { ok: false, message: PESAN_TINJAUAN_PENGURUS };
    }
    if (id) idTerpakai.add(id);
    if (!nama) return { ok: false, message: `Nama ${label} wajib diisi.` };
    if (!dalamDaftar(hubungan, PILIHAN_HUBUNGAN)) {
      return { ok: false, message: `Hubungan keluarga untuk ${label} wajib dipilih.` };
    }
    if (hubungan === "Lainnya" && !teks(a.hubungan_detail)) {
      return { ok: false, message: `Jelaskan hubungan keluarga untuk ${label}.` };
    }
    if (!teks(a.tempat_lahir)) return { ok: false, message: `Tempat lahir ${label} wajib diisi.` };
    if (!normalisasiTanggal(a.tanggal_lahir)) return { ok: false, message: `Tanggal lahir ${label} wajib diisi.` };
    const gender = normalisasiJenisKelamin(a.jenis_kelamin);
    if (!dalamDaftar(gender, PILIHAN_JENIS_KELAMIN)) {
      return { ok: false, message: `Jenis kelamin ${label} wajib dipilih.` };
    }
    const agama = normalisasiAgama(a.agama) || teks(a.agama);
    if (!dalamDaftar(agama, PILIHAN_AGAMA)) {
      return { ok: false, message: `Agama ${label} wajib dipilih.` };
    }
    if (!teks(a.pekerjaan)) return { ok: false, message: `Pekerjaan ${label} wajib diisi.` };
    if (nikTerpakai.has(nik)) {
      return { ok: false, message: `NIK ${nik} dipakai lebih dari sekali dalam keluarga ini.` };
    }
    nikTerpakai.add(nik);

    bersih.push({
      id,
      nama_lengkap: nama,
      nik,
      hubungan_keluarga: hubungan,
      hubungan_detail: hubungan === "Lainnya" ? teks(a.hubungan_detail).slice(0, 80) : null,
      tanggal_lahir: normalisasiTanggal(a.tanggal_lahir),
      tempat_lahir: teks(a.tempat_lahir).slice(0, 100),
      jenis_kelamin: gender,
      agama,
      pekerjaan: teks(a.pekerjaan).slice(0, 100),
    });
  }

  return { ok: true, data: bersih };
}
