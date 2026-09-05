-- ======================================================================================
-- Perbaikan RLS: tenant dibaca dari klaim JWT PostgREST, bukan lookup tabel
--
-- Kontrak yang HARUS identik dengan lib/supabase-server.ts (buatKlienTerautentikasi):
--   SignJWT payload:
--     role     = 'authenticated'     → PostgREST SET ROLE; auth.role()
--     aud      = 'authenticated'
--     sub      = sesi.id             → auth.uid()  (lewat .setSubject)
--     rt_id    = sesi.rtId           → auth.jwt()->>'rt_id'
--     app_role = 'warga'|'rt'|'webmaster'
--
-- Cara Postgres/PostgREST menyimpan payload:
--   current_setting('request.jwt.claims', true)::jsonb   -- seluruh payload
--   current_setting('request.jwt.claim.<nama>', true)    -- klaim satuan (legacy)
-- yang dibungkus auth.jwt() / auth.uid() di skema auth (definisi live).
-- ======================================================================================

CREATE OR REPLACE FUNCTION public.klaim_teks_jwt(p_nama text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT NULLIF(
    COALESCE(
      NULLIF(current_setting('request.jwt.claim.' || p_nama, true), ''),
      NULLIF(auth.jwt() ->> p_nama, '')
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.dapatkan_rt_id_saya()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rt_id uuid;
BEGIN
  BEGIN
    v_rt_id := public.klaim_teks_jwt('rt_id')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_rt_id := NULL;
  END;

  IF v_rt_id IS NOT NULL THEN
    RETURN v_rt_id;
  END IF;

  -- Cadangan untuk token lama tanpa klaim rt_id. SECURITY DEFINER
  -- menghindari ayam-telur RLS pada pengurus_rt / warga.
  SELECT p.rt_id INTO v_rt_id FROM public.pengurus_rt p WHERE p.id = auth.uid();
  IF v_rt_id IS NOT NULL THEN
    RETURN v_rt_id;
  END IF;
  SELECT w.rt_id INTO v_rt_id FROM public.warga w WHERE w.id = auth.uid();
  RETURN v_rt_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.adalah_pengurus()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    COALESCE(public.klaim_teks_jwt('app_role'), '') IN ('rt', 'webmaster')
    OR EXISTS (SELECT 1 FROM public.pengurus_rt WHERE id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.adalah_webmaster()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    COALESCE(public.klaim_teks_jwt('app_role'), '') = 'webmaster'
    OR EXISTS (
      SELECT 1 FROM public.pengurus_rt
      WHERE id = auth.uid() AND level = 'webmaster'
    );
$$;

REVOKE ALL ON FUNCTION public.klaim_teks_jwt(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dapatkan_rt_id_saya() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adalah_pengurus() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adalah_webmaster() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klaim_teks_jwt(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dapatkan_rt_id_saya() TO authenticated;
GRANT EXECUTE ON FUNCTION public.adalah_pengurus() TO authenticated;
GRANT EXECUTE ON FUNCTION public.adalah_webmaster() TO authenticated;

-- ======================================================================================
-- Policy SELECT tenant: rt_id baris = rt_id dari JWT.
-- Policy FOR ALL yang sudah ada tetap berlaku; SELECT di bawah memastikan
-- dashboard/buku induk tidak kosong setelah service_role dicabut.
-- `(SELECT helper())` memaksa Postgres mengevaluasi klaim sekali per kueri.
-- ======================================================================================

DROP POLICY IF EXISTS "Pengurus baca pengurus sendiri" ON public.pengurus_rt;
DROP POLICY IF EXISTS "Pengurus baca pengurus RT sendiri" ON public.pengurus_rt;
CREATE POLICY "Pengurus baca pengurus RT sendiri"
  ON public.pengurus_rt
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.adalah_webmaster())
    OR (
      (SELECT public.adalah_pengurus())
      AND rt_id = (SELECT public.dapatkan_rt_id_saya())
    )
  );

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

DROP POLICY IF EXISTS "Warga hanya bisa membaca profil sendiri" ON public.warga;
CREATE POLICY "Warga hanya bisa membaca profil sendiri"
  ON public.warga
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  );

DROP POLICY IF EXISTS "Admin kelola kas RT-nya sendiri" ON public.kas_rt;
CREATE POLICY "Admin kelola kas RT-nya sendiri"
  ON public.kas_rt
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

DROP POLICY IF EXISTS "Warga lihat data kas di RT-nya sendiri" ON public.kas_rt;
CREATE POLICY "Warga lihat data kas di RT-nya sendiri"
  ON public.kas_rt
  FOR SELECT
  TO authenticated
  USING (rt_id = (SELECT public.dapatkan_rt_id_saya()));

DROP POLICY IF EXISTS "Pengurus kelola tabungan kurban RT sendiri" ON public.tabungan_kurban;
CREATE POLICY "Pengurus kelola tabungan kurban RT sendiri"
  ON public.tabungan_kurban
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

DROP POLICY IF EXISTS "Warga baca tabungan kurban sendiri" ON public.tabungan_kurban;
CREATE POLICY "Warga baca tabungan kurban sendiri"
  ON public.tabungan_kurban
  FOR SELECT
  TO authenticated
  USING (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  );

DROP POLICY IF EXISTS "Pengurus kelola kurban lewat warga RT" ON public.transaksi_kurban;
CREATE POLICY "Pengurus kelola kurban lewat warga RT"
  ON public.transaksi_kurban
  FOR ALL
  TO authenticated
  USING (
    (SELECT public.adalah_webmaster())
    OR (
      (SELECT public.adalah_pengurus())
      AND EXISTS (
        SELECT 1 FROM public.warga w
        WHERE w.id = transaksi_kurban.warga_id
          AND w.rt_id = (SELECT public.dapatkan_rt_id_saya())
      )
    )
  )
  WITH CHECK (
    (SELECT public.adalah_webmaster())
    OR (
      (SELECT public.adalah_pengurus())
      AND EXISTS (
        SELECT 1 FROM public.warga w
        WHERE w.id = transaksi_kurban.warga_id
          AND w.rt_id = (SELECT public.dapatkan_rt_id_saya())
      )
    )
  );

DROP POLICY IF EXISTS "Warga baca kurban sendiri" ON public.transaksi_kurban;
CREATE POLICY "Warga baca kurban sendiri"
  ON public.transaksi_kurban
  FOR SELECT
  TO authenticated
  USING (warga_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Pengurus kelola sampah RT sendiri" ON public.transaksi_sampah;
CREATE POLICY "Pengurus kelola sampah RT sendiri"
  ON public.transaksi_sampah
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

DROP POLICY IF EXISTS "Warga baca sampah sendiri" ON public.transaksi_sampah;
CREATE POLICY "Warga baca sampah sendiri"
  ON public.transaksi_sampah
  FOR SELECT
  TO authenticated
  USING (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  );

DROP POLICY IF EXISTS "Warga baca pengumuman RT sendiri" ON public.pengumuman_rt;
CREATE POLICY "Warga baca pengumuman RT sendiri"
  ON public.pengumuman_rt
  FOR SELECT
  TO authenticated
  USING (rt_id = (SELECT public.dapatkan_rt_id_saya()));

DROP POLICY IF EXISTS "Pengurus kelola pengumuman RT sendiri" ON public.pengumuman_rt;
CREATE POLICY "Pengurus kelola pengumuman RT sendiri"
  ON public.pengumuman_rt
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

DROP POLICY IF EXISTS "Pengurus kelola anggota RT sendiri" ON public.anggota_keluarga;
CREATE POLICY "Pengurus kelola anggota RT sendiri"
  ON public.anggota_keluarga
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

DROP POLICY IF EXISTS "Warga kelola anggota rumah tangga sendiri" ON public.anggota_keluarga;
CREATE POLICY "Warga kelola anggota rumah tangga sendiri"
  ON public.anggota_keluarga
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

DROP POLICY IF EXISTS "Pengurus baca audit RT sendiri" ON public.audit_log;
CREATE POLICY "Pengurus baca audit RT sendiri"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.adalah_webmaster())
    OR (
      (SELECT public.adalah_pengurus())
      AND rt_id = (SELECT public.dapatkan_rt_id_saya())
    )
  );

DROP POLICY IF EXISTS "Warga baca ronda RT sendiri" ON public.jadwal_ronda;
CREATE POLICY "Warga baca ronda RT sendiri"
  ON public.jadwal_ronda
  FOR SELECT
  TO authenticated
  USING (rt_id = (SELECT public.dapatkan_rt_id_saya()));

DROP POLICY IF EXISTS "Pengurus kelola ronda RT sendiri" ON public.jadwal_ronda;
CREATE POLICY "Pengurus kelola ronda RT sendiri"
  ON public.jadwal_ronda
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

DROP POLICY IF EXISTS "Warga baca voting RT sendiri" ON public.voting_rt;
CREATE POLICY "Warga baca voting RT sendiri"
  ON public.voting_rt
  FOR SELECT
  TO authenticated
  USING (rt_id = (SELECT public.dapatkan_rt_id_saya()));

DROP POLICY IF EXISTS "Pengurus kelola voting RT sendiri" ON public.voting_rt;
CREATE POLICY "Pengurus kelola voting RT sendiri"
  ON public.voting_rt
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

DROP POLICY IF EXISTS "Pengurus baca suara RT sendiri" ON public.suara_voting;
CREATE POLICY "Pengurus baca suara RT sendiri"
  ON public.suara_voting
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.adalah_webmaster())
    OR (
      (SELECT public.adalah_pengurus())
      AND rt_id = (SELECT public.dapatkan_rt_id_saya())
    )
  );

DROP POLICY IF EXISTS "Pengurus kelola lapak RT sendiri" ON public.lapak_warga;
CREATE POLICY "Pengurus kelola lapak RT sendiri"
  ON public.lapak_warga
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

DROP POLICY IF EXISTS "Pengurus kelola laporan warga RT sendiri" ON public.laporan_warga;
CREATE POLICY "Pengurus kelola laporan warga RT sendiri"
  ON public.laporan_warga
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

DROP POLICY IF EXISTS "Pengurus kelola inventaris RT sendiri" ON public.master_inventaris;
CREATE POLICY "Pengurus kelola inventaris RT sendiri"
  ON public.master_inventaris
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

DROP POLICY IF EXISTS "Warga baca inventaris RT sendiri" ON public.master_inventaris;
CREATE POLICY "Warga baca inventaris RT sendiri"
  ON public.master_inventaris
  FOR SELECT
  TO authenticated
  USING (rt_id = (SELECT public.dapatkan_rt_id_saya()));

DROP POLICY IF EXISTS "Pengurus kelola peminjaman RT sendiri" ON public.peminjaman_inventaris;
CREATE POLICY "Pengurus kelola peminjaman RT sendiri"
  ON public.peminjaman_inventaris
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

DROP POLICY IF EXISTS "Pengurus kelola jumantik RT sendiri" ON public.laporan_jumantik;
CREATE POLICY "Pengurus kelola jumantik RT sendiri"
  ON public.laporan_jumantik
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

DROP POLICY IF EXISTS "Warga baca jumantik RT sendiri" ON public.laporan_jumantik;
CREATE POLICY "Warga baca jumantik RT sendiri"
  ON public.laporan_jumantik
  FOR SELECT
  TO authenticated
  USING (rt_id = (SELECT public.dapatkan_rt_id_saya()));

DROP POLICY IF EXISTS "Pengurus kelola arisan RT sendiri" ON public.arisan_ibu;
CREATE POLICY "Pengurus kelola arisan RT sendiri"
  ON public.arisan_ibu
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

DROP POLICY IF EXISTS "Warga baca arisan RT sendiri" ON public.arisan_ibu;
CREATE POLICY "Warga baca arisan RT sendiri"
  ON public.arisan_ibu
  FOR SELECT
  TO authenticated
  USING (rt_id = (SELECT public.dapatkan_rt_id_saya()));

DROP POLICY IF EXISTS "Pengurus kelola limbah RT sendiri" ON public.limbah_ekonomis;
CREATE POLICY "Pengurus kelola limbah RT sendiri"
  ON public.limbah_ekonomis
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
