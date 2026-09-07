import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let klienAnonimBrowser: SupabaseClient | null = null;

function wajibEnvPublik(nama: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  const nilai = process.env[nama];
  if (!nilai) {
    throw new Error(`Variabel lingkungan ${nama} belum diatur.`);
  }
  return nilai;
}

/**
 * Klien browser berhak anon key saja. Tidak menahan sesi di localStorage,
 * tidak me-refresh token Auth, dan menolak dipanggil dari server
 * (pakai getSupabaseServerClient / buatKlienTerautentikasi).
 */
export function buatKlienSupabaseAnonimBrowser(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error(
      "Klien anonim browser tidak boleh dipakai di server. Gunakan getSupabaseServerClient()."
    );
  }

  if (klienAnonimBrowser) return klienAnonimBrowser;

  klienAnonimBrowser = createClient(wajibEnvPublik("NEXT_PUBLIC_SUPABASE_URL"), wajibEnvPublik("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return klienAnonimBrowser;
}
