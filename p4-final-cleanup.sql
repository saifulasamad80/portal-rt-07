-- P4 / M11 + L4: duplicate indexes, RLS initplan, leftover permissive OR,
-- and PII backup tables sitting in schema public (exposed to the Data API catalog).
BEGIN;

-- ---------------------------------------------------------------------------
-- M11 — Duplicate indexes on sensus_kesejahteraan(warga_id)
-- Keep uq_sensus_kesejahteraan_warga (kontrak migrasi atomik).
-- unique_warga_sensus is an identical UNIQUE btree.
-- idx_sensus_kesejahteraan_warga_id is the same key without UNIQUE.
-- ---------------------------------------------------------------------------
ALTER TABLE public.sensus_kesejahteraan DROP CONSTRAINT IF EXISTS unique_warga_sensus;
DROP INDEX IF EXISTS public.unique_warga_sensus;
DROP INDEX IF EXISTS public.idx_sensus_kesejahteraan_warga_id;

-- kas_rt had only a primary key. RLS and app filters are always on rt_id/warga_id.
CREATE INDEX IF NOT EXISTS idx_kas_rt_rt_warga
  ON public.kas_rt (rt_id, warga_id);

-- Partial indexes on warga(rt_id) only cover Disetujui / Menunggu.
CREATE INDEX IF NOT EXISTS idx_warga_rt_id
  ON public.warga (rt_id);

-- ---------------------------------------------------------------------------
-- M11 / H2 leftover — drop looser PERMISSIVE policies that OR-open the
-- tighter replacements already live (auth.jwt() per row + no rt_id).
-- Restore Admin kelola warga (dropped by H2H3) so pengurus SELECT remains
-- after the jwt-only FOR ALL policies are removed. RESTRICTIVE
-- "H2H3 deny direct warga update" still blocks authenticated UPDATE.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin kelola warga di RT-nya sendiri" ON public.warga;
CREATE POLICY "Admin kelola warga di RT-nya sendiri"
  ON public.warga
  FOR ALL
  TO authenticated
  USING (
    (SELECT public.adalah_webmaster())
    OR (
      (SELECT public.adalah_pengurus())
      AND rt_id = (SELECT public.dapatkan_rt_id_saya())
    )
  )
  WITH CHECK (
    (SELECT public.adalah_webmaster())
    OR (
      (SELECT public.adalah_pengurus())
      AND rt_id = (SELECT public.dapatkan_rt_id_saya())
    )
  );

DROP POLICY IF EXISTS "Pengurus hanya mengelola warga se-RT" ON public.warga;
DROP POLICY IF EXISTS "Webmaster akses tanpa batas" ON public.warga;
DROP POLICY IF EXISTS "Warga hanya bisa melihat profil sendiri" ON public.warga;

DROP POLICY IF EXISTS "Pengurus kelola anggota keluarga se-RT" ON public.anggota_keluarga;
DROP POLICY IF EXISTS "Warga kelola anggota keluarga sendiri" ON public.anggota_keluarga;
DROP POLICY IF EXISTS "Webmaster akses anggota keluarga tanpa batas" ON public.anggota_keluarga;

-- ---------------------------------------------------------------------------
-- M11 — auth_rls_initplan: wrap auth.uid() / helper per query, not per row.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Warga konfirmasi ronda sendiri" ON public.jadwal_ronda;
CREATE POLICY "Warga konfirmasi ronda sendiri"
  ON public.jadwal_ronda
  FOR UPDATE
  TO authenticated
  USING (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  )
  WITH CHECK (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  );

DROP POLICY IF EXISTS "Warga kelola lapak sendiri" ON public.lapak_warga;
CREATE POLICY "Warga kelola lapak sendiri"
  ON public.lapak_warga
  FOR ALL
  TO authenticated
  USING (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  )
  WITH CHECK (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  );

DROP POLICY IF EXISTS "Warga kelola laporan sendiri" ON public.laporan_warga;
CREATE POLICY "Warga kelola laporan sendiri"
  ON public.laporan_warga
  FOR ALL
  TO authenticated
  USING (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  )
  WITH CHECK (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  );

DROP POLICY IF EXISTS "Warga kelola limbah sendiri" ON public.limbah_ekonomis;
CREATE POLICY "Warga kelola limbah sendiri"
  ON public.limbah_ekonomis
  FOR ALL
  TO authenticated
  USING (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  )
  WITH CHECK (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  );

DROP POLICY IF EXISTS "Warga kelola peminjaman sendiri" ON public.peminjaman_inventaris;
CREATE POLICY "Warga kelola peminjaman sendiri"
  ON public.peminjaman_inventaris
  FOR ALL
  TO authenticated
  USING (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  )
  WITH CHECK (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  );

DROP POLICY IF EXISTS "Warga pilih suara sendiri" ON public.suara_voting;
CREATE POLICY "Warga pilih suara sendiri"
  ON public.suara_voting
  FOR INSERT
  TO authenticated
  WITH CHECK (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  );

-- ---------------------------------------------------------------------------
-- L4 — Snapshot PII 07-09-2026 in schema public. RLS on, zero policies,
-- no PK. Must not remain in the Data API catalog.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.warga_backup_070926;
DROP TABLE IF EXISTS public.transaksi_sampah_backup_070926;

COMMIT;
