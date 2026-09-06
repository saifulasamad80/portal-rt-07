import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SignJWT, importPKCS8 } from "jose";

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function wajibEnv(nama: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_ROLE_KEY") {
  const nilai = process.env[nama];
  if (!nilai) throw new Error(`Variabel lingkungan ${nama} belum diatur.`);
  return nilai;
}

/**
 * Private key PKCS8 proyek Supabase (Settings → API), bukan JWT_SECRET cookie
 * aplikasi. Mencampur keduanya membuat PostgREST membalas 401, supabase-js
 * mengembalikan count null, dan dasbor menampilkan 0 KK meskipun datanya ada.
 */
async function kunciJwtProyekSupabase() {
  const nilai = process.env.SUPABASE_JWT_SECRET;
  if (!nilai) {
    return null;
  }
  return importPKCS8(nilai, "ES256");
}

function penerbitJwtAuth(urlProyek: string): string {
  return new URL("/auth/v1", urlProyek).toString().replace(/\/$/, "");
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
 * Klien data setelah sesi direvalidasi di database.
 *
 * Jalur RLS: hanya jika SUPABASE_JWT_SECRET (private key PKCS8 proyek) diisi.
 * Token merdeka dari cookie: `sub` dari sesi, `role` dipaksa
 * `authenticated` (role Postgres, bukan kasta pengurus), plus `rt_id`
 * dan `app_role`. `iss` meniru access token GoTrue. `accessToken` wajib
 * agar supabase-js tidak menimpa Authorization dengan kunci API.
 *
 * Cadangan: tanpa JWT secret proyek, PostgREST menolak token buatan
 * JWT_SECRET aplikasi (401). Klien privileged dipakai setelah UUID sesi
 * valid; pemanggil tetap wajib menyaring `rt_id`.
 */
export async function buatKlienTerautentikasi(sesi: IdentitasSesiData): Promise<SupabaseClient> {
  const id = String(sesi?.id || "");
  const rtId = String(sesi?.rtId || "");
  if (!POLA_UUID.test(id) || !POLA_UUID.test(rtId)) {
    throw new Error("Sesi tidak valid untuk klien data terautentikasi.");
  }

  const kunciProyek = await kunciJwtProyekSupabase();
  if (!kunciProyek) {
    return getSupabaseAdminClientDariSesi(sesi);
  }

  const urlProyek = wajibEnv("NEXT_PUBLIC_SUPABASE_URL");
  const tokenData = await new SignJWT({
    role: "authenticated",
    aud: "authenticated",
    rt_id: rtId,
    app_role: kastaAplikasiDariSesi(sesi),
  })
    .setProtectedHeader({ alg: "ES256" })
    .setSubject(id)
    .setIssuer(penerbitJwtAuth(urlProyek))
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(kunciProyek);

  return createClient(urlProyek, wajibEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
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
