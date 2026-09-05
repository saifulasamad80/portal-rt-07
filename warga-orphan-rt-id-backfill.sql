-- Baris warisan tanpa tenant membuat reset PIN/ubah status meledak:
-- PostgREST mengirim rt_id = '' yang ditolak Postgres (uuid).
-- Hanya dijalankan jika master_rt berisi tepat satu wilayah.

BEGIN;

DO $$
DECLARE
  v_rt_id uuid;
  v_jumlah integer;
BEGIN
  SELECT COUNT(*) INTO v_jumlah FROM public.master_rt;
  IF v_jumlah <> 1 THEN
    RAISE EXCEPTION 'Backfill ditolak: master_rt berisi % wilayah, wajib tepat 1', v_jumlah;
  END IF;

  SELECT id INTO v_rt_id FROM public.master_rt LIMIT 1;
  IF v_rt_id IS NULL THEN
    RAISE EXCEPTION 'Backfill ditolak: master_rt kosong';
  END IF;

  UPDATE public.warga
     SET rt_id = v_rt_id
   WHERE rt_id IS NULL;

  UPDATE public.anggota_keluarga a
     SET rt_id = w.rt_id
    FROM public.warga w
   WHERE a.warga_id = w.id
     AND a.rt_id IS NULL
     AND w.rt_id IS NOT NULL;

  UPDATE public.anggota_keluarga
     SET rt_id = v_rt_id
   WHERE rt_id IS NULL;
END;
$$;

COMMIT;
