-- H1 containment: block only the public anon role.
-- Authenticated dashboard access is explicitly retained per tenant.
BEGIN;

ALTER TABLE public.galeri_kegiatan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dokumen_publik_rt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kontak_darurat_rt ENABLE ROW LEVEL SECURITY;

-- The old policies target both anon and authenticated, so they must be
-- replaced with separate role-scoped policies rather than altered in place.
DROP POLICY IF EXISTS "Publik baca galeri terbit" ON public.galeri_kegiatan;
DROP POLICY IF EXISTS "Publik baca dokumen terbit" ON public.dokumen_publik_rt;
DROP POLICY IF EXISTS "Publik baca kontak darurat aktif" ON public.kontak_darurat_rt;
DROP POLICY IF EXISTS "Anon tidak dapat membaca galeri" ON public.galeri_kegiatan;
DROP POLICY IF EXISTS "Anon tidak dapat membaca dokumen" ON public.dokumen_publik_rt;
DROP POLICY IF EXISTS "Anon tidak dapat membaca kontak" ON public.kontak_darurat_rt;
DROP POLICY IF EXISTS "Authenticated kelola galeri tenant" ON public.galeri_kegiatan;
DROP POLICY IF EXISTS "Authenticated kelola dokumen tenant" ON public.dokumen_publik_rt;
DROP POLICY IF EXISTS "Authenticated kelola kontak tenant" ON public.kontak_darurat_rt;

-- No Data API table privileges for the public key.
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE
  ON TABLE
    public.galeri_kegiatan,
    public.dokumen_publik_rt,
    public.kontak_darurat_rt
  FROM anon;

-- Keep the dashboard's table privileges. RLS below remains the authorization
-- boundary for reads and writes by authenticated sessions.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE
    public.galeri_kegiatan,
    public.dokumen_publik_rt,
    public.kontak_darurat_rt
  TO authenticated;

-- Defense in depth: even if a table grant is restored later, anon remains
-- fail-closed at the RLS layer.
CREATE POLICY "Anon tidak dapat membaca galeri"
  ON public.galeri_kegiatan
  FOR SELECT TO anon
  USING (false);

CREATE POLICY "Anon tidak dapat membaca dokumen"
  ON public.dokumen_publik_rt
  FOR SELECT TO anon
  USING (false);

CREATE POLICY "Anon tidak dapat membaca kontak"
  ON public.kontak_darurat_rt
  FOR SELECT TO anon
  USING (false);

-- Restore authenticated dashboard access under tenant-aware controls.
CREATE POLICY "Authenticated kelola galeri tenant"
  ON public.galeri_kegiatan
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

CREATE POLICY "Authenticated kelola dokumen tenant"
  ON public.dokumen_publik_rt
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

CREATE POLICY "Authenticated kelola kontak tenant"
  ON public.kontak_darurat_rt
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

COMMIT;
