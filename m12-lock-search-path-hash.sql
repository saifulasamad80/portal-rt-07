-- M12: Kunci search_path fungsi public.hash_password_pengurus()
-- Temuan advisor: function_search_path_mutable (search_path tidak dikunci).
-- Signature live (wajib dipertahankan):
--   public.hash_password_pengurus()  -- 0 argumen
--   RETURNS trigger
--   LANGUAGE plpgsql
--   SECURITY INVOKER (bukan SECURITY DEFINER)
-- Badan live sudah memakai extensions.crypt / extensions.gen_salt (schema-qualified),
-- jadi tidak ada referensi ke schema public. search_path dikunci ke string kosong.

BEGIN;

ALTER FUNCTION public.hash_password_pengurus()
  SET search_path = '';

COMMIT;

-- Verifikasi: klausa search_path harus tampil di proconfig dan definisi fungsi.
SELECT
  n.nspname AS schema,
  p.proname AS name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.prosecdef AS security_definer,
  p.proconfig AS config,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'hash_password_pengurus';
