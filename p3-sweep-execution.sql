-- P3 sweep: M1 suara_voting SELECT, M2 kas_rt privasi intra-RT,
-- M3 RPC aksi_izinkan_revisi atomik, M8 REVOKE SELECT view dari anon.
BEGIN;

-- ---------------------------------------------------------------------------
-- M1 — Warga terautentikasi hanya SELECT suara miliknya sendiri (plus tenant).
-- Policy pengurus "Pengurus baca suara RT sendiri" tetap; PERMISSIVE OR.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Warga baca suara sendiri" ON public.suara_voting;
CREATE POLICY "Warga baca suara sendiri"
  ON public.suara_voting
  FOR SELECT
  TO authenticated
  USING (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  );

-- ---------------------------------------------------------------------------
-- M2 — Warga hanya melihat kas milik sendiri atau kas publik RT (warga_id NULL).
-- DROP policy lama yang memakai rt_id saja (OR permissive akan meniadakan yang ketat).
-- Policy pengurus "Admin kelola kas RT-nya sendiri" tidak diubah.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Warga lihat data kas di RT-nya sendiri" ON public.kas_rt;
DROP POLICY IF EXISTS "Warga dapat melihat riwayat kas sendiri" ON public.kas_rt;
CREATE POLICY "Warga lihat data kas di RT-nya sendiri"
  ON public.kas_rt
  FOR SELECT
  TO authenticated
  USING (
    rt_id = (SELECT public.dapatkan_rt_id_saya())
    AND (
      warga_id = (SELECT auth.uid())
      OR warga_id IS NULL
    )
  );

-- ---------------------------------------------------------------------------
-- M3 — Satu RPC = satu transaksi PostgREST. RAISE membatalkan cap + tiket.
-- SECURITY INVOKER: RLS tetap berlaku. Warga authenticated diblokir di badan.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aksi_izinkan_revisi(
  p_laporan_id uuid,
  p_aktor text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tiket public.laporan_warga%ROWTYPE;
  v_cap_id uuid;
  v_status_cap text;
  v_aktor text := left(btrim(coalesce(p_aktor, '')), 150);
  v_rt_sesi uuid := public.dapatkan_rt_id_saya();
BEGIN
  IF p_laporan_id IS NULL THEN
    RAISE EXCEPTION 'Tiket tidak valid.' USING ERRCODE = '22023';
  END IF;

  IF NOT (public.adalah_pengurus() OR public.adalah_webmaster()) THEN
    RAISE EXCEPTION 'Akses ditolak.' USING ERRCODE = '42501';
  END IF;

  IF v_rt_sesi IS NULL THEN
    RAISE EXCEPTION 'Laporan tidak berada dalam cakupan RT Anda.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tiket
    FROM public.laporan_warga
   WHERE id = p_laporan_id
     AND rt_id = v_rt_sesi
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Laporan tidak berada dalam cakupan RT Anda.' USING ERRCODE = '42501';
  END IF;

  IF btrim(coalesce(v_tiket.judul_laporan, ''))
       <> 'Permohonan perubahan data keluarga' THEN
    RAISE EXCEPTION 'Izinkan Revisi hanya untuk tiket data keluarga.' USING ERRCODE = '22023';
  END IF;

  IF coalesce(v_tiket.status, 'Menunggu') NOT IN ('Menunggu', 'Diproses') THEN
    RAISE EXCEPTION 'Tiket ini sudah ditutup.' USING ERRCODE = '22023';
  END IF;

  IF v_tiket.warga_id IS NULL THEN
    RAISE EXCEPTION 'Pemilik tiket tidak valid.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.warga AS w
     WHERE w.id = v_tiket.warga_id
       AND w.rt_id = v_tiket.rt_id
  ) THEN
    RAISE EXCEPTION 'Pemilik tiket tidak berada dalam cakupan RT tiket.' USING ERRCODE = '42501';
  END IF;

  SELECT s.id, s.status_validasi
    INTO v_cap_id, v_status_cap
    FROM public.sensus_kesejahteraan AS s
   WHERE s.warga_id = v_tiket.warga_id
     AND s.rt_id = v_tiket.rt_id
   FOR UPDATE;

  IF v_cap_id IS NULL THEN
    RAISE EXCEPTION 'Cap verifikasi keluarga tidak dapat dibuka. Muat ulang halaman.' USING ERRCODE = '22023';
  END IF;

  IF v_status_cap = 'Disetujui' THEN
    UPDATE public.sensus_kesejahteraan
       SET status_validasi = 'Menunggu'
     WHERE id = v_cap_id
       AND status_validasi = 'Disetujui';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cap verifikasi belum dapat dibuka. Coba lagi nanti.' USING ERRCODE = '40001';
    END IF;
  ELSIF v_status_cap <> 'Menunggu' THEN
    RAISE EXCEPTION 'Cap verifikasi keluarga tidak dapat dibuka. Muat ulang halaman.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.laporan_warga
     SET status = 'Selesai',
         tanggapan_rt = 'Revisi data keluarga diizinkan. Warga dapat mengisi ulang form Carik. NIK tetap terkunci.'
   WHERE id = v_tiket.id
     AND rt_id = v_tiket.rt_id
     AND status IN ('Menunggu', 'Diproses');

  IF NOT FOUND THEN
    -- RAISE di dalam fungsi membatalkan UPDATE cap di atas (satu transaksi).
    RAISE EXCEPTION 'Revisi belum dapat diizinkan. Coba lagi nanti.' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.audit_log (aktor, aksi, tabel_target, detail, rt_id)
  VALUES (
    CASE WHEN v_aktor = '' THEN 'pengurus' ELSE v_aktor END,
    'Izinkan Revisi Data Keluarga',
    'sensus_kesejahteraan',
    'Membuka cap Carik untuk tiket ' || v_tiket.id::text || ' tanpa mengubah status akun.',
    v_tiket.rt_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Revisi diizinkan. Warga dapat mengoreksi data di form Carik.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.aksi_izinkan_revisi(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aksi_izinkan_revisi(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- M8 — View security_invoker tidak boleh dibaca anon lewat Data API.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.v_warga_masked FROM anon;
REVOKE SELECT ON public.v_rekap_kas_rt FROM anon;
REVOKE SELECT ON public.v_saldo_sampah_warga FROM anon;
REVOKE SELECT ON public.v_saldo_kurban_warga FROM anon;
REVOKE SELECT ON public.v_rekapitulasi_suara_pemilu FROM anon;

COMMIT;
