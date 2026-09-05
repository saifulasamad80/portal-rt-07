-- ============================================================================
-- POSYANDU INDIVIDU — MIGRASI KEAMANAN DAN TENANT BOUNDARY
--
-- Jalankan di Supabase SQL Editor.  Fase containment sengaja dikomit lebih
-- dahulu: bila backfill/skema gagal, tabel tetap tertutup dari anon/public.
-- Service-role masih dapat dipakai oleh DAL server yang telah mengotorisasi
-- tenant; RLS tidak dimaksudkan sebagai pengganti otorisasi aplikasi tersebut.
-- ============================================================================

-- --------------------------------------------------------------------------
-- FASE 0: emergency containment (boleh dijalankan berulang/idempotent)
-- --------------------------------------------------------------------------
BEGIN;

DO $$
DECLARE
  nama_tabel TEXT;
  kebijakan RECORD;
BEGIN
  FOREACH nama_tabel IN ARRAY ARRAY[
    'kunjungan_balita', 'kunjungan_lansia',
    'posyandu_balita', 'posyandu_lansia'
  ] LOOP
    IF to_regclass(format('public.%I', nama_tabel)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', nama_tabel);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', nama_tabel);

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', nama_tabel);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', nama_tabel);
    END IF;

    -- Hapus allow-policy lama dengan nama apa pun. Kalau dibiarkan, policy
    -- permissive dapat di-OR dengan policy deny dan membuka kembali tabel.
    FOR kebijakan IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = nama_tabel
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        kebijakan.policyname,
        nama_tabel
      );
    END LOOP;

    -- Restrictive deny menjadi pagar tambahan bila privilege/policy berubah
    -- pada migrasi berikutnya. Service-role tetap bypass RLS secara desain.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false)',
      'deny_public_' || nama_tabel,
      nama_tabel
    );
  END LOOP;
END $$;

COMMIT;

-- --------------------------------------------------------------------------
-- FASE 1: bentuk tabel dan constraint (tidak mengasumsikan data lama bersih)
-- --------------------------------------------------------------------------
BEGIN;

CREATE TABLE IF NOT EXISTS public.kunjungan_balita (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  rt_id UUID,
  nama_anak TEXT NOT NULL,
  nama_ibu TEXT NOT NULL,
  tanggal_kunjungan DATE NOT NULL,
  berat_kg NUMERIC,
  tinggi_cm NUMERIC,
  imunisasi TEXT,
  catatan TEXT
);

CREATE TABLE IF NOT EXISTS public.kunjungan_lansia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  rt_id UUID,
  nama_peserta TEXT NOT NULL,
  tanggal_kunjungan DATE NOT NULL,
  tensi_darah TEXT,
  gula_darah NUMERIC,
  berat_kg NUMERIC,
  catatan TEXT
);

ALTER TABLE public.kunjungan_balita ADD COLUMN IF NOT EXISTS rt_id UUID;
ALTER TABLE public.kunjungan_lansia ADD COLUMN IF NOT EXISTS rt_id UUID;

CREATE INDEX IF NOT EXISTS idx_kunjungan_balita_rt_tanggal
  ON public.kunjungan_balita (rt_id, tanggal_kunjungan DESC);
CREATE INDEX IF NOT EXISTS idx_kunjungan_lansia_rt_tanggal
  ON public.kunjungan_lansia (rt_id, tanggal_kunjungan DESC);

-- Constraint NOT VALID tetap memeriksa INSERT/UPDATE baru, tetapi tidak
-- memblokir deployment karena rekaman lama mungkin belum dipetakan.
ALTER TABLE public.kunjungan_balita
  DROP CONSTRAINT IF EXISTS chk_kunjungan_balita_nilai;
ALTER TABLE public.kunjungan_balita
  ADD CONSTRAINT chk_kunjungan_balita_nilai CHECK (
    (berat_kg IS NULL OR (berat_kg >= 0 AND berat_kg <= 500)) AND
    (tinggi_cm IS NULL OR (tinggi_cm >= 0 AND tinggi_cm <= 300)) AND
    (char_length(COALESCE(nama_anak, '')) BETWEEN 1 AND 150) AND
    (char_length(COALESCE(nama_ibu, '')) BETWEEN 1 AND 150) AND
    (char_length(COALESCE(imunisasi, '')) <= 500) AND
    (char_length(COALESCE(catatan, '')) <= 2000)
  ) NOT VALID;

ALTER TABLE public.kunjungan_lansia
  DROP CONSTRAINT IF EXISTS chk_kunjungan_lansia_nilai;
ALTER TABLE public.kunjungan_lansia
  ADD CONSTRAINT chk_kunjungan_lansia_nilai CHECK (
    (gula_darah IS NULL OR (gula_darah >= 0 AND gula_darah <= 3000)) AND
    (berat_kg IS NULL OR (berat_kg >= 0 AND berat_kg <= 500)) AND
    (char_length(COALESCE(nama_peserta, '')) BETWEEN 1 AND 150) AND
    (char_length(COALESCE(tensi_darah, '')) <= 30) AND
    (char_length(COALESCE(catatan, '')) <= 2000)
  ) NOT VALID;

-- Tambahkan FK bila master_rt sudah tersedia. NOT VALID memungkinkan
-- operator memetakan orphan lama secara manual sebelum VALIDATE/NOT NULL.
DO $$
BEGIN
  IF to_regclass('public.master_rt') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.kunjungan_balita'::regclass
        AND conname = 'kunjungan_balita_rt_id_fkey'
    ) THEN
      ALTER TABLE public.kunjungan_balita
        ADD CONSTRAINT kunjungan_balita_rt_id_fkey
        FOREIGN KEY (rt_id) REFERENCES public.master_rt(id)
        ON DELETE RESTRICT NOT VALID;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.kunjungan_lansia'::regclass
        AND conname = 'kunjungan_lansia_rt_id_fkey'
    ) THEN
      ALTER TABLE public.kunjungan_lansia
        ADD CONSTRAINT kunjungan_lansia_rt_id_fkey
        FOREIGN KEY (rt_id) REFERENCES public.master_rt(id)
        ON DELETE RESTRICT NOT VALID;
    END IF;
  END IF;
END $$;

-- Baris lama boleh NULL selama proses pemetaan, tetapi seluruh INSERT baru
-- wajib memiliki tenant. Ini mencegah orphan baru dari jalur service-role.
CREATE OR REPLACE FUNCTION public.tolak_kunjungan_tanpa_rt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.rt_id IS NULL THEN
    RAISE EXCEPTION 'Kunjungan Posyandu wajib memiliki rt_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kunjungan_balita_wajib_rt ON public.kunjungan_balita;
CREATE TRIGGER trg_kunjungan_balita_wajib_rt
  BEFORE INSERT OR UPDATE ON public.kunjungan_balita
  FOR EACH ROW EXECUTE FUNCTION public.tolak_kunjungan_tanpa_rt();

DROP TRIGGER IF EXISTS trg_kunjungan_lansia_wajib_rt ON public.kunjungan_lansia;
CREATE TRIGGER trg_kunjungan_lansia_wajib_rt
  BEFORE INSERT OR UPDATE ON public.kunjungan_lansia
  FOR EACH ROW EXECUTE FUNCTION public.tolak_kunjungan_tanpa_rt();

-- Terapkan pagar akses sebelum commit fase skema. Ini menutup jendela bila
-- fase re-apply berikutnya gagal atau deployment terhenti di antaranya.
DO $$
DECLARE
  nama_tabel TEXT;
  kebijakan RECORD;
BEGIN
  FOREACH nama_tabel IN ARRAY ARRAY['kunjungan_balita', 'kunjungan_lansia'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', nama_tabel);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', nama_tabel);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', nama_tabel);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', nama_tabel);
    END IF;
    FOR kebijakan IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = nama_tabel
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', kebijakan.policyname, nama_tabel);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false)',
      'deny_public_' || nama_tabel,
      nama_tabel
    );
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', nama_tabel);
    END IF;
  END LOOP;
END $$;

COMMIT;

-- --------------------------------------------------------------------------
-- FASE 2: re-apply containment setelah CREATE TABLE (jika tabel baru)
-- --------------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
  nama_tabel TEXT;
  kebijakan RECORD;
BEGIN
  FOREACH nama_tabel IN ARRAY ARRAY['kunjungan_balita', 'kunjungan_lansia'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', nama_tabel);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', nama_tabel);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', nama_tabel);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', nama_tabel);
    END IF;
    FOR kebijakan IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = nama_tabel
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', kebijakan.policyname, nama_tabel);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false)',
      'deny_public_' || nama_tabel,
      nama_tabel
    );
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', nama_tabel);
    END IF;
  END LOOP;
END $$;
COMMIT;

-- POSYANDU_* adalah keluarga schema canonical yang dipakai portal saat ini.
-- Ia juga harus tertutup dari direct anon/authenticated dan menolak orphan
-- baru; cutover admin ke tabel canonical dilakukan setelah mapping legacy.
BEGIN;
DO $$
DECLARE
  nama_tabel TEXT;
  kebijakan RECORD;
BEGIN
  FOREACH nama_tabel IN ARRAY ARRAY['posyandu_balita', 'posyandu_lansia'] LOOP
    IF to_regclass(format('public.%I', nama_tabel)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', nama_tabel);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS rt_id UUID', nama_tabel);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (rt_id, tanggal_kunjungan DESC)', 'idx_' || nama_tabel || '_rt_tanggal', nama_tabel);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', nama_tabel);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', nama_tabel);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', nama_tabel);
    END IF;
    FOR kebijakan IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=nama_tabel LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', kebijakan.policyname, nama_tabel);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false)', 'deny_public_' || nama_tabel, nama_tabel);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || nama_tabel || '_wajib_rt', nama_tabel);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tolak_kunjungan_tanpa_rt()', 'trg_' || nama_tabel || '_wajib_rt', nama_tabel);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', nama_tabel);
    END IF;
  END LOOP;
END $$;
COMMIT;

-- PENTING: jangan menebak rt_id dari nama. Pemetaan baris lama harus direview
-- manual/berdasarkan bukti kepemilikan, lalu operator dapat menjalankan:
--   VALIDATE CONSTRAINT ...;
--   ALTER TABLE ... ALTER COLUMN rt_id SET NOT NULL;
