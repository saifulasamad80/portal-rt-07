import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Konfigurasi Environment Variables
 * Pastikan JWT_SECRET di .env sama dengan JWT Secret di pengaturan Supabase Anda
 * agar PostgREST dapat membaca payload token secara native.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Menginisialisasi Supabase Client untuk Server Components / Server Actions.
 * Klien ini secara otomatis mengambil token JWT dari cookies dan menyematkannya
 * ke dalam header Authorization. Ini memastikan Row Level Security (RLS) di 
 * PostgreSQL berjalan dengan aman tanpa menggunakan Service Role Key.
 * 
 * @param role - "warga" atau "admin" untuk menentukan cookie mana yang dibaca
 * @returns Supabase Client instance yang aman
 */
export async function getSupabaseServerClient(role: "warga" | "admin" = "warga") {
  const cookieStore = await cookies();
  const tokenName = role === "warga" ? "warga_session" : "admin_session";
  const token = cookieStore.get(tokenName)?.value;

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false, // Tidak perlu persistensi karena kita pakai HTTP-Only Cookies
    },
    global: {
      headers: {
        // Menyuntikkan token agar RLS Supabase mengenali user yang sedang login
        Authorization: token ? `Bearer ${token}` : "",
      },
    },
  });
}

/**
 * Klien Admin (Bypass RLS).
 * HANYA GUNAKAN INI UNTUK OPERASI KRITIS (seperti registrasi awal atau webhook)
 * di mana user belum memiliki token, atau admin perlu akses lintas-tenant.
 */
export function getSupabaseAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}