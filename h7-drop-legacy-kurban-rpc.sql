-- H7 / PR2: hapus overload lama public.proses_autodebet_kurban tanpa isolasi rt_id.
-- Scan live schema public (8 Sep 2026), dua signature:
--   1. (uuid, integer, text, date, text)
--      SECURITY DEFINER, search_path mutable, INSERT transaksi_sampah /
--      transaksi_kurban / audit_log TANPA kolom rt_id, saldo tanpa filter tenant.
--      Ini overload yang di-DROP.
--   2. (uuid, numeric, text, date, text)
--      search_path terkunci, v_rt_id dari induk warga. JANGAN dihapus.
-- Tidak ada overload 2 argumen (warga_id, jumlah_potongan) di schema public.

BEGIN;

DROP FUNCTION IF EXISTS public.proses_autodebet_kurban(uuid, integer, text, date, text);

COMMIT;

SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.prosecdef AS security_definer,
  p.proconfig AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'proses_autodebet_kurban'
ORDER BY pg_get_function_identity_arguments(p.oid);
