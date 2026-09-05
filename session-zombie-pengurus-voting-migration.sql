-- ============================================================================
-- PILAR 1 + 3: PEMBUNUHAN SESI ZOMBIE, RPC ATOMIK PENGURUS, CONSTRAINT PEMILU
--
-- Jalankan file ini di Supabase SQL Editor sebagai pemilik schema. Seluruh
-- DDL berada dalam satu transaksi; kegagalan di tengah membatalkan semuanya.
--
-- 1) session_version di warga & pengurus_rt. Reset PIN/sandi menaikkan versi
--    lewat trigger, sehingga JWT lama gagal revalidasi.
-- 2) simpan_pengurus_rt: insert/update + audit dalam satu fungsi. Advisory
--    lock mencegah dua webmaster menulis email/akun yang sama bersamaan.
--    Fungsi PostgreSQL tidak boleh COMMIT sendiri (ilegal di FUNCTION, dan
--    berbahaya di connection pooler). Blok BEGIN...EXCEPTION...END di dalam
--    fungsi adalah boundary atomik: exception = rollback seluruh mutasi RPC.
--    BEGIN/COMMIT di file ini adalah transaksi migrasi.
-- 3) UNIQUE (voting_id, warga_id) pada suara_voting. Duplikat lama, bila ada,
--    dibuang dengan menyisakan suara paling awal.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.warga') IS NULL
     OR to_regclass('public.pengurus_rt') IS NULL
     OR to_regclass('public.suara_voting') IS NULL
     OR to_regclass('public.audit_log') IS NULL THEN
    RAISE EXCEPTION
      'Schema belum lengkap: warga, pengurus_rt, suara_voting, dan audit_log wajib tersedia';
  END IF;
END;
$$;

-- --------------------------------------------------------------------------
-- 1. SESSION VERSION (pembunuhan sesi zombie)
-- --------------------------------------------------------------------------
ALTER TABLE public.warga
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.pengurus_rt
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_warga_session_version'
       AND conrelid = 'public.warga'::regclass
  ) THEN
    ALTER TABLE public.warga
      ADD CONSTRAINT chk_warga_session_version CHECK (session_version >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'chk_pengurus_rt_session_version'
       AND conrelid = 'public.pengurus_rt'::regclass
  ) THEN
    ALTER TABLE public.pengurus_rt
      ADD CONSTRAINT chk_pengurus_rt_session_version CHECK (session_version >= 1);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.naikkan_session_version_kredensial()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'warga' AND NEW.pin IS DISTINCT FROM OLD.pin THEN
    NEW.session_version := COALESCE(OLD.session_version, 1) + 1;
  ELSIF TG_TABLE_NAME = 'pengurus_rt' AND NEW.password IS DISTINCT FROM OLD.password THEN
    NEW.session_version := COALESCE(OLD.session_version, 1) + 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_naikkan_session_version_warga ON public.warga;
CREATE TRIGGER tr_naikkan_session_version_warga
BEFORE UPDATE OF pin ON public.warga
FOR EACH ROW
EXECUTE FUNCTION public.naikkan_session_version_kredensial();

DROP TRIGGER IF EXISTS tr_naikkan_session_version_pengurus ON public.pengurus_rt;
CREATE TRIGGER tr_naikkan_session_version_pengurus
BEFORE UPDATE OF password ON public.pengurus_rt
FOR EACH ROW
EXECUTE FUNCTION public.naikkan_session_version_kredensial();

REVOKE ALL ON FUNCTION public.naikkan_session_version_kredensial() FROM PUBLIC;

-- --------------------------------------------------------------------------
-- 3. CONSTRAINT PEMILU (anti coblos ganda)
--    Ditempatkan sebelum RPC agar constraint ikut dalam transaksi yang sama.
-- --------------------------------------------------------------------------
DELETE FROM public.suara_voting AS ganda
 WHERE ganda.ctid IN (
   SELECT ctid
     FROM (
       SELECT ctid,
              row_number() OVER (
                PARTITION BY voting_id, warga_id
                ORDER BY created_at ASC NULLS LAST, ctid ASC
              ) AS urutan
         FROM public.suara_voting
     ) AS peringkat
    WHERE peringkat.urutan > 1
 );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.suara_voting'::regclass
       AND contype = 'u'
       AND pg_get_constraintdef(oid) = 'UNIQUE (voting_id, warga_id)'
  ) THEN
    ALTER TABLE public.suara_voting
      ADD CONSTRAINT suara_voting_voting_id_warga_id_key UNIQUE (voting_id, warga_id);
  END IF;
END;
$$;

-- --------------------------------------------------------------------------
-- 2. RPC ATOMIK PENGURUS (Carik / webmaster)
-- --------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.simpan_pengurus_rt(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.simpan_pengurus_rt(
  p_aktor_id UUID,
  p_pengurus_id UUID,
  p_nama TEXT,
  p_jabatan TEXT,
  p_email TEXT,
  p_password_hash TEXT,
  p_rt_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_aktor public.pengurus_rt%ROWTYPE;
  v_lama public.pengurus_rt%ROWTYPE;
  v_id UUID;
  v_nama TEXT;
  v_jabatan TEXT;
  v_email TEXT;
  v_password TEXT;
  v_aksi TEXT;
  v_lock TEXT;
BEGIN
  -- BEGIN di sini adalah blok PL/pgSQL (bukan transaksi bersarang).
  -- Kegagalan apapun di bawah men-ROLLBACK insert/update pengurus beserta
  -- audit_log. pg_advisory_xact_lock dilepas saat transaksi RPC selesai.
  BEGIN
    IF p_aktor_id IS NULL OR p_rt_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Identitas webmaster tidak valid';
    END IF;

    IF p_pengurus_id IS NULL AND (
         p_nama IS NULL OR p_jabatan IS NULL OR p_email IS NULL OR p_password_hash IS NULL
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Data pengurus baru tidak lengkap';
    END IF;

    IF p_pengurus_id IS NOT NULL
       AND p_nama IS NULL AND p_jabatan IS NULL AND p_email IS NULL AND p_password_hash IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Tidak ada perubahan pengurus';
    END IF;

    IF p_password_hash IS NOT NULL
       AND p_password_hash !~ '^\$2[ab]\$[0-9]{2}\$[A-Za-z0-9./]{53}$' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Hash sandi pengurus tidak sah';
    END IF;

    -- Kunci aktor dulu, lalu kunci email terurut, agar dua sesi webmaster
    -- tidak saling menunggu dalam urutan terbalik (deadlock).
    PERFORM pg_advisory_xact_lock(
      hashtextextended('pengurus-aktor:' || p_aktor_id::text, 0)
    );

    SELECT p.*
      INTO v_aktor
      FROM public.pengurus_rt AS p
     WHERE p.id = p_aktor_id
     FOR UPDATE;

    IF NOT FOUND
       OR v_aktor.level IS DISTINCT FROM 'webmaster'
       OR v_aktor.rt_id IS DISTINCT FROM p_rt_id THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Akses webmaster ditolak';
    END IF;

    IF p_pengurus_id IS NOT NULL THEN
      SELECT p.*
        INTO v_lama
        FROM public.pengurus_rt AS p
       WHERE p.id = p_pengurus_id
       FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Akun pengurus sudah tidak ada';
      END IF;
      IF v_lama.level = 'webmaster' AND v_lama.id IS DISTINCT FROM v_aktor.id THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Akun webmaster lain tidak boleh diubah lewat RPC ini';
      END IF;
    END IF;

    v_nama := left(btrim(coalesce(p_nama, v_lama.nama_lengkap, '')), 150);
    v_jabatan := left(btrim(coalesce(p_jabatan, v_lama.jabatan, '')), 100);
    v_email := lower(left(btrim(coalesce(p_email, v_lama.email, '')), 254));
    v_password := coalesce(p_password_hash, v_lama.password);

    IF v_nama = '' OR v_jabatan = ''
       OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       OR v_password IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Data pengurus tidak valid';
    END IF;

    IF p_pengurus_id IS NULL THEN
      PERFORM pg_advisory_xact_lock(hashtextextended('pengurus-email:' || v_email, 0));
    ELSE
      FOR v_lock IN
        SELECT kunci
          FROM (
            SELECT v_email AS kunci
            UNION
            SELECT lower(btrim(v_lama.email)) AS kunci
          ) AS kandidat
         WHERE kunci IS NOT NULL AND kunci <> ''
         ORDER BY kunci
      LOOP
        PERFORM pg_advisory_xact_lock(hashtextextended('pengurus-email:' || v_lock, 0));
      END LOOP;
    END IF;

    IF p_pengurus_id IS NULL THEN
      INSERT INTO public.pengurus_rt (
        nama_lengkap, jabatan, email, username, password, rt_id, level, session_version
      ) VALUES (
        v_nama, v_jabatan, v_email, v_email, v_password, v_aktor.rt_id, 'rt', 1
      )
      RETURNING id INTO v_id;
      v_aksi := 'Registrasi Pengurus Baru';
    ELSE
      UPDATE public.pengurus_rt
         SET nama_lengkap = v_nama,
             jabatan = v_jabatan,
             email = v_email,
             username = v_email,
             password = v_password
       WHERE id = p_pengurus_id
      RETURNING id INTO v_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Akun pengurus berubah saat disimpan';
      END IF;

      v_aksi := CASE
        WHEN p_password_hash IS NOT NULL THEN 'Reset Paksa Password Pengurus'
        ELSE 'Ubah Data Pengurus'
      END;
    END IF;

    INSERT INTO public.audit_log (aktor, aksi, tabel_target, detail, rt_id)
    VALUES (
      left(coalesce(v_aktor.nama_lengkap, 'webmaster'), 150),
      v_aksi,
      'pengurus_rt',
      left(
        CASE
          WHEN p_pengurus_id IS NULL THEN
            'Memberikan akses admin kepada ' || v_nama || ' (' || v_jabatan || ')'
          WHEN p_password_hash IS NOT NULL THEN
            'Merubah password milik: ' || v_nama
          ELSE
            'Memperbarui data pengurus: ' || v_nama
        END,
        2000
      ),
      v_aktor.rt_id
    );

    RETURN v_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Email atau username pengurus sudah terpakai';
    WHEN foreign_key_violation THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Wilayah RT pengurus tidak valid';
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.simpan_pengurus_rt(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC;

DO $$
DECLARE
  v_signature RECORD;
BEGIN
  FOR v_signature IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS identity_arguments
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'simpan_pengurus_rt'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC',
      v_signature.schema_name,
      v_signature.function_name,
      v_signature.identity_arguments
    );
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon',
        v_signature.schema_name,
        v_signature.function_name,
        v_signature.identity_arguments
      );
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM authenticated',
        v_signature.schema_name,
        v_signature.function_name,
        v_signature.identity_arguments
      );
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.simpan_pengurus_rt(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID)
      TO service_role;
  END IF;
END;
$$;

COMMIT;
