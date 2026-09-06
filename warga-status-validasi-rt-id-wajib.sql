-- ======================================================================================
-- Restrukturisasi registrasi publik: validasi pendaftaran + isolasi tenant
--
-- Fakta skema produksi (bukan tebakan):
--   * Tabel warga SUDAH punya status_verifikasi VARCHAR default 'Menunggu'
--     dengan CHECK (Menunggu | Disetujui | Ditolak).
--   * Kolom status_validasi TIDAK ada. Nama itu dipakai di sensus_kesejahteraan.
--   * rt_id masih is_nullable = YES meskipun FK ke master_rt sudah ada.
--
-- Dilarang menambah status_validasi sebagai kolom TULIS terpisah:
--   ADD COLUMN status_validasi VARCHAR DEFAULT 'Menunggu' akan menandai
--   seluruh KK yang sudah Disetujui sebagai Menunggu, lalu filter Buku Induk
--   mengosongkan buku. Dual-write dengan status_verifikasi juga akan drift
--   (login/portal memakai status_verifikasi, Buku Induk memakai nama baru).
--
-- Solusi: alias GENERATED ALWAYS dari status_verifikasi, default tetap di
-- kolom kanonik. Insert registrasi cukup mengisi status_verifikasi.
-- ======================================================================================

BEGIN;

-- 1) Kunci kolom kanonik: tidak boleh NULL, default pendaftar publik = Menunggu.
UPDATE public.warga
   SET status_verifikasi = 'Menunggu'
 WHERE status_verifikasi IS NULL
    OR btrim(status_verifikasi) = '';

ALTER TABLE public.warga
  ALTER COLUMN status_verifikasi SET DEFAULT 'Menunggu',
  ALTER COLUMN status_verifikasi SET NOT NULL;

ALTER TABLE public.warga
  DROP CONSTRAINT IF EXISTS warga_status_verifikasi_check;

ALTER TABLE public.warga
  ADD CONSTRAINT warga_status_verifikasi_check
  CHECK (status_verifikasi IN ('Menunggu', 'Disetujui', 'Ditolak'));

-- 2) Alias yang diminta forensik. Tidak bisa di-INSERT/UPDATE langsung.
ALTER TABLE public.warga
  ADD COLUMN IF NOT EXISTS status_validasi character varying(20)
  GENERATED ALWAYS AS (status_verifikasi) STORED;

COMMENT ON COLUMN public.warga.status_verifikasi IS
  'Status validasi akun. Kanonik untuk tulis. Default Menunggu.';
COMMENT ON COLUMN public.warga.status_validasi IS
  'Alias generated dari status_verifikasi. Pakai untuk filter Buku Induk.';

-- 3) Tenant wajib. Backfill hanya aman jika tepat satu wilayah di master_rt.
DO $$
DECLARE
  v_rt_id uuid;
  v_jumlah integer;
  v_yatim integer;
BEGIN
  SELECT COUNT(*) INTO v_yatim FROM public.warga WHERE rt_id IS NULL;
  IF v_yatim = 0 THEN
    NULL;
  ELSE
    SELECT COUNT(*) INTO v_jumlah FROM public.master_rt;
    IF v_jumlah <> 1 THEN
      RAISE EXCEPTION
        'rt_id yatim=% baris, master_rt berisi % wilayah. Backfill otomatis ditolak.',
        v_yatim, v_jumlah;
    END IF;
    SELECT id INTO v_rt_id FROM public.master_rt LIMIT 1;
    IF v_rt_id IS NULL THEN
      RAISE EXCEPTION 'Backfill ditolak: master_rt kosong';
    END IF;
    UPDATE public.warga SET rt_id = v_rt_id WHERE rt_id IS NULL;
    UPDATE public.anggota_keluarga SET rt_id = v_rt_id WHERE rt_id IS NULL;
  END IF;
END;
$$;

UPDATE public.anggota_keluarga a
   SET rt_id = w.rt_id
  FROM public.warga w
 WHERE a.warga_id = w.id
   AND a.rt_id IS NULL
   AND w.rt_id IS NOT NULL;

ALTER TABLE public.warga
  ALTER COLUMN rt_id SET NOT NULL;

ALTER TABLE public.anggota_keluarga
  ALTER COLUMN rt_id SET NOT NULL;

-- 4) Kode rujukan publik untuk /register?rt=... (bukan UUID mentah di URL).
ALTER TABLE public.master_rt
  ADD COLUMN IF NOT EXISTS kode_rujukan text;

UPDATE public.master_rt
   SET kode_rujukan = lower(regexp_replace(coalesce(nama_rt, ''), '[^a-zA-Z0-9]+', '', 'g'))
 WHERE kode_rujukan IS NULL
    OR btrim(kode_rujukan) = '';

ALTER TABLE public.master_rt
  ALTER COLUMN kode_rujukan SET NOT NULL;

ALTER TABLE public.master_rt
  DROP CONSTRAINT IF EXISTS master_rt_kode_rujukan_chk;

ALTER TABLE public.master_rt
  ADD CONSTRAINT master_rt_kode_rujukan_chk
  CHECK (kode_rujukan ~ '^[a-z0-9][a-z0-9-]{1,31}$');

CREATE UNIQUE INDEX IF NOT EXISTS master_rt_kode_rujukan_uidx
  ON public.master_rt (kode_rujukan);

-- 5) Indeks sesuai pola query: Buku Induk (Disetujui) dan antrean (Menunggu).
CREATE INDEX IF NOT EXISTS idx_warga_buku_induk_sah
  ON public.warga (rt_id, created_at DESC)
  WHERE status_verifikasi = 'Disetujui';

CREATE INDEX IF NOT EXISTS idx_warga_antrean_validasi
  ON public.warga (rt_id, created_at)
  WHERE status_verifikasi = 'Menunggu';

-- RPC warisan: jangan ambil rt_id sembarang pengurus, dan wajib isi anggota.rt_id.
CREATE OR REPLACE FUNCTION public.register_warga_baru(p_kepala_keluarga jsonb, p_anggota_keluarga jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_warga_id uuid;
  v_anggota jsonb;
  v_rt_id uuid;
BEGIN
  RAISE EXCEPTION 'register_warga_baru dinonaktifkan. Gunakan Server Action /register yang mengikat rt_id dari tautan rujukan atau REGISTRATION_RT_ID.';
END;
$function$;

REVOKE ALL ON FUNCTION public.register_warga_baru(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;
