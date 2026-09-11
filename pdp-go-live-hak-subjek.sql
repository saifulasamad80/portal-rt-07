-- PDP go-live: izin kesehatan, penarikan, TTL kotak sampah, snapshot tanpa PIN.

ALTER TABLE public.persetujuan_data_warga
  ADD COLUMN IF NOT EXISTS data_kesehatan boolean NOT NULL DEFAULT false;

ALTER TABLE public.persetujuan_data_warga
  DROP CONSTRAINT IF EXISTS persetujuan_data_warga_sumber_check;

ALTER TABLE public.persetujuan_data_warga
  ADD CONSTRAINT persetujuan_data_warga_sumber_check
  CHECK (sumber IN ('lapor_diri', 'carik', 'kertas', 'portal', 'penarikan'));

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
  v_snap jsonb;
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
  v_snap := to_jsonb(OLD) - 'pin' - 'password' - 'reset_token' - 'reset_token_expires';
  IF v_snap ? 'pin' THEN
    v_snap := v_snap - 'pin';
  END IF;
  -- Kolom pin NOT NULL: simpan penanda yang gagal dipakai login.
  IF TG_TABLE_NAME = 'warga' THEN
    v_snap := jsonb_set(v_snap, '{pin}', to_jsonb('PDP_PIN_DIHAPUS'::text), true);
  END IF;

  INSERT INTO public.kotak_sampah (
    rt_id, tabel_asal, baris_id, bundel_id, nama_tampil, snapshot, alasan, aktor
  ) VALUES (
    v_rt,
    TG_TABLE_NAME,
    OLD.id,
    v_bundel,
    v_nama,
    v_snap,
    NULLIF(current_setting('app.kotak_sampah_alasan', true), ''),
    NULLIF(current_setting('app.kotak_sampah_aktor', true), '')
  );

  RETURN OLD;
END;
$$;

UPDATE public.kotak_sampah
   SET snapshot = (snapshot - 'password' - 'reset_token' - 'reset_token_expires')
                 || jsonb_build_object('pin', 'PDP_PIN_DIHAPUS')
 WHERE tabel_asal = 'warga'
   AND (
     snapshot ? 'password'
     OR snapshot ? 'reset_token'
     OR (
       snapshot ? 'pin'
       AND coalesce(snapshot->>'pin', '') NOT IN ('PDP_PIN_DIHAPUS', '')
       AND length(coalesce(snapshot->>'pin', '')) > 20
     )
   );

CREATE OR REPLACE FUNCTION public.hapus_kotak_sampah_kedaluwarsa(
  p_rt_id uuid,
  p_hari integer DEFAULT 30
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_n integer := 0;
BEGIN
  IF p_rt_id IS NULL OR p_hari IS NULL OR p_hari < 1 OR p_hari > 365 THEN
    RAISE EXCEPTION 'Parameter TTL kotak sampah tidak valid' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.kotak_sampah
   WHERE rt_id = p_rt_id
     AND dihapus_pada < (now() - make_interval(days => p_hari));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.hapus_kotak_sampah_kedaluwarsa(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hapus_kotak_sampah_kedaluwarsa(uuid, integer)
  TO postgres, service_role;
