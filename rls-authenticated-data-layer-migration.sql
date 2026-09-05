-- ======================================================================================
-- Pilar 3 & 4: RLS yang bisa dipakai klien terautentikasi (bukan service_role)
--
-- 1. Helper SECURITY DEFINER agar policy admin tidak menabrak RLS pengurus_rt.
-- 2. Kebijakan tulis tenant untuk warga/kas/jumantik/pengumuman + tabel operasional.
-- 3. Kolom rt_id pada laporan_jumantik (sebelumnya tidak ada, sehingga filter
--    aplikasi tidak pernah menjadi boundary database).
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
  SELECT p.rt_id INTO v_rt_id FROM public.pengurus_rt p WHERE p.id = auth.uid();
  IF v_rt_id IS NOT NULL THEN
    RETURN v_rt_id;
  END IF;
  SELECT w.rt_id INTO v_rt_id FROM public.warga w WHERE w.id = auth.uid();
  RETURN v_rt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.klaim_teks_jwt(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adalah_pengurus() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adalah_webmaster() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dapatkan_rt_id_saya() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klaim_teks_jwt(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adalah_pengurus() TO authenticated;
GRANT EXECUTE ON FUNCTION public.adalah_webmaster() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dapatkan_rt_id_saya() TO authenticated;

ALTER TABLE public.laporan_jumantik
  ADD COLUMN IF NOT EXISTS rt_id uuid REFERENCES public.master_rt(id);

UPDATE public.laporan_jumantik
SET rt_id = (SELECT id FROM public.master_rt LIMIT 1)
WHERE rt_id IS NULL
  AND (SELECT COUNT(*) FROM public.master_rt) = 1;

DROP POLICY IF EXISTS "Admin kelola warga di RT-nya sendiri" ON public.warga;
CREATE POLICY "Admin kelola warga di RT-nya sendiri"
  ON public.warga
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()))
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

DROP POLICY IF EXISTS "Warga hanya bisa membaca profil sendiri" ON public.warga;
CREATE POLICY "Warga hanya bisa membaca profil sendiri"
  ON public.warga
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya());

DROP POLICY IF EXISTS "Warga hanya bisa memperbarui profil sendiri" ON public.warga;
CREATE POLICY "Warga hanya bisa memperbarui profil sendiri"
  ON public.warga
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya())
  WITH CHECK (id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya());

DROP POLICY IF EXISTS "Admin kelola kas RT-nya sendiri" ON public.kas_rt;
CREATE POLICY "Admin kelola kas RT-nya sendiri"
  ON public.kas_rt
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()))
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

DROP POLICY IF EXISTS "Warga lihat data kas di RT-nya sendiri" ON public.kas_rt;
CREATE POLICY "Warga lihat data kas di RT-nya sendiri"
  ON public.kas_rt
  FOR SELECT
  TO authenticated
  USING (rt_id = public.dapatkan_rt_id_saya());

DROP POLICY IF EXISTS "Akses pengumuman terisolasi per RT" ON public.pengumuman_rt;
CREATE POLICY "Warga baca pengumuman RT sendiri"
  ON public.pengumuman_rt
  FOR SELECT
  TO authenticated
  USING (rt_id = public.dapatkan_rt_id_saya());

DROP POLICY IF EXISTS "Pengurus kelola pengumuman RT sendiri" ON public.pengumuman_rt;
CREATE POLICY "Pengurus kelola pengumuman RT sendiri"
  ON public.pengumuman_rt
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()))
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

DROP POLICY IF EXISTS "Bebas baca laporan" ON public.laporan_jumantik;
DROP POLICY IF EXISTS "Bebas tambah laporan" ON public.laporan_jumantik;
DROP POLICY IF EXISTS "deny_public_laporan_jumantik" ON public.laporan_jumantik;
DROP POLICY IF EXISTS "Pengurus kelola jumantik RT sendiri" ON public.laporan_jumantik;
DROP POLICY IF EXISTS "Warga baca jumantik RT sendiri" ON public.laporan_jumantik;

CREATE POLICY "Pengurus kelola jumantik RT sendiri"
  ON public.laporan_jumantik
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()))
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

CREATE POLICY "Warga baca jumantik RT sendiri"
  ON public.laporan_jumantik
  FOR SELECT
  TO authenticated
  USING (rt_id = public.dapatkan_rt_id_saya());

DROP POLICY IF EXISTS "Warga hanya bisa melihat anggota keluarganya sendiri" ON public.anggota_keluarga;
DROP POLICY IF EXISTS "Warga kelola anggota rumah tangga sendiri" ON public.anggota_keluarga;
DROP POLICY IF EXISTS "Pengurus kelola anggota RT sendiri" ON public.anggota_keluarga;

CREATE POLICY "Warga kelola anggota rumah tangga sendiri"
  ON public.anggota_keluarga
  FOR ALL
  TO authenticated
  USING (warga_id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya())
  WITH CHECK (warga_id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya());

CREATE POLICY "Pengurus kelola anggota RT sendiri"
  ON public.anggota_keluarga
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()))
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

DROP POLICY IF EXISTS "Admin dapat melihat log audit" ON public.audit_log;
DROP POLICY IF EXISTS "Pengurus baca audit RT sendiri" ON public.audit_log;
DROP POLICY IF EXISTS "Pengurus catat audit RT sendiri" ON public.audit_log;

CREATE POLICY "Pengurus baca audit RT sendiri"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

CREATE POLICY "Pengurus catat audit RT sendiri"
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

DROP POLICY IF EXISTS "Warga terotentikasi dapat membaca jadwal ronda" ON public.jadwal_ronda;
DROP POLICY IF EXISTS "Warga baca ronda RT sendiri" ON public.jadwal_ronda;
DROP POLICY IF EXISTS "Pengurus kelola ronda RT sendiri" ON public.jadwal_ronda;
DROP POLICY IF EXISTS "Warga konfirmasi ronda sendiri" ON public.jadwal_ronda;

CREATE POLICY "Warga baca ronda RT sendiri"
  ON public.jadwal_ronda
  FOR SELECT
  TO authenticated
  USING (rt_id = public.dapatkan_rt_id_saya());

CREATE POLICY "Pengurus kelola ronda RT sendiri"
  ON public.jadwal_ronda
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()))
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

CREATE POLICY "Warga konfirmasi ronda sendiri"
  ON public.jadwal_ronda
  FOR UPDATE
  TO authenticated
  USING (warga_id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya())
  WITH CHECK (warga_id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya());

DROP POLICY IF EXISTS "Akses voting terisolasi per RT" ON public.voting_rt;
DROP POLICY IF EXISTS "Warga baca voting RT sendiri" ON public.voting_rt;
DROP POLICY IF EXISTS "Pengurus kelola voting RT sendiri" ON public.voting_rt;

CREATE POLICY "Warga baca voting RT sendiri"
  ON public.voting_rt
  FOR SELECT
  TO authenticated
  USING (rt_id = public.dapatkan_rt_id_saya());

CREATE POLICY "Pengurus kelola voting RT sendiri"
  ON public.voting_rt
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()))
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

DROP POLICY IF EXISTS "Warga pilih suara sendiri" ON public.suara_voting;
DROP POLICY IF EXISTS "Pengurus baca suara RT sendiri" ON public.suara_voting;

CREATE POLICY "Warga pilih suara sendiri"
  ON public.suara_voting
  FOR INSERT
  TO authenticated
  WITH CHECK (warga_id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya());

CREATE POLICY "Pengurus baca suara RT sendiri"
  ON public.suara_voting
  FOR SELECT
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

DROP POLICY IF EXISTS "Pengurus kelola lapak RT sendiri" ON public.lapak_warga;
DROP POLICY IF EXISTS "Warga kelola lapak sendiri" ON public.lapak_warga;

CREATE POLICY "Pengurus kelola lapak RT sendiri"
  ON public.lapak_warga
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()))
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

CREATE POLICY "Warga kelola lapak sendiri"
  ON public.lapak_warga
  FOR ALL
  TO authenticated
  USING (warga_id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya())
  WITH CHECK (warga_id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya());

DROP POLICY IF EXISTS "Pengurus kelola laporan warga RT sendiri" ON public.laporan_warga;
DROP POLICY IF EXISTS "Warga kelola laporan sendiri" ON public.laporan_warga;

CREATE POLICY "Pengurus kelola laporan warga RT sendiri"
  ON public.laporan_warga
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()))
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

CREATE POLICY "Warga kelola laporan sendiri"
  ON public.laporan_warga
  FOR ALL
  TO authenticated
  USING (warga_id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya())
  WITH CHECK (warga_id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya());

DROP POLICY IF EXISTS "Pengurus kelola inventaris RT sendiri" ON public.master_inventaris;
DROP POLICY IF EXISTS "Warga baca inventaris RT sendiri" ON public.master_inventaris;

CREATE POLICY "Pengurus kelola inventaris RT sendiri"
  ON public.master_inventaris
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()))
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

CREATE POLICY "Warga baca inventaris RT sendiri"
  ON public.master_inventaris
  FOR SELECT
  TO authenticated
  USING (rt_id = public.dapatkan_rt_id_saya());

DROP POLICY IF EXISTS "Pengurus kelola peminjaman RT sendiri" ON public.peminjaman_inventaris;
DROP POLICY IF EXISTS "Warga kelola peminjaman sendiri" ON public.peminjaman_inventaris;

CREATE POLICY "Pengurus kelola peminjaman RT sendiri"
  ON public.peminjaman_inventaris
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()))
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

CREATE POLICY "Warga kelola peminjaman sendiri"
  ON public.peminjaman_inventaris
  FOR ALL
  TO authenticated
  USING (warga_id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya())
  WITH CHECK (warga_id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya());

DROP POLICY IF EXISTS "Pengurus kelola sampah RT sendiri" ON public.transaksi_sampah;
DROP POLICY IF EXISTS "Warga baca sampah sendiri" ON public.transaksi_sampah;

CREATE POLICY "Pengurus kelola sampah RT sendiri"
  ON public.transaksi_sampah
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()))
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

CREATE POLICY "Warga baca sampah sendiri"
  ON public.transaksi_sampah
  FOR SELECT
  TO authenticated
  USING (warga_id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya());

DROP POLICY IF EXISTS "Pengurus kelola limbah RT sendiri" ON public.limbah_ekonomis;
DROP POLICY IF EXISTS "Warga kelola limbah sendiri" ON public.limbah_ekonomis;

CREATE POLICY "Pengurus kelola limbah RT sendiri"
  ON public.limbah_ekonomis
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()))
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

CREATE POLICY "Warga kelola limbah sendiri"
  ON public.limbah_ekonomis
  FOR ALL
  TO authenticated
  USING (warga_id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya())
  WITH CHECK (warga_id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya());

DROP POLICY IF EXISTS "Pengurus kelola kurban lewat warga RT" ON public.transaksi_kurban;
DROP POLICY IF EXISTS "Warga baca kurban sendiri" ON public.transaksi_kurban;
DROP POLICY IF EXISTS "Izinkan baca kurban" ON public.transaksi_kurban;

CREATE POLICY "Pengurus kelola kurban lewat warga RT"
  ON public.transaksi_kurban
  FOR ALL
  TO authenticated
  USING (
    public.adalah_webmaster()
    OR (
      public.adalah_pengurus()
      AND EXISTS (
        SELECT 1 FROM public.warga w
        WHERE w.id = transaksi_kurban.warga_id
          AND w.rt_id = public.dapatkan_rt_id_saya()
      )
    )
  )
  WITH CHECK (
    public.adalah_webmaster()
    OR (
      public.adalah_pengurus()
      AND EXISTS (
        SELECT 1 FROM public.warga w
        WHERE w.id = transaksi_kurban.warga_id
          AND w.rt_id = public.dapatkan_rt_id_saya()
      )
    )
  );

CREATE POLICY "Warga baca kurban sendiri"
  ON public.transaksi_kurban
  FOR SELECT
  TO authenticated
  USING (warga_id = auth.uid());

DROP POLICY IF EXISTS "Pengurus kelola tabungan kurban RT sendiri" ON public.tabungan_kurban;
DROP POLICY IF EXISTS "Warga baca tabungan kurban sendiri" ON public.tabungan_kurban;

CREATE POLICY "Pengurus kelola tabungan kurban RT sendiri"
  ON public.tabungan_kurban
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()))
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

CREATE POLICY "Warga baca tabungan kurban sendiri"
  ON public.tabungan_kurban
  FOR SELECT
  TO authenticated
  USING (warga_id = auth.uid() AND rt_id = public.dapatkan_rt_id_saya());

DROP POLICY IF EXISTS "Pengurus kelola arisan RT sendiri" ON public.arisan_ibu;
DROP POLICY IF EXISTS "Warga baca arisan RT sendiri" ON public.arisan_ibu;

CREATE POLICY "Pengurus kelola arisan RT sendiri"
  ON public.arisan_ibu
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()))
  WITH CHECK (public.adalah_webmaster() OR (rt_id = public.dapatkan_rt_id_saya() AND public.adalah_pengurus()));

CREATE POLICY "Warga baca arisan RT sendiri"
  ON public.arisan_ibu
  FOR SELECT
  TO authenticated
  USING (rt_id = public.dapatkan_rt_id_saya());

DROP POLICY IF EXISTS "Pengurus kelola transaksi arisan RT sendiri" ON public.arisan_transaksi;
DROP POLICY IF EXISTS "Warga baca transaksi arisan RT sendiri" ON public.arisan_transaksi;

CREATE POLICY "Pengurus kelola transaksi arisan RT sendiri"
  ON public.arisan_transaksi
  FOR ALL
  TO authenticated
  USING (
    public.adalah_webmaster()
    OR (
      public.adalah_pengurus()
      AND EXISTS (
        SELECT 1 FROM public.arisan_ibu a
        WHERE a.id = arisan_transaksi.arisan_id
          AND a.rt_id = public.dapatkan_rt_id_saya()
      )
    )
  )
  WITH CHECK (
    public.adalah_webmaster()
    OR (
      public.adalah_pengurus()
      AND EXISTS (
        SELECT 1 FROM public.arisan_ibu a
        WHERE a.id = arisan_transaksi.arisan_id
          AND a.rt_id = public.dapatkan_rt_id_saya()
      )
    )
  );

CREATE POLICY "Warga baca transaksi arisan RT sendiri"
  ON public.arisan_transaksi
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.arisan_ibu a
      WHERE a.id = arisan_transaksi.arisan_id
        AND a.rt_id = public.dapatkan_rt_id_saya()
    )
  );

DROP POLICY IF EXISTS "Warga kelola sensus sendiri" ON public.sensus_kesejahteraan;
DROP POLICY IF EXISTS "Pengurus baca sensus RT sendiri" ON public.sensus_kesejahteraan;
DROP POLICY IF EXISTS "Pengurus kelola sensus RT sendiri" ON public.sensus_kesejahteraan;

CREATE POLICY "Warga kelola sensus sendiri"
  ON public.sensus_kesejahteraan
  FOR ALL
  TO authenticated
  USING (warga_id = auth.uid())
  WITH CHECK (warga_id = auth.uid());

CREATE POLICY "Pengurus kelola sensus RT sendiri"
  ON public.sensus_kesejahteraan
  FOR ALL
  TO authenticated
  USING (
    public.adalah_webmaster()
    OR (
      public.adalah_pengurus()
      AND EXISTS (
        SELECT 1 FROM public.warga w
        WHERE w.id = sensus_kesejahteraan.warga_id
          AND w.rt_id = public.dapatkan_rt_id_saya()
      )
    )
  )
  WITH CHECK (
    public.adalah_webmaster()
    OR (
      public.adalah_pengurus()
      AND EXISTS (
        SELECT 1 FROM public.warga w
        WHERE w.id = sensus_kesejahteraan.warga_id
          AND w.rt_id = public.dapatkan_rt_id_saya()
      )
    )
  );

DROP POLICY IF EXISTS "Warga kelola langganan push sendiri" ON public.push_langganan;

CREATE POLICY "Warga kelola langganan push sendiri"
  ON public.push_langganan
  FOR ALL
  TO authenticated
  USING (warga_id = auth.uid())
  WITH CHECK (warga_id = auth.uid());

DROP POLICY IF EXISTS "Pengurus baca pengurus sendiri" ON public.pengurus_rt;

CREATE POLICY "Pengurus baca pengurus sendiri"
  ON public.pengurus_rt
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.adalah_webmaster());

DROP POLICY IF EXISTS "Webmaster kelola pengurus" ON public.pengurus_rt;
CREATE POLICY "Webmaster kelola pengurus"
  ON public.pengurus_rt
  FOR ALL
  TO authenticated
  USING (public.adalah_webmaster())
  WITH CHECK (public.adalah_webmaster());

DROP POLICY IF EXISTS "Warga daftar arisan RT sendiri" ON public.arisan_ibu;
CREATE POLICY "Warga daftar arisan RT sendiri"
  ON public.arisan_ibu
  FOR INSERT
  TO authenticated
  WITH CHECK (
    rt_id = public.dapatkan_rt_id_saya()
    AND status_keanggotaan = 'Menunggu'
    AND COALESCE(setoran_terakhir, 0) = 0
    AND COALESCE(pinjaman_berjalan, 0) = 0
  );
