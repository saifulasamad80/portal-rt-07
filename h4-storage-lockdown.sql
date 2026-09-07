-- H4 storage lockdown: dokumen_warga berisi KTP/KK privat.
-- Upload dan pembacaan dokumen wajib melalui service_role di server.
BEGIN;

UPDATE storage.buckets
SET public = false
WHERE id = 'dokumen_warga';

DO $$
DECLARE
  kebijakan record;
BEGIN
  -- Buang policy lama yang secara eksplisit memberi akses ke bucket ini.
  -- Restrictive policy di bawah tetap menjadi pagar akhir bila ada policy
  -- generik lintas bucket yang masih tersisa.
  FOR kebijakan IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND roles && ARRAY['public'::name, 'anon'::name, 'authenticated'::name]
      AND cmd IN ('ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE')
      AND (
        COALESCE(qual, '') ILIKE '%dokumen_warga%'
        OR COALESCE(with_check, '') ILIKE '%dokumen_warga%'
        OR policyname ILIKE '%dokumen_warga%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', kebijakan.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "H4 deny direct dokumen_warga access" ON storage.objects;

-- Fail-closed untuk semua direct client role pada bucket dokumen_warga.
-- Role service_role Supabase tetap dapat bekerja karena bypass RLS.
CREATE POLICY "H4 deny direct dokumen_warga access"
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (bucket_id <> 'dokumen_warga')
  WITH CHECK (bucket_id <> 'dokumen_warga');

COMMIT;
