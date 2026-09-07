-- H2/H3 warga RLS lockdown: tutup update langsung dari client publik.
-- Semua mutasi sah pada tabel warga dipindahkan ke jalur server service_role.
BEGIN;

-- Cabut kemampuan UPDATE dari role publik aplikasi.
REVOKE UPDATE ON public.warga FROM authenticated, anon;

-- Hapus policy lama yang terlalu longgar atau tumpang tindih.
DROP POLICY IF EXISTS "Warga hanya bisa memperbarui profil sendiri" ON public.warga;
DROP POLICY IF EXISTS "Admin kelola warga di RT-nya sendiri" ON public.warga;
DROP POLICY IF EXISTS "H2H3 deny direct warga update" ON public.warga;

-- Fail-closed: direct client tidak dapat melakukan UPDATE apa pun ke warga.
CREATE POLICY "H2H3 deny direct warga update"
  ON public.warga
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
