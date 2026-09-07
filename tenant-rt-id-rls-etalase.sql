-- Fase 2: RLS webmaster wajib rt_id; etalase/posyandu/e-voting tidak USING true.

CREATE OR REPLACE FUNCTION public.klaim_baca_tenant(p_rt_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_rt_id IS NOT NULL AND (
    public.adalah_webmaster()
    OR p_rt_id = public.dapatkan_rt_id_saya()
  );
$$;

CREATE OR REPLACE FUNCTION public.klaim_tulis_tenant(p_rt_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p_rt_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.master_rt AS m WHERE m.id = p_rt_id)
    AND (
      public.adalah_webmaster()
      OR (
        public.adalah_pengurus()
        AND p_rt_id = public.dapatkan_rt_id_saya()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.klaim_baca_tenant(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.klaim_tulis_tenant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.klaim_baca_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.klaim_tulis_tenant(uuid) TO authenticated;

-- Webmaster SELECT/ALL: rt_id wajib. Pengurus tetap equality jwt.
DROP POLICY IF EXISTS "Pengurus kelola sampah RT sendiri" ON public.transaksi_sampah;
CREATE POLICY "Pengurus kelola sampah RT sendiri"
  ON public.transaksi_sampah
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus kelola kurban lewat warga RT" ON public.transaksi_kurban;
CREATE POLICY "Pengurus kelola kurban lewat warga RT"
  ON public.transaksi_kurban
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Warga baca kurban sendiri" ON public.transaksi_kurban;
CREATE POLICY "Warga baca kurban sendiri"
  ON public.transaksi_kurban
  FOR SELECT TO authenticated
  USING (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  );

DROP POLICY IF EXISTS "Admin kelola kas RT-nya sendiri" ON public.kas_rt;
CREATE POLICY "Admin kelola kas RT-nya sendiri"
  ON public.kas_rt
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Admin kelola warga di RT-nya sendiri" ON public.warga;
CREATE POLICY "Admin kelola warga di RT-nya sendiri"
  ON public.warga
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus kelola pengumuman RT sendiri" ON public.pengumuman_rt;
CREATE POLICY "Pengurus kelola pengumuman RT sendiri"
  ON public.pengumuman_rt
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus kelola tabungan kurban RT sendiri" ON public.tabungan_kurban;
CREATE POLICY "Pengurus kelola tabungan kurban RT sendiri"
  ON public.tabungan_kurban
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus kelola anggota RT sendiri" ON public.anggota_keluarga;
CREATE POLICY "Pengurus kelola anggota RT sendiri"
  ON public.anggota_keluarga
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus baca audit RT sendiri" ON public.audit_log;
CREATE POLICY "Pengurus baca audit RT sendiri"
  ON public.audit_log
  FOR SELECT TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus catat audit RT sendiri" ON public.audit_log;
CREATE POLICY "Pengurus catat audit RT sendiri"
  ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus kelola ronda RT sendiri" ON public.jadwal_ronda;
CREATE POLICY "Pengurus kelola ronda RT sendiri"
  ON public.jadwal_ronda
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus kelola voting RT sendiri" ON public.voting_rt;
CREATE POLICY "Pengurus kelola voting RT sendiri"
  ON public.voting_rt
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus baca suara RT sendiri" ON public.suara_voting;
CREATE POLICY "Pengurus baca suara RT sendiri"
  ON public.suara_voting
  FOR SELECT TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus kelola lapak RT sendiri" ON public.lapak_warga;
CREATE POLICY "Pengurus kelola lapak RT sendiri"
  ON public.lapak_warga
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus kelola laporan warga RT sendiri" ON public.laporan_warga;
CREATE POLICY "Pengurus kelola laporan warga RT sendiri"
  ON public.laporan_warga
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus kelola inventaris RT sendiri" ON public.master_inventaris;
CREATE POLICY "Pengurus kelola inventaris RT sendiri"
  ON public.master_inventaris
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus kelola peminjaman RT sendiri" ON public.peminjaman_inventaris;
CREATE POLICY "Pengurus kelola peminjaman RT sendiri"
  ON public.peminjaman_inventaris
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus kelola jumantik RT sendiri" ON public.laporan_jumantik;
CREATE POLICY "Pengurus kelola jumantik RT sendiri"
  ON public.laporan_jumantik
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus kelola arisan RT sendiri" ON public.arisan_ibu;
CREATE POLICY "Pengurus kelola arisan RT sendiri"
  ON public.arisan_ibu
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus kelola limbah RT sendiri" ON public.limbah_ekonomis;
CREATE POLICY "Pengurus kelola limbah RT sendiri"
  ON public.limbah_ekonomis
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Pengurus kelola transaksi arisan RT sendiri" ON public.arisan_transaksi;
CREATE POLICY "Pengurus kelola transaksi arisan RT sendiri"
  ON public.arisan_transaksi
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Warga baca transaksi arisan RT sendiri" ON public.arisan_transaksi;
CREATE POLICY "Warga baca transaksi arisan RT sendiri"
  ON public.arisan_transaksi
  FOR SELECT TO authenticated
  USING (rt_id = (SELECT public.dapatkan_rt_id_saya()));

DROP POLICY IF EXISTS "Pengurus kelola sensus RT sendiri" ON public.sensus_kesejahteraan;
CREATE POLICY "Pengurus kelola sensus RT sendiri"
  ON public.sensus_kesejahteraan
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Warga kelola sensus sendiri" ON public.sensus_kesejahteraan;
CREATE POLICY "Warga kelola sensus sendiri"
  ON public.sensus_kesejahteraan
  FOR ALL TO authenticated
  USING (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  )
  WITH CHECK (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  );

DROP POLICY IF EXISTS "Warga kelola langganan push sendiri" ON public.push_langganan;
CREATE POLICY "Warga kelola langganan push sendiri"
  ON public.push_langganan
  FOR ALL TO authenticated
  USING (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  )
  WITH CHECK (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  );

DROP POLICY IF EXISTS "Pengurus baca pengurus RT sendiri" ON public.pengurus_rt;
CREATE POLICY "Pengurus baca pengurus RT sendiri"
  ON public.pengurus_rt
  FOR SELECT TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)));

-- Etalase: anon ditutup total; authenticated tetap tenant-aware.
DROP POLICY IF EXISTS "Publik baca galeri terbit" ON public.galeri_kegiatan;
DROP POLICY IF EXISTS "Anon tidak dapat membaca galeri" ON public.galeri_kegiatan;
DROP POLICY IF EXISTS "Authenticated kelola galeri tenant" ON public.galeri_kegiatan;
CREATE POLICY "Publik baca galeri terbit"
  ON public.galeri_kegiatan
  FOR SELECT TO anon
  USING (false);
CREATE POLICY "Authenticated kelola galeri tenant"
  ON public.galeri_kegiatan
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Publik baca dokumen terbit" ON public.dokumen_publik_rt;
DROP POLICY IF EXISTS "Anon tidak dapat membaca dokumen" ON public.dokumen_publik_rt;
DROP POLICY IF EXISTS "Authenticated kelola dokumen tenant" ON public.dokumen_publik_rt;
CREATE POLICY "Publik baca dokumen terbit"
  ON public.dokumen_publik_rt
  FOR SELECT TO anon
  USING (false);
CREATE POLICY "Authenticated kelola dokumen tenant"
  ON public.dokumen_publik_rt
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

DROP POLICY IF EXISTS "Publik baca kontak darurat aktif" ON public.kontak_darurat_rt;
DROP POLICY IF EXISTS "Anon tidak dapat membaca kontak" ON public.kontak_darurat_rt;
DROP POLICY IF EXISTS "Authenticated kelola kontak tenant" ON public.kontak_darurat_rt;
CREATE POLICY "Publik baca kontak darurat aktif"
  ON public.kontak_darurat_rt
  FOR SELECT TO anon
  USING (false);
CREATE POLICY "Authenticated kelola kontak tenant"
  ON public.kontak_darurat_rt
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE
  ON TABLE
    public.galeri_kegiatan,
    public.dokumen_publik_rt,
    public.kontak_darurat_rt
  FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE
    public.galeri_kegiatan,
    public.dokumen_publik_rt,
    public.kontak_darurat_rt
  TO authenticated;

DROP POLICY IF EXISTS "Bebas baca laporan posyandu" ON public.laporan_posyandu;
DROP POLICY IF EXISTS "Bebas tambah laporan posyandu" ON public.laporan_posyandu;
CREATE POLICY "Pengurus baca laporan posyandu"
  ON public.laporan_posyandu
  FOR SELECT TO authenticated
  USING ((SELECT public.adalah_pengurus()));

DROP POLICY IF EXISTS "Akses publik untuk sesi pemilihan" ON public.pemilihan_rt;
CREATE POLICY "Pengurus baca sesi pemilihan"
  ON public.pemilihan_rt
  FOR SELECT TO authenticated
  USING ((SELECT public.adalah_pengurus()));

DROP POLICY IF EXISTS "Akses publik untuk katalog kandidat" ON public.kandidat_rt;
CREATE POLICY "Pengurus baca katalog kandidat"
  ON public.kandidat_rt
  FOR SELECT TO authenticated
  USING ((SELECT public.adalah_pengurus()));
