-- ======================================================================================
-- Kotak sampah warga & anggota keluarga (recycle bin)
-- Hapus baris tidak langsung hilang: salinan masuk kotak_sampah dulu.
-- Pulihkan lewat halaman /admin/kotak-sampah. Jangan SET session_replication_role
-- = replica saat menghapus warga — itu melewati trigger ini.
-- Arsip pemilu memanggil hapus_anggota_tanpa_kotak_sampah() agar tanggungan
-- dilepas tanpa masuk recycle bin (set_config app.kotak_sampah_lewati).
-- ======================================================================================

CREATE TABLE IF NOT EXISTS public.kotak_sampah (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id uuid NOT NULL REFERENCES public.master_rt(id),
  tabel_asal text NOT NULL,
  baris_id uuid NOT NULL,
  bundel_id uuid NOT NULL,
  nama_tampil text,
  snapshot jsonb NOT NULL,
  alasan text,
  aktor text,
  dihapus_pada timestamptz NOT NULL DEFAULT now(),
  dipulihkan_pada timestamptz,
  dipulihkan_oleh text,
  CONSTRAINT kotak_sampah_tabel_asal_chk
    CHECK (tabel_asal IN ('warga', 'anggota_keluarga'))
);

CREATE INDEX IF NOT EXISTS idx_kotak_sampah_rt_aktif
  ON public.kotak_sampah (rt_id, dipulihkan_pada, dihapus_pada DESC);

CREATE INDEX IF NOT EXISTS idx_kotak_sampah_bundel
  ON public.kotak_sampah (bundel_id, dihapus_pada DESC);

COMMENT ON TABLE public.kotak_sampah IS
  'Salinan baris warga/anggota_keluarga sebelum DELETE. Bukan arsip pemilu.';

ALTER TABLE public.kotak_sampah ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.kotak_sampah FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kotak_sampah TO service_role;

DROP POLICY IF EXISTS "kotak_sampah tolak klien publik" ON public.kotak_sampah;
CREATE POLICY "kotak_sampah tolak klien publik"
  ON public.kotak_sampah
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.tangkap_ke_kotak_sampah()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rt uuid;
  v_bundel uuid;
  v_nama text;
BEGIN
  IF current_setting('app.kotak_sampah_lewati', true) IN ('1', 'true', 'on') THEN
    RETURN OLD;
  END IF;

  v_rt := OLD.rt_id;
  IF v_rt IS NULL THEN
    RAISE EXCEPTION 'kotak_sampah: rt_id wajib sebelum menghapus %.', TG_TABLE_NAME
      USING ERRCODE = 'not_null_violation';
  END IF;

  IF TG_TABLE_NAME = 'warga' THEN
    v_bundel := OLD.id;
  ELSE
    v_bundel := COALESCE(OLD.warga_id, OLD.id);
  END IF;

  v_nama := NULLIF(btrim(COALESCE(OLD.nama_lengkap, '')), '');

  INSERT INTO public.kotak_sampah (
    rt_id, tabel_asal, baris_id, bundel_id, nama_tampil, snapshot, alasan, aktor
  ) VALUES (
    v_rt,
    TG_TABLE_NAME,
    OLD.id,
    v_bundel,
    v_nama,
    to_jsonb(OLD),
    NULLIF(current_setting('app.kotak_sampah_alasan', true), ''),
    NULLIF(current_setting('app.kotak_sampah_aktor', true), '')
  );

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.tangkap_ke_kotak_sampah() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tangkap_ke_kotak_sampah() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_kotak_sampah_warga ON public.warga;
CREATE TRIGGER trg_kotak_sampah_warga
  BEFORE DELETE ON public.warga
  FOR EACH ROW
  EXECUTE FUNCTION public.tangkap_ke_kotak_sampah();

DROP TRIGGER IF EXISTS trg_kotak_sampah_anggota ON public.anggota_keluarga;
CREATE TRIGGER trg_kotak_sampah_anggota
  BEFORE DELETE ON public.anggota_keluarga
  FOR EACH ROW
  EXECUTE FUNCTION public.tangkap_ke_kotak_sampah();

-- Dipakai hanya saat arsip pemilu: tanggungan dilepas bersama data personal KK,
-- bukan disimpan untuk dipulihkan. SET LOCAL di dalam fungsi ini aman di pooler.
CREATE OR REPLACE FUNCTION public.hapus_anggota_tanpa_kotak_sampah(
  p_warga_id uuid,
  p_rt_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_n integer := 0;
BEGIN
  IF p_warga_id IS NULL OR p_rt_id IS NULL THEN
    RAISE EXCEPTION 'warga_id dan rt_id wajib untuk melepas tanggungan arsip pemilu'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.warga AS w
     WHERE w.id = p_warga_id
       AND w.rt_id = p_rt_id
  ) THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.kotak_sampah_lewati', '1', true);

  DELETE FROM public.anggota_keluarga AS a
   WHERE a.warga_id = p_warga_id
     AND a.rt_id = p_rt_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.hapus_anggota_tanpa_kotak_sampah(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hapus_anggota_tanpa_kotak_sampah(uuid, uuid)
  TO postgres, service_role;
