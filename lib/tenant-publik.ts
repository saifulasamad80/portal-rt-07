import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase-server";
import { UUID_SENTINEL, uuidTenantSah } from "@/lib/uuid-tenant";

/**
 * Tenant landing/etalase hanya dari PUBLIC_RT_ID di server.
 * UUID tidak sah → sentinel; pemanggil wajib fail-closed, bukan query global.
 */
export function resolveTenantPublik(): string {
  const nilai = process.env.PUBLIC_RT_ID?.trim() || "";
  const sah = uuidTenantSah(nilai);
  if (sah) return sah;
  if (nilai) {
    console.error("PUBLIC_RT_ID tidak berbentuk UUID yang sah; portal publik fail-closed ke tenant kosong.");
  }
  return UUID_SENTINEL;
}

/**
 * Klien data untuk SSR publik.
 *
 * Tenant sah memakai service_role: RLS anon sengaja fail-closed (etalase H1,
 * kunjungan Posyandu RESTRICTIVE, warga/kas tanpa policy anon). Setiap kueri
 * pemanggil wajib .eq tenant. Tenant tidak sah memakai klien anon agar kueri
 * tanpa filter tidak bisa dump lintas-RT.
 */
export function klienDanTenantPublik(): { supabase: SupabaseClient; tenant: string } {
  const tenant = resolveTenantPublik();
  if (tenant === UUID_SENTINEL) {
    return { supabase: getSupabaseServerClient(), tenant };
  }
  return { supabase: getSupabaseAdminClient(), tenant };
}
