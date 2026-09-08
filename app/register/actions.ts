"use server";

import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { JUDUL_TIKET_PENDAFTARAN } from "@/lib/kebijakan-sensus";
import { pastikanRtRegistrasiAda } from "@/lib/registrasi-tenant";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import {
  PILIHAN_AGAMA,
  PILIHAN_DAYA_LISTRIK,
  PILIHAN_HUBUNGAN,
  PILIHAN_JENIS_KELAMIN,
  PILIHAN_PENDAPATAN,
  PILIHAN_STATUS_TINGGAL,
  normalisasiAgama,
  normalisasiJenisKelamin,
  normalisasiStatusTinggal,
} from "@/lib/verifikasi-carik";

/**
 * Public registration is intentionally backed by the service-role client: a
 * person who has not registered yet has no Supabase session.  That client is
 * therefore kept in this server-only action and is never exposed to the
 * browser.  Every value below is treated as hostile input nevertheless.
 */

const BUCKET_DOKUMEN = "dokumen_warga";
const MAKS_ANGGOTA = 30;
const MAKS_BYTE_DOKUMEN = 512 * 1024;
const MAKS_TOTAL_BYTE_DOKUMEN = 2 * 1024 * 1024;
const MAKS_DATA_URL = 720 * 1024;
const FITUR_KTP_AKTIF = false;

const STATUS_TINGGAL_SAH = PILIHAN_STATUS_TINGGAL;
const JENIS_KELAMIN_SAH = PILIHAN_JENIS_KELAMIN;
const AGAMA_SAH = PILIHAN_AGAMA;
const HUBUNGAN_SAH = PILIHAN_HUBUNGAN;
const PENDAPATAN_SAH = PILIHAN_PENDAPATAN;
const LISTRIK_SAH = PILIHAN_DAYA_LISTRIK;
const PIN_LEMAH = new Set(["123456", "111111", "000000", "654321", "121212", "123123"]);

const PESAN_VALIDASI = "Data pendaftaran tidak valid. Periksa kembali isian formulir.";
// Keep duplicate handling deliberately generic.  A public registration action
// must not become a NIK-existence oracle (the caller can submit arbitrary NIKs
// without an authenticated session).
const PESAN_DUPLIKAT = "PENDAFTARAN DITOLAK: Salah satu NIK yang Anda masukkan (Kepala Keluarga atau Anggota) sudah terdaftar di sistem. Jika Suami/Istri Anda sudah terdaftar sebagai Kepala Keluarga, dilarang mendaftar ulang. Silakan LOGIN menggunakan NIK yang sudah terdaftar tersebut untuk merevisi data keluarga.";
const PESAN_INTERNAL = "Pendaftaran belum dapat diproses saat ini. Silakan coba lagi nanti atau hubungi pengurus RT.";

function pesanSupabase(error: unknown, cadangan: string): string {
  if (!error || typeof error !== "object") return cadangan;
  const e = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  const bagian = [e.code, e.message, e.details, e.hint]
    .filter((nilai): nilai is string => typeof nilai === "string" && nilai.trim().length > 0)
    .map((nilai) => nilai.trim());
  return bagian.length > 0 ? bagian.join(" | ") : cadangan;
}

type Rekaman = Record<string, unknown>;

type DokumenInput =
  | { jenis: "kosong" }
  | { jenis: "menyusul"; nilai: "MENYUSUL" }
  | {
      jenis: "unggah";
      buffer: Buffer;
      contentType: "image/jpeg" | "image/png" | "image/webp";
      ekstensi: "jpg" | "png" | "webp";
    };

type KepalaTernormalisasi = {
  nik: string;
  nama_lengkap: string;
  no_whatsapp: string;
  pin: string;
  status_tinggal: (typeof STATUS_TINGGAL_SAH)[number];
  detail_alamat: string;
  tanggal_lahir: string;
  tempat_lahir: string;
  jenis_kelamin: (typeof JENIS_KELAMIN_SAH)[number];
  agama: (typeof AGAMA_SAH)[number];
  pekerjaan: string;
  pendapatan_bulanan: (typeof PENDAPATAN_SAH)[number];
  daya_listrik: (typeof LISTRIK_SAH)[number];
  ktp: DokumenInput;
  kk: DokumenInput;
};

type AnggotaTernormalisasi = {
  nik: string;
  nama_lengkap: string;
  hubungan_keluarga: (typeof HUBUNGAN_SAH)[number];
  hubungan_detail: string | null;
  tanggal_lahir: string;
  tempat_lahir: string;
  jenis_kelamin: (typeof JENIS_KELAMIN_SAH)[number];
  agama: (typeof AGAMA_SAH)[number];
  pekerjaan: string;
  ktp: DokumenInput;
};

class RegistrasiAmanError extends Error {
  readonly kategori: "validasi" | "duplikat" | "konfigurasi";

  constructor(
    message: string,
    kategori: "validasi" | "duplikat" | "konfigurasi" = "validasi"
  ) {
    super(message);
    this.name = "RegistrasiAmanError";
    this.kategori = kategori;
  }
}

function rekaman(value: unknown, pesan = PESAN_VALIDASI): Rekaman {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RegistrasiAmanError(pesan);
  }
  return value as Rekaman;
}

function teks(
  source: Rekaman,
  key: string,
  maksimum: number,
  wajib = true
): string {
  const value = source[key];
  if (value === null || value === undefined) {
    if (wajib) throw new RegistrasiAmanError(PESAN_VALIDASI);
    return "";
  }
  if (typeof value !== "string") throw new RegistrasiAmanError(PESAN_VALIDASI);
  const normalized = value.normalize("NFC").trim();
  // Control characters can poison logs, exports, and downstream notification
  // templates.  Newlines are not needed in any registration field.
  if (!normalized || normalized.length > maksimum || /[\u0000-\u001f\u007f]/.test(normalized)) {
    if (!wajib && !normalized) return "";
    throw new RegistrasiAmanError(PESAN_VALIDASI);
  }
  return normalized;
}

function pilih<T extends readonly string[]>(source: Rekaman, key: string, choices: T): T[number] {
  const value = teks(source, key, 80);
  if (!choices.includes(value)) throw new RegistrasiAmanError(PESAN_VALIDASI);
  return value as T[number];
}

function nik(source: Rekaman, key: string): string {
  const value = teks(source, key, 16);
  if (!/^\d{16}$/.test(value) || /^(\d)\1{15}$/.test(value) || value === "1234567890123456") {
    throw new RegistrasiAmanError(PESAN_VALIDASI);
  }
  return value;
}

function tanggal(source: Rekaman, key: string): string {
  const value = teks(source, key, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RegistrasiAmanError(PESAN_VALIDASI);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new RegistrasiAmanError(PESAN_VALIDASI);
  }
  const today = new Date();
  const tomorrow = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
  if (parsed.getTime() >= tomorrow.getTime()) throw new RegistrasiAmanError(PESAN_VALIDASI);
  // A 130-year upper bound catches malformed dates without imposing an age
  // policy on newborns or elderly residents.
  const oldest = new Date(Date.UTC(today.getUTCFullYear() - 130, today.getUTCMonth(), today.getUTCDate()));
  if (parsed.getTime() < oldest.getTime()) throw new RegistrasiAmanError(PESAN_VALIDASI);
  return value;
}

function magicSesuai(buffer: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (contentType === "image/png") {
    return buffer.length >= 8 && Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).equals(buffer.subarray(0, 8));
  }
  return contentType === "image/webp"
    && buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP";
}

/** Parse and constrain a data URL before Buffer.from can allocate memory. */
function dokumen(value: unknown): DokumenInput {
  if (value === null || value === undefined) return { jenis: "kosong" };
  if (typeof value !== "string") throw new RegistrasiAmanError(PESAN_VALIDASI);
  if (value === "MENYUSUL") return { jenis: "menyusul", nilai: "MENYUSUL" };
  if (!value.startsWith("data:")) throw new RegistrasiAmanError(PESAN_VALIDASI);
  if (value.length > MAKS_DATA_URL) throw new RegistrasiAmanError(PESAN_VALIDASI);

  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match || match[2].length === 0 || match[2].length % 4 !== 0) {
    throw new RegistrasiAmanError(PESAN_VALIDASI);
  }
  const contentType = match[1].toLowerCase() as "image/jpeg" | "image/png" | "image/webp";
  const encoded = match[2];
  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.length || buffer.length > MAKS_BYTE_DOKUMEN || !magicSesuai(buffer, contentType)) {
    throw new RegistrasiAmanError(PESAN_VALIDASI);
  }
  const ekstensi = contentType === "image/jpeg" ? "jpg" : contentType.slice("image/".length) as "png" | "webp";
  return { jenis: "unggah", buffer, contentType, ekstensi };
}

async function rtRegistrasiTerikat(rtIdMasukan: unknown): Promise<string> {
  const wilayah = await pastikanRtRegistrasiAda(rtIdMasukan);
  if (!wilayah.ok) throw new RegistrasiAmanError(wilayah.message, "konfigurasi");
  return wilayah.wilayah.rtId;
}

function normalisasiKepala(value: unknown): KepalaTernormalisasi {
  const source = rekaman(value);
  const hasil: KepalaTernormalisasi = {
    nik: nik(source, "nik"),
    nama_lengkap: teks(source, "nama_lengkap", 150),
    no_whatsapp: teks(source, "no_whatsapp", 15),
    pin: teks(source, "pin", 6),
    status_tinggal: pilih(
      { status_tinggal: normalisasiStatusTinggal(source.status_tinggal) },
      "status_tinggal",
      STATUS_TINGGAL_SAH
    ),
    detail_alamat: teks(source, "detail_alamat", 300),
    tanggal_lahir: tanggal(source, "tanggal_lahir"),
    tempat_lahir: teks(source, "tempat_lahir", 100),
    jenis_kelamin: pilih(
      { jenis_kelamin: normalisasiJenisKelamin(source.jenis_kelamin) },
      "jenis_kelamin",
      JENIS_KELAMIN_SAH
    ),
    agama: pilih({ agama: normalisasiAgama(source.agama) }, "agama", AGAMA_SAH),
    pekerjaan: teks(source, "pekerjaan", 100),
    pendapatan_bulanan: pilih(source, "pendapatan_bulanan", PENDAPATAN_SAH),
    daya_listrik: pilih(source, "daya_listrik", LISTRIK_SAH),
    ktp: dokumen(source.ktp_path),
    kk: dokumen(source.kk_path),
  };

  if (!/^\d{10,15}$/.test(hasil.no_whatsapp)) throw new RegistrasiAmanError(PESAN_VALIDASI);
  if (!/^\d{6}$/.test(hasil.pin) || PIN_LEMAH.has(hasil.pin)) throw new RegistrasiAmanError(PESAN_VALIDASI);
  if (hasil.kk.jenis === "kosong") throw new RegistrasiAmanError(PESAN_VALIDASI);
  if (!FITUR_KTP_AKTIF && hasil.ktp.jenis === "unggah") throw new RegistrasiAmanError(PESAN_VALIDASI);
  return hasil;
}

function normalisasiAnggota(value: unknown): AnggotaTernormalisasi[] {
  if (!Array.isArray(value) || value.length > MAKS_ANGGOTA) throw new RegistrasiAmanError(PESAN_VALIDASI);
  return value.map((item) => {
    const source = rekaman(item);
    const hubungan = pilih(source, "hubungan_keluarga", HUBUNGAN_SAH);
    const detailMentah = source.hubungan_detail;
    const detail = detailMentah === null || detailMentah === undefined || detailMentah === ""
      ? null
      : teks(source, "hubungan_detail", 100);
    if (hubungan === "Lainnya" && !detail) throw new RegistrasiAmanError(PESAN_VALIDASI);
    if (hubungan !== "Lainnya" && detail) throw new RegistrasiAmanError(PESAN_VALIDASI);

    const hasil: AnggotaTernormalisasi = {
      nik: nik(source, "nik"),
      nama_lengkap: teks(source, "nama_lengkap", 150),
      hubungan_keluarga: hubungan,
      hubungan_detail: detail,
      tanggal_lahir: tanggal(source, "tanggal_lahir"),
      tempat_lahir: teks(source, "tempat_lahir", 100),
      jenis_kelamin: pilih(
        { jenis_kelamin: normalisasiJenisKelamin(source.jenis_kelamin) },
        "jenis_kelamin",
        JENIS_KELAMIN_SAH
      ),
      agama: pilih({ agama: normalisasiAgama(source.agama) }, "agama", AGAMA_SAH),
      pekerjaan: teks(source, "pekerjaan", 100),
      ktp: dokumen(source.ktp_path),
    };
    if (!FITUR_KTP_AKTIF && hasil.ktp.jenis === "unggah") throw new RegistrasiAmanError(PESAN_VALIDASI);
    return hasil;
  });
}

function semuaNikUnik(kepala: KepalaTernormalisasi, anggota: AnggotaTernormalisasi[]) {
  const semua = [kepala.nik, ...anggota.map((item) => item.nik)];
  if (new Set(semua).size !== semua.length) throw new RegistrasiAmanError(PESAN_DUPLIKAT, "duplikat");
  return semua;
}

function jumlahByteDokumen(kepala: KepalaTernormalisasi, anggota: AnggotaTernormalisasi[]) {
  const dokumen = [kepala.ktp, kepala.kk, ...anggota.map((item) => item.ktp)];
  return dokumen.reduce((jumlah, item) => jumlah + (item.jenis === "unggah" ? item.buffer.length : 0), 0);
}

function kodeError(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

async function hapusBerkas(uploadedPaths: string[], supabase: ReturnType<typeof getSupabaseAdminClient>) {
  if (!uploadedPaths.length) return;
  try {
    const { error } = await supabase.storage.from(BUCKET_DOKUMEN).remove(uploadedPaths);
    if (error) console.error("Pembersihan berkas registrasi gagal:", error.message);
  } catch (error) {
    console.error("Pembersihan berkas registrasi melempar exception:", error);
  }
}

async function unggahDokumen(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  dok: DokumenInput,
  pathDasar: string,
  nama: string,
  uploadedPaths: string[]
): Promise<string | null> {
  if (dok.jenis === "kosong") return null;
  if (dok.jenis === "menyusul") return "MENYUSUL";
  const path = `${pathDasar}/${nama}_${uuidv4()}.${dok.ekstensi}`;
  const { data, error } = await supabase.storage.from(BUCKET_DOKUMEN).upload(path, dok.buffer, {
    contentType: dok.contentType,
    upsert: false,
  });
  if (error || !data?.path) {
    throw new Error(pesanSupabase(error, "Upload dokumen gagal: path kosong."));
  }
  uploadedPaths.push(data.path);
  return data.path;
}

export type HasilRegister = {
  success: boolean;
  message: string;
};

/**
 * Server Action for public self-registration.  It deliberately accepts
 * `unknown` instead of trusting a client-side TypeScript shape.
 * Failures are returned as a plain result object: throwing a custom Error
 * subclass across the RSC boundary becomes React #441 in production.
 */
export async function aksiRegister(
  rtIdMasukan: unknown,
  payloadKepala: unknown,
  anggotaPayload: unknown
): Promise<HasilRegister> {
  let supabase: ReturnType<typeof getSupabaseAdminClient> | null = null;
  let wargaId: string | null = null;
  let tiketId: string | null = null;
  const uploadedPaths: string[] = [];

  try {
    const kepala = normalisasiKepala(payloadKepala);
    const anggota = normalisasiAnggota(anggotaPayload);
    const semuaNik = semuaNikUnik(kepala, anggota);
    if (jumlahByteDokumen(kepala, anggota) > MAKS_TOTAL_BYTE_DOKUMEN) {
      throw new RegistrasiAmanError(PESAN_VALIDASI);
    }
    // UUID terikat dari Server Component tetap dicek ulang ke master_rt.
    // Tanpa baris tenant yang sah, INSERT wajib gagal — rt_id tidak boleh NULL.
    const rtId = await rtRegistrasiTerikat(rtIdMasukan);
    supabase = getSupabaseAdminClient();

    // National NIKs are globally unique.  This preflight also gives a clear,
    // non-destructive failure before any document is uploaded.  A database
    // unique constraint must still remain in place to close the final race.
    const [cekWarga, cekAnggota] = await Promise.all([
      supabase.from("warga").select("id").in("nik", semuaNik).limit(1),
      supabase.from("anggota_keluarga").select("id").in("nik", semuaNik).limit(1),
    ]);
    if (cekWarga.error) throw new Error(pesanSupabase(cekWarga.error, PESAN_INTERNAL));
    if (cekAnggota.error) throw new Error(pesanSupabase(cekAnggota.error, PESAN_INTERNAL));
    if ((cekWarga.data?.length || 0) > 0 || (cekAnggota.data?.length || 0) > 0) {
      throw new RegistrasiAmanError(PESAN_DUPLIKAT, "duplikat");
    }

    const registrationId = uuidv4();
    const pathDasar = `registrasi/${rtId}/${registrationId}`;
    const safeKtpPath = await unggahDokumen(supabase, kepala.ktp, pathDasar, "KTP_KK", uploadedPaths);
    const safeKkPath = await unggahDokumen(supabase, kepala.kk, pathDasar, "KK_UTAMA", uploadedPaths);
    const hashedPin = await bcrypt.hash(kepala.pin, 10);

    const { data: wargaBaru, error: errWarga } = await supabase
      .from("warga")
      .insert([{
        nik: kepala.nik,
        nama_lengkap: kepala.nama_lengkap,
        no_whatsapp: kepala.no_whatsapp,
        pin: hashedPin,
        status_tinggal: kepala.status_tinggal,
        detail_alamat: kepala.detail_alamat,
        tanggal_lahir: kepala.tanggal_lahir,
        tempat_lahir: kepala.tempat_lahir,
        jenis_kelamin: kepala.jenis_kelamin,
        agama: kepala.agama,
        pekerjaan: kepala.pekerjaan,
        pendapatan_bulanan: kepala.pendapatan_bulanan,
        daya_listrik: kepala.daya_listrik,
        ktp_path: safeKtpPath,
        kk_path: safeKkPath,
        status_verifikasi: "Menunggu",
        rt_id: rtId,
      }])
      .select("id")
      .single();

    if (errWarga) {
      if (kodeError(errWarga) === "23505") throw new RegistrasiAmanError(PESAN_DUPLIKAT, "duplikat");
      throw new Error(pesanSupabase(errWarga, "Insert warga gagal."));
    }
    if (!wargaBaru?.id) {
      throw new Error("Insert warga gagal: Supabase tidak mengembalikan id dan tidak mengembalikan error.");
    }
    wargaId = String(wargaBaru.id);

    if (anggota.length > 0) {
      const anggotaToInsert = [];
      for (const [index, item] of anggota.entries()) {
        const safePath = await unggahDokumen(
          supabase,
          item.ktp,
          pathDasar,
          `KTP_ANGGOTA_${index + 1}`,
          uploadedPaths
        );
        anggotaToInsert.push({
          warga_id: wargaId,
          rt_id: rtId,
          nama_lengkap: item.nama_lengkap,
          nik: item.nik,
          hubungan_keluarga: item.hubungan_keluarga,
          hubungan_detail: item.hubungan_detail,
          tanggal_lahir: item.tanggal_lahir,
          tempat_lahir: item.tempat_lahir,
          jenis_kelamin: item.jenis_kelamin,
          agama: item.agama,
          pekerjaan: item.pekerjaan,
          ktp_path: safePath,
        });
      }

      const { error: errAnggota } = await supabase.from("anggota_keluarga").insert(anggotaToInsert);
      if (errAnggota) {
        if (kodeError(errAnggota) === "23505") throw new RegistrasiAmanError(PESAN_DUPLIKAT, "duplikat");
        throw new Error(pesanSupabase(errAnggota, "Insert anggota keluarga gagal."));
      }
    }

    const { data: tiketBaru, error: errTiket } = await supabase
      .from("laporan_warga")
      .insert([{
        warga_id: wargaId,
        rt_id: rtId,
        judul_laporan: JUDUL_TIKET_PENDAFTARAN,
        deskripsi: `Lapor diri mandiri menunggu verifikasi pengurus. Jumlah anggota keluarga tercatat: ${anggota.length}.`,
        status: "Menunggu",
      }])
      .select("id")
      .single();

    if (errTiket) {
      throw new Error(pesanSupabase(errTiket, "Insert tiket verifikasi gagal."));
    }
    if (!tiketBaru?.id) {
      throw new Error("Insert tiket verifikasi gagal: Supabase tidak mengembalikan id dan tidak mengembalikan error.");
    }
    tiketId = String(tiketBaru.id);

    return { success: true, message: "SUKSES" };
  } catch (error: unknown) {
    // Compensating cleanup is deliberately scoped to the UUID generated in
    // this invocation.  It cannot delete another registrant's row or file.
    if (supabase && tiketId) {
      const { error: errTiket } = await supabase.from("laporan_warga").delete().eq("id", tiketId);
      if (errTiket) console.error("Rollback tiket registrasi gagal:", errTiket.message);
    }
    if (supabase && wargaId) {
      const { error: errAnggota } = await supabase.from("anggota_keluarga").delete().eq("warga_id", wargaId);
      if (errAnggota) console.error("Rollback anggota registrasi gagal:", errAnggota.message);
      const { error: errWarga } = await supabase.from("warga").delete().eq("id", wargaId);
      if (errWarga) console.error("Rollback kepala registrasi gagal:", errWarga.message);
    }
    if (supabase) await hapusBerkas(uploadedPaths, supabase);

    const pesan = error instanceof RegistrasiAmanError
      ? error.message
      : error instanceof Error
        ? error.message
        : PESAN_INTERNAL;

    if (!(error instanceof RegistrasiAmanError)) {
      console.error("Registrasi warga gagal:", error instanceof Error ? error.message : error);
    }
    return {
      success: false,
      message: pesan,
    };
  }
}
