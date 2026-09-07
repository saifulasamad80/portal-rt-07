import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";

import { POLA_UUID } from "@/lib/uuid-tenant";

function wajibEnv(nama: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_ROLE_KEY") {
  const nilai = process.env[nama];
  if (!nilai) throw new Error(`Variabel lingkungan ${nama} belum diatur.`);
  return nilai;
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

export async function buatKlienTerautentikasi(sesi: IdentitasSesiData): Promise<SupabaseClient> {
  const id = String(sesi?.id || "");
  const rtId = String(sesi?.rtId || "");

  if (!POLA_UUID.test(id) || !POLA_UUID.test(rtId)) {
    throw new Error("Sesi tidak valid untuk klien data terautentikasi.");
  }

  const rawSecret = process.env.SUPABASE_JWT_SECRET;
  
  if (!rawSecret) {
    throw new Error("CRITICAL: JWT Secret Kosong! Bypass RLS ditolak secara paksa.");
  }

  const urlProyek = wajibEnv("NEXT_PUBLIC_SUPABASE_URL");
  
  try {
    // Rollback ke Kriptografi Simetris (HS256) menyesuaikan Legacy Secret Supabase
    const secretKey = new TextEncoder().encode(rawSecret);

    const tokenData = await new SignJWT({
      role: "authenticated",
      aud: "authenticated",
      rt_id: rtId,
      app_role: kastaAplikasiDariSesi(sesi),
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(id)
      .setIssuer(penerbitJwtAuth(urlProyek))
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(secretKey);

    return createClient(urlProyek, wajibEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${tokenData}`
        }
      },
      accessToken: async () => tokenData,
    });
  } catch (err) {
    console.error("Gagal meracik JWT HS256:", err);
    throw new Error("Gagal mengautentikasi klien database.");
  }
}

export function getSupabaseAdminClientDariSesi(sesi: IdentitasSesiPrivileged): SupabaseClient {
  const id = String(sesi?.id || "");
  const rtId = String(sesi?.rtId || "");

  if (!POLA_UUID.test(id) || !POLA_UUID.test(rtId)) {
    throw new Error("Sesi tidak valid untuk operasi privileged.");
  }

  return getSupabaseAdminClient();
}

export function getSupabaseAdminClient() {
  return createClient(wajibEnv("NEXT_PUBLIC_SUPABASE_URL"), wajibEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}// Validasi Keamanan: Delegasi fungsi kunciJwtProyekSupabase di-bypass langsung ke TextEncoder untuk sinkronisasi Legacy Secret Supabase.
export function kunciJwtProyekSupabase() { return new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET || ''); }
