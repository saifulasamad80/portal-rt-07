import "server-only";

import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { jwtVerify, type JWTPayload } from "jose";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { KLAIM_VERSI_SESI, sesiVersiMasihHidup } from "@/lib/versi-sesi";

export const SESSION_ISSUER = "aplikasi-rt";
export const SESSION_AUDIENCE_WARGA = "portal-warga";
export const SESSION_AUDIENCE_ADMIN = "portal-admin";

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PANJANG_MINIMUM_SECRET = 32;

type JenisSesi = "warga" | "admin";

export type WargaTerautentikasi = {
  id: string;
  nik: string;
  nama: string;
  rtId: string;
};

export type PengurusTerautentikasi = {
  id: string;
  nama: string;
  role: "rt" | "webmaster";
  rtId: string;
};

export type WargaDalamCakupanAdmin = {
  id: string;
  nik: string;
  nama: string;
  rtId: string;
};

type HasilAutentikasi<T> =
  | { ok: true; sesi: T }
  | { ok: false; message: string };

type ErrorSupabaseLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

type WargaSesiRow = {
  id: string;
  nik: string | null;
  nama_lengkap: string | null;
  rt_id: string | null;
  status_verifikasi: string | null;
  status_aktif?: boolean | null;
  terkunci_sampai?: string | null;
  session_version?: number | null;
};

function sesiMasihTerkunci(nilai: unknown): boolean {
  if (typeof nilai !== "string" || !nilai) return false;
  const batas = new Date(nilai);
  return !Number.isNaN(batas.getTime()) && batas.getTime() > Date.now();
}

/**
 * Hanya error "kolom status_aktif belum ada" yang boleh mengaktifkan jalur
 * kompatibilitas. Error jaringan, RLS, timeout, atau kegagalan query lain
 * wajib tetap memblokir sesi; jika tidak, outage database dapat berubah
 * menjadi bypass autentikasi.
 */
function kolomTidakTersedia(error: unknown, namaKolom: string): boolean {
  if (!error || typeof error !== "object" || !namaKolom) return false;

  const kandidat = error as ErrorSupabaseLike;
  const kode = String(kandidat.code ?? "").toUpperCase();
  const teks = [kandidat.message, kandidat.details, kandidat.hint]
    .filter((nilai) => typeof nilai === "string")
    .join(" ")
    .toLowerCase();
  const kolom = namaKolom.toLowerCase();

  // Kode undefined_column/schema-cache saja belum cukup: pastikan kolom yang
  // hilang memang yang dimaksud, bukan kolom identitas lain.
  if (!teks.includes(kolom)) return false;
  if (kode === "42703" || kode === "PGRST204") return true;

  const polaHilang = new RegExp(
    `${kolom}[\\s\\S]*(does not exist|not found|schema cache)`,
    "i"
  );
  const polaCache = new RegExp(
    `could not find[\\s\\S]*${kolom}[\\s\\S]*column`,
    "i"
  );
  return polaHilang.test(teks) || polaCache.test(teks);
}

export function statusAktifTidakTersedia(error: unknown): boolean {
  return kolomTidakTersedia(error, "status_aktif");
}

export function sessionVersionTidakTersedia(error: unknown): boolean {
  return kolomTidakTersedia(error, "session_version");
}

const USIA_MAKS_TOKEN: Record<JenisSesi, string> = {
  warga: "7d",
  admin: "2h",
};

/** Token-use + issuer + audience wajib, sehingga nama cookie bukan boundary. */
export function ambilKunciSesi(jenis: JenisSesi): Uint8Array {
  const nilai = process.env.JWT_SECRET;

  if (!nilai || new TextEncoder().encode(nilai).byteLength < PANJANG_MINIMUM_SECRET) {
    throw new Error("JWT_SECRET wajib berisi minimal 32 byte.");
  }

  const kunciUtama = new TextEncoder().encode(nilai);

  // Token warga tetap memakai kunci utama agar rotasi boundary tidak
  // mengubah material kuncinya. Klaim issuer/audience/token_use/umur tetap
  // wajib, sehingga token legacy yang tidak memenuhi kontrak baru ditolak.
  // Token admin dipisahkan secara kriptografis: verifier lama yang hanya
  // mengecek JWT_SECRET tidak lagi dapat menerima token warga yang dipindahkan
  // ke cookie admin_session.
  if (jenis === "warga") return kunciUtama;

  return new Uint8Array(
    createHmac("sha256", kunciUtama)
      .update("aplikasi-rt:admin-session:v1")
      .digest()
  );
}

async function verifikasiToken(token: string, jenis: JenisSesi): Promise<JWTPayload> {
  const audience = jenis === "warga" ? SESSION_AUDIENCE_WARGA : SESSION_AUDIENCE_ADMIN;
  const { payload } = await jwtVerify(token, ambilKunciSesi(jenis), {
    algorithms: ["HS256"],
    issuer: SESSION_ISSUER,
    audience,
    // Jangan menerima token buatan lama/terpotong yang kebetulan masih
    // memiliki tanda tangan valid tetapi tidak punya masa berlaku.
    requiredClaims: ["exp", "iat", "sub", "iss", "aud"],
    maxTokenAge: USIA_MAKS_TOKEN[jenis],
  });

  if (
    payload.token_use !== jenis ||
    typeof payload.sub !== "string" ||
    !POLA_UUID.test(payload.sub)
  ) {
    throw new Error("Jenis atau subjek sesi tidak sah.");
  }

  return payload;
}

export async function otentikasiWargaAktif(): Promise<HasilAutentikasi<WargaTerautentikasi>> {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;
  if (!token) {
    return { ok: false, message: "Sesi warga tidak ada atau telah berakhir. Silakan masuk kembali." };
  }

  let payload: JWTPayload;
  try {
    payload = await verifikasiToken(token, "warga");
  } catch (error) {
    console.error("Verifikasi sesi warga ditolak:", error instanceof Error ? error.message : error);
    return { ok: false, message: "Sesi warga tidak valid. Silakan masuk kembali." };
  }

  const supabase = getSupabaseAdminClient();
  const idSesi = payload.sub;
  let statusAktifTersedia = true;
  let versiSesiTersedia = true;
  let warga: WargaSesiRow | null = null;
  let error: ErrorSupabaseLike | null = null;

  const ambilWargaSesi = (opsi: { statusAktif: boolean; sessionVersion: boolean }) => {
    const kolom = ["id", "nik", "nama_lengkap", "rt_id", "status_verifikasi", "terkunci_sampai"];
    if (opsi.statusAktif) kolom.push("status_aktif");
    if (opsi.sessionVersion) kolom.push("session_version");
    return supabase.from("warga").select(kolom.join(", ")).eq("id", idSesi).maybeSingle();
  };

  let hasilWarga = await ambilWargaSesi({ statusAktif: true, sessionVersion: true });
  warga = hasilWarga.data as WargaSesiRow | null;
  error = hasilWarga.error;

  if (sessionVersionTidakTersedia(error) || statusAktifTidakTersedia(error)) {
    // Instalasi lama boleh kehilangan salah satu kolom opsional, tetapi
    // kegagalan query yang lain tetap fail-closed.
    versiSesiTersedia = !sessionVersionTidakTersedia(error);
    if (statusAktifTidakTersedia(error)) {
      // Pada skema tanpa soft-delete, status_verifikasi=Ditolak adalah
      // satu-satunya sinyal pencabutan akses.
      statusAktifTersedia = false;
    }
    hasilWarga = await ambilWargaSesi({
      statusAktif: statusAktifTersedia,
      sessionVersion: versiSesiTersedia,
    });
    warga = hasilWarga.data as WargaSesiRow | null;
    error = hasilWarga.error;
  }

  if (sessionVersionTidakTersedia(error)) {
    versiSesiTersedia = false;
    hasilWarga = await ambilWargaSesi({
      statusAktif: statusAktifTersedia,
      sessionVersion: false,
    });
    warga = hasilWarga.data as WargaSesiRow | null;
    error = hasilWarga.error;
  }

  if (statusAktifTidakTersedia(error)) {
    statusAktifTersedia = false;
    hasilWarga = await ambilWargaSesi({
      statusAktif: false,
      sessionVersion: versiSesiTersedia,
    });
    warga = hasilWarga.data as WargaSesiRow | null;
    error = hasilWarga.error;
  }

  if (error) {
    console.error("Revalidasi sesi warga gagal:", error.message);
    return { ok: false, message: "Sesi warga belum dapat diverifikasi. Silakan masuk kembali." };
  }
  if (!warga) {
    return { ok: false, message: "Akun warga tidak ditemukan atau sudah dinonaktifkan." };
  }
  if (
    warga.status_verifikasi !== "Disetujui" ||
    (statusAktifTersedia && warga.status_aktif !== true)
  ) {
    return { ok: false, message: "Akun warga tidak aktif atau belum disetujui pengurus RT." };
  }
  if (sesiMasihTerkunci(warga.terkunci_sampai)) {
    return { ok: false, message: "Akun warga sedang dikunci. Silakan masuk kembali nanti." };
  }
  if (
    versiSesiTersedia &&
    !sesiVersiMasihHidup(payload[KLAIM_VERSI_SESI], warga.session_version)
  ) {
    return { ok: false, message: "Sesi warga sudah dicabut. Silakan masuk kembali." };
  }

  const rtId = String(warga.rt_id || "");
  const nik = String(warga.nik || "");
  if (!POLA_UUID.test(rtId) || !/^\d{16}$/.test(nik)) {
    return { ok: false, message: "Identitas atau wilayah akun warga belum valid. Hubungi pengurus RT." };
  }

  return {
    ok: true,
    sesi: {
      id: String(warga.id),
      nik,
      nama: String(warga.nama_lengkap || "warga"),
      rtId,
    },
  };
}

export async function wajibOtentikasiWarga(): Promise<WargaTerautentikasi> {
  const hasil = await otentikasiWargaAktif();
  if (!hasil.ok) throw new Error(hasil.message);
  return hasil.sesi;
}

/** DTO kompatibel dengan komponen lama tanpa meneruskan JWT claims mentah. */
export function wargaUntukKlien(sesi: WargaTerautentikasi) {
  return { id: sesi.id, sub: sesi.id, nik: sesi.nik, nama: sesi.nama, rt_id: sesi.rtId };
}

export async function otentikasiAdminAktif(): Promise<HasilAutentikasi<PengurusTerautentikasi>> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) {
    return { ok: false, message: "Sesi pengurus tidak ada atau telah berakhir. Silakan masuk kembali." };
  }

  let payload: JWTPayload;
  try {
    payload = await verifikasiToken(token, "admin");
  } catch (error) {
    console.error("Verifikasi sesi pengurus ditolak:", error instanceof Error ? error.message : error);
    return { ok: false, message: "Sesi pengurus tidak valid. Silakan masuk kembali." };
  }

  const supabase = getSupabaseAdminClient();
  let versiSesiTersedia = true;
  let hasilPengurus = await supabase
    .from("pengurus_rt")
    .select("id, nama_lengkap, rt_id, level, terkunci_sampai, session_version")
    .eq("id", payload.sub as string)
    .maybeSingle();

  if (sessionVersionTidakTersedia(hasilPengurus.error)) {
    versiSesiTersedia = false;
    hasilPengurus = await supabase
      .from("pengurus_rt")
      .select("id, nama_lengkap, rt_id, level, terkunci_sampai")
      .eq("id", payload.sub as string)
      .maybeSingle();
  }

  const { data: pengurus, error } = hasilPengurus;

  if (error) {
    console.error("Revalidasi sesi pengurus gagal:", error.message);
    return { ok: false, message: "Sesi pengurus belum dapat diverifikasi. Silakan masuk kembali." };
  }
  if (!pengurus) {
    return { ok: false, message: "Akun pengurus tidak ditemukan atau sudah dicabut." };
  }
  if (sesiMasihTerkunci(pengurus.terkunci_sampai)) {
    return { ok: false, message: "Akun pengurus sedang dikunci. Silakan masuk kembali nanti." };
  }
  if (
    versiSesiTersedia &&
    !sesiVersiMasihHidup(
      payload[KLAIM_VERSI_SESI],
      (pengurus as { session_version?: number | null }).session_version
    )
  ) {
    return { ok: false, message: "Sesi pengurus sudah dicabut. Silakan masuk kembali." };
  }

  const rtId = String(pengurus.rt_id || "");
  if (!POLA_UUID.test(rtId)) {
    return { ok: false, message: "Wilayah akun pengurus belum valid." };
  }

  return {
    ok: true,
    sesi: {
      id: String(pengurus.id),
      nama: String(pengurus.nama_lengkap || "pengurus"),
      role: pengurus.level === "webmaster" ? "webmaster" : "rt",
      rtId,
    },
  };
}

/**
 * Bentuk exception dipakai oleh Server Action lama yang memang sudah
 * menggunakan try/catch. Jangan gunakan cookie/claim sebagai identitas;
 * fungsi ini selalu melewati verifier + revalidasi database di atas.
 */
export async function wajibOtentikasiAdmin(): Promise<PengurusTerautentikasi> {
  const hasil = await otentikasiAdminAktif();
  if (!hasil.ok) throw new Error(hasil.message);
  return hasil.sesi;
}

export async function wajibWebmaster(): Promise<PengurusTerautentikasi> {
  const sesi = await wajibOtentikasiAdmin();
  if (sesi.role !== "webmaster") throw new Error("Akses membutuhkan otorisasi webmaster.");
  return sesi;
}

/** DTO aman untuk Client Component; tidak pernah meneruskan JWT/claim mentah. */
export function adminUntukKlien(sesi: PengurusTerautentikasi) {
  return { id: sesi.id, nama: sesi.nama, role: sesi.role, rt_id: sesi.rtId };
}

export function adminBolehMengaksesRt(sesi: PengurusTerautentikasi, rtIdTarget: unknown) {
  return sesi.role === "webmaster" || sesi.rtId === String(rtIdTarget || "");
}

export type WilayahMutasiWarga =
  | { ok: true; rtIdSaring: string | null; rtIdTulis: string }
  | { ok: false; message: string };

/**
 * Filter `.eq("rt_id", "")` ditolak Postgres (uuid). Baris warisan tanpa
 * tenant disaring dengan IS NULL, lalu diikat ke wilayah pengurus yang sah
 * agar reset PIN / ubah status tidak meledak dan akun bisa masuk portal.
 */
export function wilayahMutasiWarga(
  sesi: PengurusTerautentikasi,
  rtIdWarga: unknown
): WilayahMutasiWarga {
  const milik = String(rtIdWarga || "").trim();
  if (POLA_UUID.test(milik)) {
    if (!adminBolehMengaksesRt(sesi, milik)) {
      return { ok: false, message: "Akses lintas RT ditolak." };
    }
    return { ok: true, rtIdSaring: milik, rtIdTulis: milik };
  }
  if (!POLA_UUID.test(sesi.rtId)) {
    return { ok: false, message: "Wilayah akun pengurus belum valid." };
  }
  return { ok: true, rtIdSaring: null, rtIdTulis: sesi.rtId };
}

type PenyaringWarga = {
  eq: (kolom: string, nilai: string) => PenyaringWarga;
  is: (kolom: string, nilai: null) => PenyaringWarga;
};

export function saringWargaTerotorisasi<T extends PenyaringWarga>(
  query: T,
  target: { id: string; nik: string },
  rtIdSaring: string | null
): T {
  const dasar = query.eq("id", target.id).eq("nik", target.nik) as T;
  return (rtIdSaring ? dasar.eq("rt_id", rtIdSaring) : dasar.is("rt_id", null)) as T;
}

export async function otorisasiWargaUntukAdmin(
  supabase: SupabaseClient,
  sesi: PengurusTerautentikasi,
  wargaId: string
): Promise<HasilAutentikasi<WargaDalamCakupanAdmin>> {
  if (!POLA_UUID.test(wargaId)) return { ok: false, message: "ID warga tidak valid." };

  const { data, error } = await supabase
    .from("warga")
    .select("id, nik, nama_lengkap, rt_id")
    .eq("id", wargaId)
    .maybeSingle();

  if (error) {
    console.error("Otorisasi target warga gagal:", error.message);
    return { ok: false, message: "Data warga belum dapat diverifikasi." };
  }
  if (!data) return { ok: false, message: "Data warga sudah tidak ada." };
  if (!adminBolehMengaksesRt(sesi, data.rt_id)) {
    return { ok: false, message: "Akses lintas RT ditolak." };
  }

  return {
    ok: true,
    sesi: {
      id: String(data.id),
      nik: String(data.nik || ""),
      nama: String(data.nama_lengkap || "warga"),
      rtId: String(data.rt_id || ""),
    },
  };
}
