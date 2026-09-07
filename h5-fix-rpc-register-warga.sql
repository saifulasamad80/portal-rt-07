-- H5: register_warga_baru tidak boleh memilih tenant dengan LIMIT 1.
-- Overload 2 argumen (jsonb, jsonb) ditutup. Overload sah wajib p_rt_id
-- dan men-resolve tenant lewat PK master_rt, bukan baris pengurus acak.
BEGIN;

CREATE OR REPLACE FUNCTION public.register_warga_baru(
  p_kepala_keluarga jsonb,
  p_anggota_keluarga jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION
    'register_warga_baru(jsonb, jsonb) ditolak. Wajib p_rt_id uuid eksplisit.';
END;
$function$;

DROP FUNCTION IF EXISTS public.register_warga_baru(jsonb, jsonb, uuid);

CREATE FUNCTION public.register_warga_baru(
  p_kepala_keluarga jsonb,
  p_anggota_keluarga jsonb,
  p_rt_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_warga_id uuid;
  v_rt_id uuid;
  v_anggota jsonb;
BEGIN
  IF p_rt_id IS NULL THEN
    RAISE EXCEPTION 'p_rt_id wajib diisi. Pendaftaran tidak boleh memilih tenant sendiri.';
  END IF;

  IF p_kepala_keluarga IS NULL OR jsonb_typeof(p_kepala_keluarga) <> 'object' THEN
    RAISE EXCEPTION 'p_kepala_keluarga wajib berupa objek JSON.';
  END IF;

  IF p_anggota_keluarga IS NOT NULL AND jsonb_typeof(p_anggota_keluarga) <> 'array' THEN
    RAISE EXCEPTION 'p_anggota_keluarga wajib berupa array JSON.';
  END IF;

  SELECT m.id
    INTO STRICT v_rt_id
    FROM public.master_rt AS m
   WHERE m.id = p_rt_id;

  INSERT INTO public.warga (
    nik, nama_lengkap, no_whatsapp, pin, status_tinggal, detail_alamat,
    tanggal_lahir, tempat_lahir, jenis_kelamin, agama, pekerjaan,
    pendapatan_bulanan, daya_listrik, ktp_path, kk_path, status_verifikasi, rt_id
  ) VALUES (
    p_kepala_keluarga->>'nik',
    p_kepala_keluarga->>'nama_lengkap',
    p_kepala_keluarga->>'no_whatsapp',
    p_kepala_keluarga->>'pin',
    p_kepala_keluarga->>'status_tinggal',
    p_kepala_keluarga->>'detail_alamat',
    (p_kepala_keluarga->>'tanggal_lahir')::date,
    p_kepala_keluarga->>'tempat_lahir',
    p_kepala_keluarga->>'jenis_kelamin',
    p_kepala_keluarga->>'agama',
    p_kepala_keluarga->>'pekerjaan',
    p_kepala_keluarga->>'pendapatan_bulanan',
    p_kepala_keluarga->>'daya_listrik',
    p_kepala_keluarga->>'ktp_path',
    p_kepala_keluarga->>'kk_path',
    'Menunggu',
    v_rt_id
  )
  RETURNING id INTO v_warga_id;

  IF p_anggota_keluarga IS NOT NULL AND jsonb_array_length(p_anggota_keluarga) > 0 THEN
    FOR v_anggota IN SELECT * FROM jsonb_array_elements(p_anggota_keluarga)
    LOOP
      INSERT INTO public.anggota_keluarga (
        warga_id, rt_id, nik, nama_lengkap, hubungan_keluarga, hubungan_detail,
        tanggal_lahir, tempat_lahir, jenis_kelamin, agama, pekerjaan, ktp_path
      ) VALUES (
        v_warga_id,
        v_rt_id,
        v_anggota->>'nik',
        v_anggota->>'nama_lengkap',
        v_anggota->>'hubungan_keluarga',
        v_anggota->>'hubungan_detail',
        (v_anggota->>'tanggal_lahir')::date,
        v_anggota->>'tempat_lahir',
        v_anggota->>'jenis_kelamin',
        v_anggota->>'agama',
        v_anggota->>'pekerjaan',
        v_anggota->>'ktp_path'
      );
    END LOOP;
  END IF;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION 'p_rt_id tidak terdaftar di master_rt.';
  WHEN TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'p_rt_id tidak unik di master_rt.';
END;
$function$;

REVOKE ALL ON FUNCTION public.register_warga_baru(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_warga_baru(jsonb, jsonb, uuid) FROM PUBLIC;

DO $$
DECLARE
  v_fn record;
  v_role text;
BEGIN
  FOR v_fn IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS identity_arguments
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'register_warga_baru'
  LOOP
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
        EXECUTE format(
          'REVOKE ALL ON FUNCTION %I.%I(%s) FROM %I',
          v_fn.schema_name,
          v_fn.function_name,
          v_fn.identity_arguments,
          v_role
        );
      END IF;
    END LOOP;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.register_warga_baru(jsonb, jsonb) FROM service_role;
    GRANT EXECUTE ON FUNCTION public.register_warga_baru(jsonb, jsonb, uuid) TO service_role;
  END IF;
END;
$$;

DO $$
DECLARE
  v_bahaya integer;
  v_sah integer;
BEGIN
  SELECT COUNT(*) INTO v_bahaya
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'register_warga_baru'
     AND pg_get_function_identity_arguments(p.oid) NOT ILIKE '%p_rt_id%';

  IF v_bahaya <> 1 THEN
    RAISE EXCEPTION 'H5: stub tanpa p_rt_id harus tepat 1, ketemu %', v_bahaya;
  END IF;

  SELECT COUNT(*) INTO v_sah
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'register_warga_baru'
     AND pg_get_function_identity_arguments(p.oid) ILIKE '%p_rt_id%';

  IF v_sah <> 1 THEN
    RAISE EXCEPTION 'H5: overload dengan p_rt_id harus tepat 1, ketemu %', v_sah;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'register_warga_baru'
       AND pg_get_functiondef(p.oid) ILIKE '%FROM pengurus_rt%LIMIT 1%'
  ) THEN
    RAISE EXCEPTION 'H5: logika LIMIT 1 pada pengurus_rt masih ada';
  END IF;
END;
$$;

COMMIT;
