import "server-only";

import { createHash, randomBytes } from "node:crypto";

export const PANJANG_MINIMUM_SANDI_ADMIN = 8;
export const BATAS_BYTE_SANDI_BCRYPT = 72;
export const MASA_BERLAKU_TOKEN_RESET_MS = 60 * 60 * 1000;
// Mencegah permintaan reset berulang mengganti token tanpa batas. Pengiriman
// ulang tetap dimungkinkan setelah jeda ini bila email pertama tidak sampai.
export const JEDA_PERMINTAAN_RESET_MS = 15 * 60 * 1000;

const POLA_TOKEN_RESET = /^[0-9a-f]{64}$/i;
const POLA_EMAIL_SEDERHANA = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POLA_KARAKTER_KONTROL = /[\u0000-\u001f\u007f]/;

export type TokenResetBaru = {
  token: string;
  digest: string;
  kedaluwarsa: string;
};

/**
 * Token yang dikirim melalui email memiliki entropi 256 bit. Database hanya
 * menyimpan digest-nya, sehingga salinan database tidak langsung menjadi
 * kumpulan tautan reset yang siap dipakai.
 */
export function buatTokenReset(): TokenResetBaru {
  const token = randomBytes(32).toString("hex");

  return {
    token,
    digest: digestTokenReset(token),
    kedaluwarsa: new Date(Date.now() + MASA_BERLAKU_TOKEN_RESET_MS).toISOString(),
  };
}

export function normalisasiTokenReset(nilai: unknown): string | null {
  if (typeof nilai !== "string" || !POLA_TOKEN_RESET.test(nilai)) return null;
  return nilai.toLowerCase();
}

export function digestTokenReset(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function normalisasiEmailReset(nilai: unknown): string | null {
  if (typeof nilai !== "string") return null;

  const email = nilai.trim().toLowerCase();
  if (!email || email.length > 254 || POLA_KARAKTER_KONTROL.test(email)) return null;
  return POLA_EMAIL_SEDERHANA.test(email) ? email : null;
}

export function sandiAdminResetValid(nilai: unknown): nilai is string {
  if (
    typeof nilai !== "string" ||
    nilai.length < PANJANG_MINIMUM_SANDI_ADMIN ||
    POLA_KARAKTER_KONTROL.test(nilai)
  ) {
    return false;
  }

  // bcrypt hanya membandingkan 72 byte pertama. Menolak input yang lebih
  // panjang mencegah dua sandi berbeda terlihat seolah-olah identik.
  return new TextEncoder().encode(nilai).byteLength <= BATAS_BYTE_SANDI_BCRYPT;
}

/**
 * Origin tautan reset hanya boleh berasal dari konfigurasi server. Host dan
 * X-Forwarded-Host adalah input request dan tidak boleh dipercaya untuk email.
 */
export function dapatkanBaseUrlReset(): URL | null {
  const konfigurasi = process.env.RESET_BASE_URL?.trim();

  if (!konfigurasi) {
    // Fallback ini hanya untuk pengembangan lokal. Produksi wajib fail closed.
    return process.env.NODE_ENV === "production"
      ? null
      : new URL("http://localhost:3000/");
  }

  try {
    const url = new URL(konfigurasi);
    const hostLokal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const protokolValid =
      url.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" && hostLokal && url.protocol === "http:");

    if (
      !protokolValid ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export function buatTautanReset(baseUrl: URL, token: string): string {
  const url = new URL("/admin/reset-sandi", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function escapeHtml(nilai: unknown): string {
  return String(nilai ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Jangan log object error utuh: SMTP/PostgREST dapat memuat alamat penerima. */
export function kodeErrorAman(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code ?? "unknown").slice(0, 80);
  }
  return error instanceof Error ? error.name : "unknown";
}
