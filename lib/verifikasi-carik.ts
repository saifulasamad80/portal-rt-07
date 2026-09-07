import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BATAS_ANGGOTA_KELUARGA,
  PESAN_TINJAUAN_PENGURUS,
  periksaKepemilikanAnggota,
  type IdentitasAnggotaTersimpan,
} from "@/lib/kebijakan-sensus";
import { POLA_UUID } from "@/lib/uuid-tenant";

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

type BarisWarga = {
  id: string;
  nik: string;
  nama_lengkap: string;
  tanggal_lahir: string | null;
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

function normalisasiJenisKelamin(nilai: string) {
  const n = nilai.toLowerCase();
  if (n.startsWith("l")) return "Laki-laki";
  if (n.startsWith("p")) return "Perempuan";
  return nilai;
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
    jenis_kelamin: normalisasiJenisKelamin(teks(sisa.jenis_kelamin)),
    agama: teks(sisa.agama),
    pekerjaan: teks(sisa.pekerjaan).slice(0, 100),
    no_whatsapp: teks(sisa.no_whatsapp).replace(/[^\d+]/g, ""),
    status_tinggal: teks(sisa.status_tinggal),
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

function sanitasiAnggota(
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
    const gender = normalisasiJenisKelamin(teks(a.jenis_kelamin));
    if (!dalamDaftar(gender, PILIHAN_JENIS_KELAMIN)) {
      return { ok: false, message: `Jenis kelamin ${label} wajib dipilih.` };
    }
    if (!teks(a.agama)) {
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
      agama: teks(a.agama),
      pekerjaan: teks(a.pekerjaan).slice(0, 100),
    });
  }

  return { ok: true, data: bersih };
}

export async function cariDuplikatWarga(
  supabase: SupabaseClient,
  warga: { id: string; nik: string; nama_lengkap: string; tanggal_lahir: string | null; rt_id: string }
): Promise<DuplikatWarga[]> {
  const hasil: DuplikatWarga[] = [];
  const nik = teks(warga.nik);
  const nama = teks(warga.nama_lengkap).toLowerCase();
  const tgl = normalisasiTanggal(warga.tanggal_lahir);
  const sudah = new Set<string>();

  const catat = (item: DuplikatWarga) => {
    const kunci = `${item.sumber}:${item.id}`;
    if (sudah.has(kunci) || item.id === warga.id) return;
    if (adalahArsipPemilu(item)) return;
    sudah.add(kunci);
    hasil.push(item);
  };

  if (nik.length === 16) {
    const { data: nikSama } = await supabase
      .from("warga")
      .select("id, nik, nama_lengkap, tanggal_lahir")
      .eq("nik", nik)
      .eq("rt_id", warga.rt_id)
      .neq("id", warga.id);

    for (const baris of (nikSama || []) as BarisWarga[]) {
      catat({
        id: baris.id,
        nik: baris.nik,
        nama_lengkap: baris.nama_lengkap,
        tanggal_lahir: baris.tanggal_lahir,
        alasan: "nik_sama",
        sumber: "warga",
      });
    }

    const { data: sebagaiAnggota } = await supabase
      .from("anggota_keluarga")
      .select("id, nik, nama_lengkap, tanggal_lahir, warga_id")
      .eq("nik", nik)
      .eq("rt_id", warga.rt_id)
      .neq("warga_id", warga.id);

    for (const baris of sebagaiAnggota || []) {
      catat({
        id: String(baris.id),
        nik: String(baris.nik || ""),
        nama_lengkap: String(baris.nama_lengkap || ""),
        tanggal_lahir: (baris.tanggal_lahir as string | null) ?? null,
        alasan: "nik_sebagai_anggota",
        sumber: "anggota_keluarga",
        warga_induk_id: (baris.warga_id as string | null) ?? null,
      });
    }
  }

  if (nama && nama !== NAMA_ARSIP && tgl && tgl !== TANGGAL_ARSIP) {
    const { data: identitasSama } = await supabase
      .from("warga")
      .select("id, nik, nama_lengkap, tanggal_lahir")
      .eq("tanggal_lahir", tgl)
      .eq("rt_id", warga.rt_id)
      .neq("id", warga.id);

    for (const baris of (identitasSama || []) as BarisWarga[]) {
      if (teks(baris.nama_lengkap).toLowerCase() !== nama) continue;
      catat({
        id: baris.id,
        nik: baris.nik,
        nama_lengkap: baris.nama_lengkap,
        tanggal_lahir: baris.tanggal_lahir,
        alasan: "identitas_sama",
        sumber: "warga",
      });
    }
  }

  return hasil;
}

type RencanaSinkronAnggota = {
  anggotaLama: IdentitasAnggotaTersimpan[];
};

type GagalSinkron = {
  ok: false;
  message: string;
  code?: "PERLU_TINJAUAN_PENGURUS";
};

type HasilSinkron = { ok: true } | GagalSinkron;

function perluTinjauanPengurus(): GagalSinkron {
  return {
    ok: false,
    code: "PERLU_TINJAUAN_PENGURUS",
    message: PESAN_TINJAUAN_PENGURUS,
  };
}

/**
 * Seluruh pemeriksaan kepemilikan dilakukan sebelum UPDATE pertama. Hasil
 * pencarian lintas-rumah hanya dipakai sebagai boolean dan tidak pernah
 * dikembalikan kepada warga, sehingga endpoint ini bukan oracle data NIK.
 */
async function siapkanSinkronAnggota(
  supabase: SupabaseClient,
  wargaId: string,
  rtId: string,
  anggotaBaru: AnggotaInput[]
): Promise<{ ok: true; rencana: RencanaSinkronAnggota } | { ok: false; message: string; code?: "PERLU_TINJAUAN_PENGURUS" }> {
  const { data: anggotaLama, error: errLama } = await supabase
    .from("anggota_keluarga")
    .select("id, nik")
    .eq("warga_id", wargaId)
    .eq("rt_id", rtId);

  if (errLama) {
    console.error("Preflight anggota keluarga gagal:", errLama.message);
    return { ok: false, message: "Data keluarga belum dapat diverifikasi. Coba lagi nanti." };
  }

  const tersimpan = (anggotaLama || []).map((a) => ({
    id: String(a.id),
    nik: a.nik == null ? null : teks(a.nik),
  }));
  const kebijakan = periksaKepemilikanAnggota(tersimpan, anggotaBaru);
  if (!kebijakan.ok) return perluTinjauanPengurus();

  if (kebijakan.nikBaru.length > 0) {
    const [cekWarga, cekAnggota] = await Promise.all([
      supabase.from("warga").select("id").in("nik", kebijakan.nikBaru).limit(1),
      supabase.from("anggota_keluarga").select("id").in("nik", kebijakan.nikBaru).limit(1),
    ]);

    if (cekWarga.error || cekAnggota.error) {
      console.error(
        "Pemeriksaan konflik NIK anggota gagal:",
        cekWarga.error?.message || cekAnggota.error?.message
      );
      return perluTinjauanPengurus();
    }
    if ((cekWarga.data?.length || 0) > 0 || (cekAnggota.data?.length || 0) > 0) {
      return perluTinjauanPengurus();
    }
  }

  return { ok: true, rencana: { anggotaLama: tersimpan } };
}

async function sinkronAnggota(
  supabase: SupabaseClient,
  wargaId: string,
  rtId: string,
  anggotaBaru: AnggotaInput[],
  rencana: RencanaSinkronAnggota
): Promise<HasilSinkron> {
  const idTertahan = new Set<string>();

  for (const a of anggotaBaru) {
    if (a.id) {
      idTertahan.add(a.id);
      const { data, error } = await supabase
        .from("anggota_keluarga")
        .update({
          nama_lengkap: a.nama_lengkap,
          hubungan_keluarga: a.hubungan_keluarga,
          hubungan_detail: a.hubungan_detail,
          tanggal_lahir: a.tanggal_lahir,
          tempat_lahir: a.tempat_lahir,
          jenis_kelamin: a.jenis_kelamin,
          agama: a.agama,
          pekerjaan: a.pekerjaan,
        })
        .eq("id", a.id)
        .eq("warga_id", wargaId)
        .eq("rt_id", rtId)
        .eq("nik", a.nik)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("Update anggota keluarga gagal:", error.message);
        return { ok: false, message: "Data anggota keluarga gagal diperbarui." };
      }
      if (!data) return perluTinjauanPengurus();
      continue;
    }

    const { data, error } = await supabase.from("anggota_keluarga").insert([
      {
        warga_id: wargaId,
        rt_id: rtId,
        nama_lengkap: a.nama_lengkap,
        nik: a.nik,
        hubungan_keluarga: a.hubungan_keluarga,
        hubungan_detail: a.hubungan_detail,
        tanggal_lahir: a.tanggal_lahir,
        tempat_lahir: a.tempat_lahir,
        jenis_kelamin: a.jenis_kelamin,
        agama: a.agama,
        pekerjaan: a.pekerjaan,
      },
    ]).select("id").maybeSingle();

    if (error) {
      console.error("Insert anggota keluarga gagal:", error.message);
      return error.code === "23505"
        ? perluTinjauanPengurus()
        : { ok: false, message: "Data anggota keluarga gagal ditambahkan." };
    }
    if (!data) return { ok: false, message: "Data anggota keluarga gagal ditambahkan." };
  }

  for (const lama of rencana.anggotaLama) {
    if (idTertahan.has(lama.id)) continue;

    let query = supabase
      .from("anggota_keluarga")
      .delete()
      .eq("id", lama.id)
      .eq("warga_id", wargaId);
    query = query.eq("rt_id", rtId);
    query = lama.nik === null ? query.is("nik", null) : query.eq("nik", lama.nik);
    const { data, error } = await query.select("id").maybeSingle();

    if (error) {
      console.error("Hapus anggota milik sendiri gagal:", error.message);
      return { ok: false, message: "Data anggota keluarga lama gagal diperbarui." };
    }
    if (!data) return perluTinjauanPengurus();
  }

  return { ok: true };
}

async function catatAudit(
  supabase: SupabaseClient,
  aktor: string,
  aksi: string,
  detail: string,
  rtId: string
) {
  const { error } = await supabase.from("audit_log").insert([
    { aktor, aksi, tabel_target: "warga", detail, rt_id: rtId },
  ]);
  if (error) console.error("Audit log verifikasi carik gagal:", error.message);
}

async function tandaiSensus(
  supabase: SupabaseClient,
  wargaId: string,
  catatan: string,
  status: string,
  rtId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: sudahAda, error: errCek } = await supabase
    .from("sensus_kesejahteraan")
    .select("id")
    .eq("warga_id", wargaId)
    .eq("rt_id", rtId)
    .maybeSingle();

  if (errCek) {
    console.error("Gagal memeriksa status verifikasi carik:", errCek.code || "database_error");
    return { ok: false, message: "Status verifikasi belum dapat diperiksa. Coba lagi nanti." };
  }

  const statusPayload = {
    catatan_tambahan: catatan,
    status_validasi: status,
  };

  // Nilai awal ini hanya untuk INSERT baris sensus baru. Baris yang sudah ada
  // mungkin berisi data kesehatan/kesejahteraan nyata dan tidak boleh disapu
  // menjadi default hanya karena status verifikasi Carik berubah.
  const payloadAwal = {
    ...statusPayload,
    ada_ibu_hamil: false,
    ada_disabilitas: false,
    ada_ibu_menyusui: false,
    ada_ibu_meninggal: false,
    ada_bayi_meninggal: false,
    ada_balita_meninggal: false,
    ada_bayi_baru_lahir: false,
    bayi_tanpa_akta: false,
    ada_ibu_nifas: false,
    memiliki_mck: true,
    memiliki_tempat_sampah: true,
    memiliki_spal: true,
    memiliki_resapan_air: true,
    sumber_air_utama: "PAM / Leding",
    status_kesehatan_rumah: "Rumah Sehat",
    jenis_makanan_pokok: "Beras / Nasi",
  };

  if (sudahAda?.id) {
    const { data, error } = await supabase
      .from("sensus_kesejahteraan")
      .update(statusPayload)
      .eq("id", sudahAda.id)
      .eq("warga_id", wargaId)
      .eq("rt_id", rtId)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("Gagal memperbarui cap verifikasi:", error.code || "database_error");
      return { ok: false, message: "Cap verifikasi belum dapat diperbarui. Coba lagi nanti." };
    }
    if (!data) return { ok: false, message: "Status verifikasi berubah saat diperbarui. Coba lagi." };
    return { ok: true };
  }

  const { error } = await supabase
    .from("sensus_kesejahteraan")
    .insert([{ warga_id: wargaId, rt_id: rtId, ...payloadAwal }]);
  if (error) {
    console.error("Gagal mencatat verifikasi carik:", error.code || "database_error");
    return { ok: false, message: "Verifikasi carik belum dapat dicatat. Coba lagi nanti." };
  }
  return { ok: true };
}

async function simpanVerifikasiCarikInternal(
  supabase: SupabaseClient,
  wargaId: string,
  biodataMentah: Record<string, unknown>,
  anggotaMentah: unknown,
  catatan: string,
  aktorMentah: string | null,
  opsi: { capCarik: boolean }
): Promise<HasilCarik> {
  if (!POLA_UUID.test(wargaId)) {
    return { success: false, message: "ID warga tidak valid." };
  }

  const { data: warga, error: errWarga } = await supabase
    .from("warga")
    .select("id, nik, nama_lengkap, rt_id, tanggal_lahir")
    .eq("id", wargaId)
    .maybeSingle();

  if (errWarga) {
    console.error("Pembacaan warga untuk verifikasi Carik gagal:", errWarga.message);
    return { success: false, message: "Data warga belum dapat diverifikasi. Coba lagi nanti." };
  }
  if (!warga) return { success: false, message: "Data warga tidak ditemukan. Mungkin sudah dihapus." };

  const rtId = String(warga.rt_id || "");
  if (!POLA_UUID.test(rtId)) {
    return { success: false, message: "Wilayah data warga belum valid. Hubungi pengurus RT." };
  }

  const biodata = sanitasiBiodata(biodataMentah);
  if (!biodata.ok) return { success: false, message: biodata.message };

  // FormData/Server Action arguments are attacker-controlled at runtime even
  // when the TypeScript signature says `AnggotaInput[]`. Never coerce a
  // malformed value to `[]`: doing so would interpret a bad request as an
  // instruction to delete every existing family member.
  if (!Array.isArray(anggotaMentah)) {
    return { success: false, message: PESAN_TINJAUAN_PENGURUS };
  }
  const anggota = sanitasiAnggota(anggotaMentah, String(warga.nik));
  if (!anggota.ok) return { success: false, message: anggota.message };

  // Preflight kepemilikan dan konflik harus selesai sebelum mutasi pertama.
  const persiapan = await siapkanSinkronAnggota(supabase, wargaId, rtId, anggota.data);
  if (!persiapan.ok) {
    return { success: false, message: persiapan.message, code: persiapan.code };
  }

  const queryUpdate = supabase
    .from("warga")
    .update(biodata.data)
    .eq("id", wargaId)
    .eq("nik", String(warga.nik))
    .eq("rt_id", rtId);

  const { data: wargaDiperbarui, error: errUpdate } = await queryUpdate.select("id").maybeSingle();

  if (errUpdate) {
    console.error("Penyimpanan biodata Carik gagal:", errUpdate.message);
    return { success: false, message: "Biodata belum berhasil disimpan. Coba lagi nanti." };
  }
  if (!wargaDiperbarui) {
    return { success: false, message: "Data warga berubah saat diverifikasi. Muat ulang halaman." };
  }

  const sinkron = await sinkronAnggota(
    supabase,
    wargaId,
    rtId,
    anggota.data,
    persiapan.rencana
  );
  if (!sinkron.ok) {
    return { success: false, message: sinkron.message, code: sinkron.code };
  }

  if (opsi.capCarik) {
    const catatanCap =
      teks(catatan).slice(0, 1000) ||
      "Data Carik diverifikasi oleh pengurus RT";
    const cap = await tandaiSensus(supabase, wargaId, catatanCap, "Disetujui", rtId);
    if (!cap.ok) return { success: false, message: cap.message };
  }

  const aktor = teks(aktorMentah).slice(0, 150) || "pengurus";

  await catatAudit(
    supabase,
    aktor,
    opsi.capCarik ? "Verifikasi Data Carik" : "Edit Data Warga",
    `NIK ${warga.nik} (${biodata.data.nama_lengkap}) ${
      opsi.capCarik ? "mengonfirmasi data warisan tanpa resolusi duplikat otomatis." : "diperbarui tanpa mengubah NIK."
    }`,
    rtId
  );

  return {
    success: true,
    message:
      opsi.capCarik
        ? "Data keluarga berhasil diverifikasi. Duplikat, bila ada, hanya dapat ditangani pengurus."
        : "Biodata dan anggota keluarga berhasil diperbarui. NIK tetap terkunci.",
    arah: undefined,
  };
}

/**
 * Jalur pengurus pun sengaja non-destruktif. Resolusi duplikat hanya boleh
 * lewat hapusDuplikatPilihan(), setelah kandidat divalidasi ulang.
 */
export async function simpanVerifikasiCarik(
  supabase: SupabaseClient,
  wargaId: string,
  biodataMentah: Record<string, unknown>,
  anggotaMentah: AnggotaInput[],
  catatan: string,
  aktor: string,
  opsi?: { capCarik?: boolean }
): Promise<HasilCarik> {
  return simpanVerifikasiCarikInternal(
    supabase,
    wargaId,
    biodataMentah,
    anggotaMentah,
    catatan,
    aktor,
    { capCarik: opsi?.capCarik !== false }
  );
}

export async function simpanVerifikasiCarikMandiri(
  supabase: SupabaseClient,
  identitas: IdentitasSensusMandiri,
  biodataMentah: Record<string, unknown>,
  anggotaMentah: unknown,
  catatan: string
): Promise<HasilCarik> {
  if (
    !POLA_UUID.test(identitas.id) ||
    !POLA_UUID.test(identitas.rtId) ||
    !/^\d{16}$/.test(identitas.nik)
  ) {
    return { success: false, message: "Identitas sesi warga tidak valid." };
  }

  const biodata = sanitasiBiodata(biodataMentah);
  if (!biodata.ok) return { success: false, message: biodata.message };

  // Argumen Server Action tetap attacker-controlled pada runtime. Nilai non-
  // array tidak boleh berubah arti menjadi daftar kosong (hapus semua anggota).
  if (!Array.isArray(anggotaMentah)) {
    return { success: false, message: PESAN_TINJAUAN_PENGURUS };
  }
  const anggota = sanitasiAnggota(anggotaMentah, identitas.nik);
  if (!anggota.ok) return { success: false, message: anggota.message };

  // Tidak ada fallback multi-query. RPC mengunci dan memvalidasi ulang warga,
  // tenant, NIK, serta ownership anggota di dalam satu transaksi PostgreSQL.
  const { error } = await supabase.rpc("simpan_sensus_mandiri", {
    p_warga_id: identitas.id,
    p_nik: identitas.nik,
    p_rt_id: identitas.rtId,
    p_biodata: biodata.data,
    p_anggota: anggota.data,
    p_catatan: teks(catatan).slice(0, 1000),
  });

  if (error) {
    console.error("RPC sensus mandiri ditolak:", error.code || "database_error");
    if (error.code === "42501" || error.code === "23505") {
      return {
        success: false,
        message: PESAN_TINJAUAN_PENGURUS,
        code: "PERLU_TINJAUAN_PENGURUS",
      };
    }
    if (error.code === "40001") {
      return { success: false, message: "Data berubah saat disimpan. Muat ulang halaman lalu coba lagi." };
    }
    return { success: false, message: "Verifikasi belum dapat disimpan. Coba lagi nanti." };
  }

  return {
    success: true,
    message: "Data keluarga berhasil diverifikasi. Duplikat, bila ada, hanya dapat ditangani pengurus.",
    arah: "/portal",
  };
}

/**
 * Laporan mandiri bersifat reversible: akun sendiri diblokir sementara dan
 * masuk antrean pengurus. Jalur ini tidak pernah memanggil penghapus warga.
 */
export async function laporkanNikTidakSesuaiMandiri(
  supabase: SupabaseClient,
  identitas: IdentitasSensusMandiri
): Promise<HasilCarik> {
  if (
    !POLA_UUID.test(identitas.id) ||
    !POLA_UUID.test(identitas.rtId) ||
    !/^\d{16}$/.test(identitas.nik)
  ) {
    return { success: false, message: "Identitas sesi warga tidak valid." };
  }

  const { error } = await supabase.rpc("laporkan_nik_tidak_sesuai_mandiri", {
    p_warga_id: identitas.id,
    p_nik: identitas.nik,
    p_rt_id: identitas.rtId,
  });
  if (error) {
    console.error("RPC laporan NIK mandiri ditolak:", error.code || "database_error");
    if (error.code === "40001") {
      return { success: false, message: "Status akun berubah. Muat ulang halaman sebelum mencoba lagi." };
    }
    return { success: false, message: "Laporan belum dapat diproses. Coba lagi nanti." };
  }

  return {
    success: true,
    message: "Laporan diterima. Akun diblokir sementara sampai pengurus RT memeriksa NIK Anda; tidak ada data yang dihapus.",
    arah: "/login?alasan=nik-tidak-sesuai",
  };
}

export async function ambilStatusCarik(supabase: SupabaseClient, wargaId: string, rtId: string) {
  const { data, error } = await supabase
    .from("sensus_kesejahteraan")
    .select("id, catatan_tambahan, status_validasi, created_at")
    .eq("warga_id", wargaId)
    .eq("rt_id", rtId)
    .maybeSingle();

  if (error) {
    console.error("Gagal membaca status carik:", error.code || "database_error");
    return { ok: false as const, message: "Status verifikasi belum dapat dibaca. Coba lagi nanti." };
  }

  return { ok: true as const, data: (data as RingkasanCarik | null) ?? null };
}
