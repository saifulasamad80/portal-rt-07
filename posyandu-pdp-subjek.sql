-- ============================================================================
-- POSYANDU PDP — TAUTEKAN SUBJEK, ANONIMISASI, KUNCI TABEL LAMA
--
-- Kunjungan individu adalah data spesifik (kesehatan + anak). Rekam aktif
-- wajib tertaut ke kartu keluarga. Tarik izin / hapus KK menganonimkan
-- identitas; angka kunjungan RT boleh tertinggal tanpa nama.
-- Jalankan di Supabase SQL Editor. Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.kunjungan_balita
  ADD COLUMN IF NOT EXISTS warga_id UUID,
  ADD COLUMN IF NOT EXISTS anggota_id UUID,
  ADD COLUMN IF NOT EXISTS ada_imunisasi BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dianonimkan_pada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dicatat_oleh TEXT;

ALTER TABLE public.kunjungan_lansia
  ADD COLUMN IF NOT EXISTS warga_id UUID,
  ADD COLUMN IF NOT EXISTS anggota_id UUID,
  ADD COLUMN IF NOT EXISTS dianonimkan_pada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dicatat_oleh TEXT;

CREATE INDEX IF NOT EXISTS idx_kunjungan_balita_rt_warga
  ON public.kunjungan_balita (rt_id, warga_id);
CREATE INDEX IF NOT EXISTS idx_kunjungan_lansia_rt_warga
  ON public.kunjungan_lansia (rt_id, warga_id);
CREATE INDEX IF NOT EXISTS idx_kunjungan_balita_rt_imunisasi
  ON public.kunjungan_balita (rt_id, tanggal_kunjungan DESC)
  WHERE dianonimkan_pada IS NULL;

DO $$
BEGIN
  IF to_regclass('public.warga') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.kunjungan_balita'::regclass
        AND conname = 'kunjungan_balita_warga_id_fkey'
    ) THEN
      ALTER TABLE public.kunjungan_balita
        ADD CONSTRAINT kunjungan_balita_warga_id_fkey
        FOREIGN KEY (warga_id) REFERENCES public.warga(id)
        ON DELETE SET NULL NOT VALID;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.kunjungan_lansia'::regclass
        AND conname = 'kunjungan_lansia_warga_id_fkey'
    ) THEN
      ALTER TABLE public.kunjungan_lansia
        ADD CONSTRAINT kunjungan_lansia_warga_id_fkey
        FOREIGN KEY (warga_id) REFERENCES public.warga(id)
        ON DELETE SET NULL NOT VALID;
    END IF;
  END IF;

  IF to_regclass('public.anggota_keluarga') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.kunjungan_balita'::regclass
        AND conname = 'kunjungan_balita_anggota_id_fkey'
    ) THEN
      ALTER TABLE public.kunjungan_balita
        ADD CONSTRAINT kunjungan_balita_anggota_id_fkey
        FOREIGN KEY (anggota_id) REFERENCES public.anggota_keluarga(id)
        ON DELETE SET NULL NOT VALID;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.kunjungan_lansia'::regclass
        AND conname = 'kunjungan_lansia_anggota_id_fkey'
    ) THEN
      ALTER TABLE public.kunjungan_lansia
        ADD CONSTRAINT kunjungan_lansia_anggota_id_fkey
        FOREIGN KEY (anggota_id) REFERENCES public.anggota_keluarga(id)
        ON DELETE SET NULL NOT VALID;
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.kunci_kunjungan_posyandu_pdp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  ada_imun BOOLEAN;
BEGIN
  IF NEW.rt_id IS NULL THEN
    RAISE EXCEPTION 'Kunjungan Posyandu wajib memiliki rt_id';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.warga_id IS NULL THEN
      RAISE EXCEPTION 'Kunjungan Posyandu aktif wajib tertaut ke kartu keluarga';
    END IF;
    IF NEW.dianonimkan_pada IS NOT NULL THEN
      RAISE EXCEPTION 'Kunjungan baru tidak boleh langsung dianonimkan';
    END IF;
    IF TG_TABLE_NAME = 'kunjungan_balita' THEN
      NEW.ada_imunisasi := (NEW.imunisasi IS NOT NULL AND length(btrim(NEW.imunisasi)) > 0);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.warga_id IS NULL OR NEW.dianonimkan_pada IS NOT NULL THEN
    IF TG_TABLE_NAME = 'kunjungan_balita' THEN
      ada_imun := COALESCE(
        OLD.ada_imunisasi,
        (OLD.imunisasi IS NOT NULL AND length(btrim(COALESCE(OLD.imunisasi, ''))) > 0)
      );
      NEW.nama_anak := 'Anonim';
      NEW.nama_ibu := 'Anonim';
      NEW.berat_kg := NULL;
      NEW.tinggi_cm := NULL;
      NEW.imunisasi := NULL;
      NEW.ada_imunisasi := ada_imun;
    ELSIF TG_TABLE_NAME = 'kunjungan_lansia' THEN
      NEW.nama_peserta := 'Anonim';
      NEW.tensi_darah := NULL;
      NEW.gula_darah := NULL;
      NEW.berat_kg := NULL;
    END IF;
    NEW.warga_id := NULL;
    NEW.anggota_id := NULL;
    NEW.catatan := NULL;
    NEW.dianonimkan_pada := COALESCE(NEW.dianonimkan_pada, timezone('utc'::text, now()));
  ELSIF TG_TABLE_NAME = 'kunjungan_balita' THEN
    NEW.ada_imunisasi := (NEW.imunisasi IS NOT NULL AND length(btrim(NEW.imunisasi)) > 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kunjungan_balita_wajib_rt ON public.kunjungan_balita;
DROP TRIGGER IF EXISTS trg_kunjungan_lansia_wajib_rt ON public.kunjungan_lansia;
DROP TRIGGER IF EXISTS trg_kunjungan_balita_pdp ON public.kunjungan_balita;
DROP TRIGGER IF EXISTS trg_kunjungan_lansia_pdp ON public.kunjungan_lansia;

CREATE TRIGGER trg_kunjungan_balita_pdp
  BEFORE INSERT OR UPDATE ON public.kunjungan_balita
  FOR EACH ROW EXECUTE FUNCTION public.kunci_kunjungan_posyandu_pdp();

CREATE TRIGGER trg_kunjungan_lansia_pdp
  BEFORE INSERT OR UPDATE ON public.kunjungan_lansia
  FOR EACH ROW EXECUTE FUNCTION public.kunci_kunjungan_posyandu_pdp();

-- Tabel posyandu_* adalah skema kembar lama. Jangan tulis rekam baru ke sana.
CREATE OR REPLACE FUNCTION public.tolak_tulis_posyandu_lama()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'Tabel posyandu lama tertutup. Gunakan kunjungan_balita / kunjungan_lansia.';
END;
$$;

DO $$
DECLARE
  nama_tabel TEXT;
BEGIN
  FOREACH nama_tabel IN ARRAY ARRAY['posyandu_balita', 'posyandu_lansia'] LOOP
    IF to_regclass(format('public.%I', nama_tabel)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_tolak_tulis ON public.%I', nama_tabel, nama_tabel);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_tolak_tulis BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tolak_tulis_posyandu_lama()',
      nama_tabel,
      nama_tabel
    );
  END LOOP;
END $$;

-- Containment tetap: anon/authenticated tidak baca rekam individu.
DO $$
DECLARE
  nama_tabel TEXT;
  kebijakan RECORD;
BEGIN
  FOREACH nama_tabel IN ARRAY ARRAY['kunjungan_balita', 'kunjungan_lansia', 'posyandu_balita', 'posyandu_lansia'] LOOP
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
