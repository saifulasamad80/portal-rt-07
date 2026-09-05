import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PANJANG_MINIMUM_SECRET = 32;

function wajibEnv(nama: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_ROLE_KEY") {
  const nilai = process.env[nama];
  if (!nilai) throw new Error(`Variabel lingkungan ${nama} belum diatur.`);
  return nilai;
}

/**
 * PostgREST hanya menerima JWT yang ditandatangani JWT secret proyek
 * (sama dengan JWT_SECRET aplikasi untuk token warga). Kunci turunan
 * cookie admin_session sengaja tidak dipakai di sini.
 */
function kunciJwtPostgrest(): Uint8Array {
  const nilai = process.env.JWT_SECRET;
  if (!nilai || new TextEncoder().encode(nilai).byteLength < PANJANG_MINIMUM_SECRET) {
    throw new Error("JWT_SECRET wajib berisi minimal 32 byte.");
  }
  return new TextEncoder().encode(nilai);
}

type IdentitasSesiData = {
  id: string;
  rtId: string;
  role?: string;
};

type IdentitasSesiPrivileged = {
  id: string;
  rtId: string;
};

type KastaAplikasi = "warga" | "rt" | "webmaster";

function kastaAplikasiDariSesi(sesi: IdentitasSesiData): KastaAplikasi {
  return sesi.role === "webmaster" || sesi.role === "rt" ? sesi.role : "warga";
}

/**
 * Klien data untuk operasi reguler. Token ini merdeka dari cookie sesi:
 * `sub` diambil dari sesi yang sudah direvalidasi di database, `role`
 * dipaksa `authenticated` agar PostgREST SET ROLE ke role Postgres yang
 * punya policy RLS. Klaim `rt_id` dan `app_role` ikut di payload agar
 * `auth.jwt()` di Postgres membaca tenant yang sama. Jangan pernah
 * menyalin kasta pengurus (rt/webmaster) ke klaim `role` — itu bukan
 * role Postgres.
 *
 * `accessToken` wajib: supabase-js menimpa header Authorization dengan
 * anon key pada setiap request jika opsi ini kosong, sehingga database
 * melihat role `anon` dan semua policy `TO authenticated` mengembalikan 0 baris.
 */
export async function buatKlienTerautentikasi(sesi: IdentitasSesiData): Promise<SupabaseClient> {
  const id = String(sesi?.id || "");
  const rtId = String(sesi?.rtId || "");
  if (!POLA_UUID.test(id) || !POLA_UUID.test(rtId)) {
    throw new Error("Sesi tidak valid untuk klien data terautentikasi.");
  }

  const tokenData = await new SignJWT({
    role: "authenticated",
    aud: "authenticated",
    rt_id: rtId,
    app_role: kastaAplikasiDariSesi(sesi),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(kunciJwtPostgrest());

  return createClient(wajibEnv("NEXT_PUBLIC_SUPABASE_URL"), wajibEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    accessToken: async () => tokenData,
  });
}

/**
 * Bypass RLS. Hanya untuk login/registrasi/cron/webhook, RPC yang
 * EXECUTE-nya memang dikunci ke service_role, storage signed URL, atau
 * penghapusan multi-tabel. Pemanggil wajib sudah memegang sesi
 * terverifikasi; `rtId` tidak boleh berasal dari payload klien.
 */
export function getSupabaseAdminClientDariSesi(sesi: IdentitasSesiPrivileged): SupabaseClient {
  const id = String(sesi?.id || "");
  const rtId = String(sesi?.rtId || "");
  if (!POLA_UUID.test(id) || !POLA_UUID.test(rtId)) {
    throw new Error("Sesi tidak valid untuk operasi privileged.");
  }
  return getSupabaseAdminClient();
}

/**
 * Bypass RLS tanpa sesi. Hanya jalur yang memang belum punya JWT:
 * login, registrasi publik, pemulihan sandi, dan cron/webhook.
 */
export function getSupabaseAdminClient() {
  return createClient(wajibEnv("NEXT_PUBLIC_SUPABASE_URL"), wajibEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
