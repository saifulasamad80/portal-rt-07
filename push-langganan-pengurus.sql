-- ======================================================================================
-- Langganan Web Push untuk pengurus RT
-- Jalankan sekali di Supabase Dashboard → SQL Editor → Run
--
-- Tanpa kolom pengurus_id, antrean Verifikasi Pendaftaran tidak bisa
-- mengetuk HP pengurus: push_langganan hanya merujuk warga(id).
-- ======================================================================================

BEGIN;

ALTER TABLE public.push_langganan
  ALTER COLUMN warga_id DROP NOT NULL;

ALTER TABLE public.push_langganan
  ADD COLUMN IF NOT EXISTS pengurus_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'push_langganan_pengurus_id_fkey'
  ) THEN
    ALTER TABLE public.push_langganan
      ADD CONSTRAINT push_langganan_pengurus_id_fkey
      FOREIGN KEY (pengurus_id) REFERENCES public.pengurus_rt(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.push_langganan
  DROP CONSTRAINT IF EXISTS push_langganan_pemilik_wajib;
ALTER TABLE public.push_langganan
  ADD CONSTRAINT push_langganan_pemilik_wajib
  CHECK (warga_id IS NOT NULL OR pengurus_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_push_langganan_pengurus
  ON public.push_langganan (rt_id, pengurus_id);

CREATE OR REPLACE FUNCTION public.kunci_rt_id_dari_push()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rt_warga uuid;
  v_rt_pengurus uuid;
  v_milik uuid;
BEGIN
  IF NEW.warga_id IS NULL AND NEW.pengurus_id IS NULL THEN
    RAISE EXCEPTION 'Langganan push wajib punya warga_id atau pengurus_id';
  END IF;

  IF NEW.warga_id IS NOT NULL THEN
    SELECT w.rt_id INTO v_rt_warga
      FROM public.warga AS w
     WHERE w.id = NEW.warga_id;
    IF v_rt_warga IS NULL THEN
      RAISE EXCEPTION 'Wilayah warga tidak valid; rt_id wajib ada di induk';
    END IF;
  END IF;

  IF NEW.pengurus_id IS NOT NULL THEN
    SELECT p.rt_id INTO v_rt_pengurus
      FROM public.pengurus_rt AS p
     WHERE p.id = NEW.pengurus_id;
    IF v_rt_pengurus IS NULL THEN
      RAISE EXCEPTION 'Wilayah pengurus tidak valid; rt_id wajib ada di induk';
    END IF;
  END IF;

  IF v_rt_warga IS NOT NULL
     AND v_rt_pengurus IS NOT NULL
     AND v_rt_warga IS DISTINCT FROM v_rt_pengurus THEN
    RAISE EXCEPTION 'Langganan push tidak boleh menautkan warga dan pengurus beda RT';
  END IF;

  v_milik := COALESCE(v_rt_warga, v_rt_pengurus);

  IF NEW.rt_id IS NULL THEN
    NEW.rt_id := v_milik;
  ELSIF NEW.rt_id IS DISTINCT FROM v_milik THEN
    RAISE EXCEPTION 'rt_id baris tidak sama dengan wilayah pemilik langganan';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.master_rt AS m WHERE m.id = NEW.rt_id) THEN
    RAISE EXCEPTION 'rt_id tidak terdaftar di master_rt';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kunci_rt_push ON public.push_langganan;
CREATE TRIGGER trg_kunci_rt_push
  BEFORE INSERT OR UPDATE ON public.push_langganan
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_push();

REVOKE ALL ON FUNCTION public.kunci_rt_id_dari_push() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Pengurus kelola langganan push sendiri" ON public.push_langganan;
CREATE POLICY "Pengurus kelola langganan push sendiri"
  ON public.push_langganan
  FOR ALL TO authenticated
  USING (
    pengurus_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
    AND (SELECT public.adalah_pengurus())
  )
  WITH CHECK (
    pengurus_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
    AND (SELECT public.adalah_pengurus())
  );

COMMIT;
