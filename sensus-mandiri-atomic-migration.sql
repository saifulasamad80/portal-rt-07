-- ============================================================================
-- ATOMIC BOUNDARY: SENSUS MANDIRI
--
-- Jalankan file ini di Supabase SQL Editor sebagai pemilik schema sebelum
-- mengaktifkan build aplikasi yang memanggil RPC di bawah. Fungsi ini sengaja
-- menjadi satu-satunya jalur service-role untuk mutasi sensus mandiri.
--
-- Masalah yang ditutup:
--   * UPDATE warga, sinkronisasi anggota, cap sensus, dan audit sebelumnya
--     berjalan sebagai beberapa request sehingga kegagalan di tengah dapat
--     meninggalkan data separuh tersimpan;
--   * preflight lalu UPDATE terpisah adalah TOCTOU: anggota dapat berpindah
--     atau berubah di antara pemeriksaan dan penghapusan;
--   * identitas warga/RT yang dikirim pemanggil tidak pernah boleh dipercaya
--     hanya karena pemanggil memakai service-role.
--
-- RPC ini mengunci kepala keluarga, mengunci konflik NIK secara advisory,
-- memvalidasi ownership di dalam transaksi, lalu menulis seluruh perubahan.
-- Jika satu langkah gagal, PostgreSQL membatalkan semuanya.
-- ============================================================================

BEGIN;

-- Prasyarat wajib: jalankan wargaku-v2-push-ibu-soft-delete.sql (atau
-- migrasi ekuivalen) lebih dulu. Migrasi ini sengaja TIDAK menambahkan
-- status_aktif dengan default true karena hal itu dapat mengaktifkan kembali
-- akun legacy yang memang sudah diarsipkan. Bila kolom belum ada, deployment
-- berhenti dan jalur RPC tetap tidak tersedia.

DO $$
DECLARE
  kolom TEXT;
BEGIN
  IF to_regclass('public.warga') IS NULL
     OR to_regclass('public.anggota_keluarga') IS NULL
     OR to_regclass('public.sensus_kesejahteraan') IS NULL
     OR to_regclass('public.audit_log') IS NULL THEN
    RAISE EXCEPTION
      'Schema sensus belum lengkap: warga, anggota_keluarga, sensus_kesejahteraan, dan audit_log wajib tersedia';
  END IF;

  FOREACH kolom IN ARRAY ARRAY[
    'id', 'nik', 'rt_id', 'status_verifikasi', 'status_aktif',
    'nama_lengkap', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin',
    'agama', 'pekerjaan', 'no_whatsapp', 'status_tinggal',
    'detail_alamat', 'pendapatan_bulanan', 'daya_listrik'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'warga'
         AND column_name = kolom
    ) THEN
      RAISE EXCEPTION 'Kolom public.warga.% wajib tersedia', kolom;
    END IF;
  END LOOP;

  FOREACH kolom IN ARRAY ARRAY[
    'id', 'warga_id', 'rt_id', 'nik', 'nama_lengkap',
    'hubungan_keluarga', 'hubungan_detail', 'tanggal_lahir',
    'tempat_lahir', 'jenis_kelamin', 'agama', 'pekerjaan'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'anggota_keluarga'
         AND column_name = kolom
    ) THEN
      RAISE EXCEPTION 'Kolom public.anggota_keluarga.% wajib tersedia', kolom;
    END IF;
  END LOOP;

  FOREACH kolom IN ARRAY ARRAY[
    'id', 'warga_id', 'status_validasi', 'catatan_tambahan',
    'ada_ibu_hamil', 'ada_disabilitas', 'ada_ibu_menyusui',
    'ada_ibu_meninggal', 'ada_bayi_meninggal', 'ada_balita_meninggal',
    'ada_bayi_baru_lahir', 'bayi_tanpa_akta', 'ada_ibu_nifas',
    'memiliki_mck', 'memiliki_tempat_sampah', 'memiliki_spal',
    'memiliki_resapan_air', 'sumber_air_utama', 'status_kesehatan_rumah',
    'jenis_makanan_pokok'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'sensus_kesejahteraan'
         AND column_name = kolom
    ) THEN
      RAISE EXCEPTION 'Kolom public.sensus_kesejahteraan.% wajib tersedia', kolom;
    END IF;
  END LOOP;

  FOREACH kolom IN ARRAY ARRAY['aktor', 'aksi', 'tabel_target', 'detail', 'rt_id'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'audit_log'
         AND column_name = kolom
    ) THEN
      RAISE EXCEPTION 'Kolom public.audit_log.% wajib tersedia', kolom;
    END IF;
  END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_sensus_kesejahteraan_warga_id
  ON public.sensus_kesejahteraan (warga_id);
CREATE INDEX IF NOT EXISTS idx_anggota_keluarga_warga_rt
  ON public.anggota_keluarga (warga_id, rt_id);
CREATE INDEX IF NOT EXISTS idx_anggota_keluarga_nik
  ON public.anggota_keluarga (nik);

-- Satu rumah tangga hanya boleh memiliki satu cap sensus. Bila data lama
-- sudah ganda, migrasi berhenti dan operator harus menyelesaikannya secara
-- manual; memilih satu baris secara acak justru dapat membuka ulang portal.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.sensus_kesejahteraan
     WHERE warga_id IS NOT NULL
     GROUP BY warga_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'sensus_kesejahteraan memiliki warga_id ganda; selesaikan manual sebelum migrasi atomik';
  END IF;
END;
$$;

DO $$
DECLARE
  v_index_oid OID;
  v_index_relid OID;
  v_is_unique BOOLEAN;
  v_key_count INTEGER;
  v_attribute_count INTEGER;
  v_key_attribute SMALLINT;
  v_has_predicate BOOLEAN;
  v_has_expression BOOLEAN;
  v_expected_attribute SMALLINT;
BEGIN
  SELECT a.attnum
    INTO v_expected_attribute
    FROM pg_attribute AS a
   WHERE a.attrelid = 'public.sensus_kesejahteraan'::regclass
     AND a.attname = 'warga_id'
     AND NOT a.attisdropped;

  SELECT c.oid,
         i.indrelid,
         i.indisunique,
         i.indnkeyatts,
         i.indnatts,
         i.indkey[0],
         (i.indpred IS NOT NULL),
         (i.indexprs IS NOT NULL)
    INTO v_index_oid, v_index_relid, v_is_unique, v_key_count,
         v_attribute_count, v_key_attribute, v_has_predicate, v_has_expression
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    JOIN pg_index AS i ON i.indexrelid = c.oid
   WHERE n.nspname = 'public'
     AND c.relname = 'uq_sensus_kesejahteraan_warga';

  IF v_index_oid IS NOT NULL THEN
    IF v_index_relid <> 'public.sensus_kesejahteraan'::regclass
       OR NOT v_is_unique
       OR v_key_count <> 1
       OR v_attribute_count <> 1
       OR v_key_attribute IS DISTINCT FROM v_expected_attribute
       OR v_has_predicate
       OR v_has_expression THEN
      RAISE EXCEPTION
        'Index uq_sensus_kesejahteraan_warga sudah ada tetapi bukan unique(warga_id)';
    END IF;
  ELSE
    CREATE UNIQUE INDEX uq_sensus_kesejahteraan_warga
      ON public.sensus_kesejahteraan (warga_id);
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.simpan_sensus_mandiri(UUID, TEXT, UUID, JSONB, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.simpan_sensus_mandiri(
  p_warga_id UUID,
  p_nik TEXT,
  p_rt_id UUID,
  p_biodata JSONB,
  p_anggota JSONB,
  p_catatan TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_warga RECORD;
  v_member JSONB;
  v_existing RECORD;
  v_id UUID;
  v_nik TEXT;
  v_nama TEXT;
  v_hubungan TEXT;
  v_input_ids UUID[] := ARRAY[]::UUID[];
  v_input_niks TEXT[] := ARRAY[p_nik]::TEXT[];
  v_count INTEGER;
  v_sensus_id UUID;
  v_catatan TEXT;
  v_nik_locks TEXT;
BEGIN
  -- Parameter dan bentuk JSON divalidasi lagi di database. Server Action
  -- adalah boundary tambahan, bukan sumber kebenaran.
  IF p_warga_id IS NULL OR p_nik IS NULL OR p_rt_id IS NULL
     OR p_biodata IS NULL OR jsonb_typeof(p_biodata) <> 'object'
     OR p_anggota IS NULL OR jsonb_typeof(p_anggota) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Payload sensus tidak valid';
  END IF;

  IF p_nik !~ '^[0-9]{16}$'
     OR p_nik = repeat(substr(p_nik, 1, 1), 16)
     OR p_nik = '1234567890123456' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Identitas sensus tidak valid';
  END IF;

  IF jsonb_array_length(p_anggota) > 30 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Jumlah anggota keluarga melebihi batas';
  END IF;

  -- Tolak field tambahan agar payload tidak menjadi jalur mass assignment.
  IF EXISTS (
    SELECT 1
      FROM jsonb_object_keys(p_biodata) AS field_names(field_name)
     WHERE field_names.field_name NOT IN (
       'nama_lengkap', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin',
       'agama', 'pekerjaan', 'no_whatsapp', 'status_tinggal',
       'detail_alamat', 'pendapatan_bulanan', 'daya_listrik'
     )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Field biodata tidak dikenal';
  END IF;

  IF btrim(coalesce(p_biodata->>'nama_lengkap', '')) = ''
     OR length(btrim(p_biodata->>'nama_lengkap')) > 150
     OR btrim(coalesce(p_biodata->>'tempat_lahir', '')) = ''
     OR length(btrim(p_biodata->>'tempat_lahir')) > 100
     OR coalesce(p_biodata->>'tanggal_lahir', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     OR btrim(coalesce(p_biodata->>'jenis_kelamin', '')) NOT IN ('Laki-laki', 'Perempuan')
     OR btrim(coalesce(p_biodata->>'agama', '')) NOT IN ('Islam', 'Kristen/Katolik', 'Hindu', 'Budha', 'Konghucu')
     OR btrim(coalesce(p_biodata->>'pekerjaan', '')) = ''
     OR length(btrim(p_biodata->>'pekerjaan')) > 100
     OR regexp_replace(coalesce(p_biodata->>'no_whatsapp', ''), '[^0-9]', '', 'g') !~ '^[0-9]{10,15}$'
     OR btrim(coalesce(p_biodata->>'status_tinggal', '')) NOT IN ('Warga Tetap', 'Penyewa Kos', 'Penyewa Kontrakan')
     OR btrim(coalesce(p_biodata->>'detail_alamat', '')) = ''
     OR length(btrim(p_biodata->>'detail_alamat')) > 300
     OR btrim(coalesce(p_biodata->>'pendapatan_bulanan', '')) NOT IN ('< 1 Juta', '1 - 3 Juta', '3 - 5 Juta', '5 - 10 Juta', '> 10 Juta')
     OR btrim(coalesce(p_biodata->>'daya_listrik', '')) NOT IN ('450 VA (Subsidi)', '900 VA (Subsidi)', '900 VA (Non-Subsidi)', '1300 VA', '2200 VA', '> 2200 VA') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Biodata sensus tidak valid';
  END IF;

  SELECT w.*
    INTO v_warga
    FROM public.warga AS w
   WHERE w.id = p_warga_id
     AND w.nik = p_nik
     AND w.rt_id = p_rt_id
     AND w.status_verifikasi = 'Disetujui'
     AND w.status_aktif = true
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Akun warga tidak berwenang';
  END IF;

  -- Semua pemanggilan yang menyentuh NIK yang sama memperoleh lock dalam
  -- urutan leksikografis yang sama, sehingga check-then-write tidak dapat
  -- dilombakan oleh dua rumah tangga berbeda.
  FOR v_nik_locks IN
    SELECT kandidat.nik
      FROM (
        SELECT p_nik AS nik
        UNION
        SELECT btrim(item.value->>'nik') AS nik
          FROM jsonb_array_elements(p_anggota) AS item(value)
      ) AS kandidat
     ORDER BY kandidat.nik NULLS FIRST
  LOOP
    IF v_nik_locks IS NULL OR v_nik_locks !~ '^[0-9]{16}$' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'NIK anggota tidak valid';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('sensus-nik:' || v_nik_locks, 0));
  END LOOP;

  -- Lock semua anggota milik kepala keluarga, termasuk record legacy dengan
  -- tenant NULL/salah. Record seperti itu harus diperbaiki pengurus, bukan
  -- disembunyikan lalu ditinggalkan oleh sinkronisasi mandiri.
  PERFORM 1
    FROM public.anggota_keluarga AS a
   WHERE a.warga_id = p_warga_id
   FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.anggota_keluarga AS a
     WHERE a.warga_id = p_warga_id
       AND a.rt_id IS DISTINCT FROM p_rt_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Tenant anggota perlu ditinjau pengurus';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.anggota_keluarga AS a
     WHERE a.warga_id = p_warga_id
       AND (
         a.nik IS NULL
         OR a.nik !~ '^[0-9]{16}$'
         OR a.nik = repeat(substr(a.nik, 1, 1), 16)
         OR a.nik = '1234567890123456'
       )
  ) THEN
    -- Jangan menghapus record legacy yang identitasnya tidak dapat dibuktikan
    -- hanya karena record tersebut tidak muncul di payload warga.
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Identitas anggota legacy perlu ditinjau pengurus';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.anggota_keluarga AS a
     WHERE a.warga_id = p_warga_id
     GROUP BY a.nik
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Anggota ganda perlu ditinjau pengurus';
  END IF;

  SELECT count(*) INTO v_count
    FROM public.sensus_kesejahteraan
   WHERE warga_id = p_warga_id;
  IF v_count > 1 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Data sensus ganda perlu ditinjau pengurus';
  END IF;

  SELECT s.id INTO v_sensus_id
    FROM public.sensus_kesejahteraan AS s
   WHERE s.warga_id = p_warga_id
   LIMIT 1
   FOR UPDATE;

  IF v_sensus_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.sensus_kesejahteraan
       WHERE id = v_sensus_id AND status_validasi = 'Disetujui'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Verifikasi sensus sudah diselesaikan';
    END IF;
  END IF;

  -- Validasi dan normalisasi setiap anggota sebelum mutasi pertama.
  FOR v_member IN SELECT value FROM jsonb_array_elements(p_anggota) LOOP
    IF jsonb_typeof(v_member) <> 'object' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Format anggota keluarga tidak valid';
    END IF;

    IF EXISTS (
      SELECT 1
        FROM jsonb_object_keys(v_member) AS field_names(field_name)
       WHERE field_names.field_name NOT IN (
         'id', 'nama_lengkap', 'nik', 'hubungan_keluarga', 'hubungan_detail',
         'tanggal_lahir', 'tempat_lahir', 'jenis_kelamin', 'agama', 'pekerjaan'
       )
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Field anggota tidak dikenal';
    END IF;

    v_nama := btrim(coalesce(v_member->>'nama_lengkap', ''));
    v_nik := btrim(coalesce(v_member->>'nik', ''));
    v_hubungan := btrim(coalesce(v_member->>'hubungan_keluarga', ''));
    IF v_nama = '' OR length(v_nama) > 150
       OR v_nik !~ '^[0-9]{16}$'
       OR v_nik = repeat(substr(v_nik, 1, 1), 16)
       OR v_nik = p_nik
       OR v_nik = '1234567890123456'
       OR v_hubungan NOT IN ('Istri', 'Suami', 'Anak', 'Lainnya')
       OR btrim(coalesce(v_member->>'tempat_lahir', '')) = ''
       OR coalesce(v_member->>'tanggal_lahir', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       OR btrim(coalesce(v_member->>'jenis_kelamin', '')) NOT IN ('Laki-laki', 'Perempuan')
       OR btrim(coalesce(v_member->>'agama', '')) NOT IN ('Islam', 'Kristen/Katolik', 'Hindu', 'Budha', 'Konghucu')
       OR btrim(coalesce(v_member->>'pekerjaan', '')) = ''
       OR length(btrim(v_member->>'pekerjaan')) > 100
       OR length(btrim(v_member->>'tempat_lahir')) > 100
       OR length(btrim(coalesce(v_member->>'hubungan_detail', ''))) > 80
       OR (v_hubungan = 'Lainnya' AND btrim(coalesce(v_member->>'hubungan_detail', '')) = '') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Data anggota keluarga tidak valid';
    END IF;

    IF v_nik = ANY(v_input_niks) THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'NIK anggota dipakai lebih dari sekali';
    END IF;
    v_input_niks := array_append(v_input_niks, v_nik);

    IF jsonb_typeof(v_member->'id') IS NOT NULL THEN
      IF jsonb_typeof(v_member->'id') <> 'string'
         OR btrim(coalesce(v_member->>'id', '')) !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Kepemilikan anggota perlu ditinjau pengurus';
      END IF;
      v_id := (v_member->>'id')::UUID;
      IF v_id = ANY(v_input_ids) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Kepemilikan anggota perlu ditinjau pengurus';
      END IF;
      v_input_ids := array_append(v_input_ids, v_id);

      SELECT a.nik, a.rt_id
        INTO v_existing
        FROM public.anggota_keluarga AS a
       WHERE a.id = v_id
         AND a.warga_id = p_warga_id
       FOR UPDATE;
      IF NOT FOUND
         OR v_existing.rt_id IS DISTINCT FROM p_rt_id
         OR v_existing.nik IS DISTINCT FROM v_nik THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Kepemilikan anggota perlu ditinjau pengurus';
      END IF;
    ELSE
      -- ID yang tidak dikirim berarti INSERT baru; NIK yang sudah ada di
      -- tabel mana pun tidak boleh dipindahkan atau digandakan oleh warga.
      IF EXISTS (SELECT 1 FROM public.warga WHERE nik = v_nik)
         OR EXISTS (SELECT 1 FROM public.anggota_keluarga WHERE nik = v_nik) THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'NIK anggota sudah tercatat';
      END IF;
    END IF;
  END LOOP;

  -- Hapus hanya snapshot anggota lama yang sudah dikunci dan tidak dikirim
  -- kembali. Ini harus terjadi sebelum INSERT; bila daftar ID kosong, anggota
  -- baru yang belum dibuat tidak ikut terhapus.
  DELETE FROM public.anggota_keluarga AS a
   WHERE a.warga_id = p_warga_id
     AND a.rt_id = p_rt_id
     AND NOT (a.id = ANY(v_input_ids));

  -- Biodata dibatasi ke kolom yang memang boleh diubah; NIK dan tenant tidak
  -- pernah berasal dari JSON.
  UPDATE public.warga
     SET nama_lengkap = left(btrim(coalesce(p_biodata->>'nama_lengkap', '')), 150),
         tempat_lahir = left(btrim(coalesce(p_biodata->>'tempat_lahir', '')), 100),
         tanggal_lahir = (p_biodata->>'tanggal_lahir')::DATE,
         jenis_kelamin = btrim(coalesce(p_biodata->>'jenis_kelamin', '')),
         agama = btrim(coalesce(p_biodata->>'agama', '')),
         pekerjaan = left(btrim(coalesce(p_biodata->>'pekerjaan', '')), 100),
         no_whatsapp = left(regexp_replace(coalesce(p_biodata->>'no_whatsapp', ''), '[^0-9+]', '', 'g'), 30),
         status_tinggal = btrim(coalesce(p_biodata->>'status_tinggal', '')),
         detail_alamat = left(btrim(coalesce(p_biodata->>'detail_alamat', '')), 300),
         pendapatan_bulanan = btrim(coalesce(p_biodata->>'pendapatan_bulanan', '')),
         daya_listrik = btrim(coalesce(p_biodata->>'daya_listrik', ''))
   WHERE id = p_warga_id
     AND nik = p_nik
     AND rt_id = p_rt_id
     AND status_verifikasi = 'Disetujui'
     AND status_aktif = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Data warga berubah saat disimpan';
  END IF;

  FOR v_member IN SELECT value FROM jsonb_array_elements(p_anggota) LOOP
    v_nik := btrim(v_member->>'nik');
    IF jsonb_typeof(v_member->'id') = 'string' THEN
      v_id := (v_member->>'id')::UUID;
      UPDATE public.anggota_keluarga
         SET nama_lengkap = left(btrim(v_member->>'nama_lengkap'), 150),
             hubungan_keluarga = btrim(v_member->>'hubungan_keluarga'),
             hubungan_detail = CASE WHEN btrim(v_member->>'hubungan_keluarga') = 'Lainnya'
                                    THEN left(btrim(coalesce(v_member->>'hubungan_detail', '')), 80)
                                    ELSE NULL END,
             tanggal_lahir = (v_member->>'tanggal_lahir')::DATE,
             tempat_lahir = left(btrim(v_member->>'tempat_lahir'), 100),
             jenis_kelamin = btrim(v_member->>'jenis_kelamin'),
             agama = btrim(v_member->>'agama'),
             pekerjaan = left(btrim(v_member->>'pekerjaan'), 100),
             rt_id = p_rt_id
       WHERE id = v_id AND warga_id = p_warga_id AND rt_id = p_rt_id AND nik = v_nik;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Kepemilikan anggota berubah';
      END IF;
    ELSE
      INSERT INTO public.anggota_keluarga (
        warga_id, rt_id, nama_lengkap, nik, hubungan_keluarga, hubungan_detail,
        tanggal_lahir, tempat_lahir, jenis_kelamin, agama, pekerjaan
      ) VALUES (
        p_warga_id, p_rt_id, left(btrim(v_member->>'nama_lengkap'), 150), v_nik,
        btrim(v_member->>'hubungan_keluarga'),
        CASE WHEN btrim(v_member->>'hubungan_keluarga') = 'Lainnya'
             THEN left(btrim(coalesce(v_member->>'hubungan_detail', '')), 80)
             ELSE NULL END,
        (v_member->>'tanggal_lahir')::DATE,
        left(btrim(v_member->>'tempat_lahir'), 100),
        btrim(v_member->>'jenis_kelamin'), btrim(v_member->>'agama'),
        left(btrim(v_member->>'pekerjaan'), 100)
      );
    END IF;
  END LOOP;

  v_catatan := left(
    coalesce(nullif(btrim(p_catatan), ''), 'Data Carik divalidasi mandiri oleh warga'),
    1000
  );

  IF v_sensus_id IS NULL THEN
    INSERT INTO public.sensus_kesejahteraan (
      warga_id, catatan_tambahan, status_validasi,
      ada_ibu_hamil, ada_disabilitas, ada_ibu_menyusui, ada_ibu_meninggal,
      ada_bayi_meninggal, ada_balita_meninggal, ada_bayi_baru_lahir,
      bayi_tanpa_akta, ada_ibu_nifas, memiliki_mck, memiliki_tempat_sampah,
      memiliki_spal, memiliki_resapan_air, sumber_air_utama,
      status_kesehatan_rumah, jenis_makanan_pokok
    ) VALUES (
      p_warga_id, v_catatan, 'Disetujui',
      false, false, false, false, false, false, false, false, false,
      true, true, true, true, 'PAM / Leding', 'Rumah Sehat', 'Beras / Nasi'
    );
  ELSE
    UPDATE public.sensus_kesejahteraan
       SET catatan_tambahan = v_catatan,
           status_validasi = 'Disetujui'
     WHERE id = v_sensus_id AND warga_id = p_warga_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Status sensus berubah saat disimpan';
    END IF;
  END IF;

  INSERT INTO public.audit_log (aktor, aksi, tabel_target, detail, rt_id)
  VALUES (
    left(coalesce(v_warga.nama_lengkap, p_nik), 150),
    'Verifikasi Data Carik Mandiri',
    'warga/anggota_keluarga/sensus_kesejahteraan',
    left('NIK ' || p_nik || ' diperbarui dalam satu transaksi; tidak ada resolusi duplikat otomatis.', 2000),
    p_rt_id
  );
END;
$$;

DROP FUNCTION IF EXISTS public.laporkan_nik_tidak_sesuai_mandiri(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.laporkan_nik_tidak_sesuai_mandiri(
  p_warga_id UUID,
  p_nik TEXT,
  p_rt_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_warga RECORD;
  v_sensus_id UUID;
BEGIN
  IF p_warga_id IS NULL OR p_rt_id IS NULL OR p_nik IS NULL
     OR p_nik !~ '^[0-9]{16}$'
     OR p_nik = repeat(substr(p_nik, 1, 1), 16)
     OR p_nik = '1234567890123456' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Identitas laporan tidak valid';
  END IF;

  SELECT w.* INTO v_warga
    FROM public.warga AS w
   WHERE w.id = p_warga_id
     AND w.nik = p_nik
     AND w.rt_id = p_rt_id
     AND w.status_verifikasi = 'Disetujui'
     AND w.status_aktif = true
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Akun warga tidak berwenang';
  END IF;

  UPDATE public.warga
     SET status_verifikasi = 'Menunggu'
   WHERE id = p_warga_id AND nik = p_nik AND rt_id = p_rt_id
     AND status_verifikasi = 'Disetujui' AND status_aktif = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Status akun berubah';
  END IF;

  IF (SELECT count(*) FROM public.sensus_kesejahteraan WHERE warga_id = p_warga_id) > 1 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Data sensus ganda perlu ditinjau pengurus';
  END IF;

  SELECT s.id INTO v_sensus_id
    FROM public.sensus_kesejahteraan AS s
   WHERE s.warga_id = p_warga_id
   LIMIT 1
   FOR UPDATE;

  IF v_sensus_id IS NULL THEN
    INSERT INTO public.sensus_kesejahteraan (
      warga_id, catatan_tambahan, status_validasi,
      ada_ibu_hamil, ada_disabilitas, ada_ibu_menyusui, ada_ibu_meninggal,
      ada_bayi_meninggal, ada_balita_meninggal, ada_bayi_baru_lahir,
      bayi_tanpa_akta, ada_ibu_nifas, memiliki_mck, memiliki_tempat_sampah,
      memiliki_spal, memiliki_resapan_air, sumber_air_utama,
      status_kesehatan_rumah, jenis_makanan_pokok
    ) VALUES (
      p_warga_id,
      'Warga melaporkan NIK pada data warisan tidak sesuai KTP; perlu pemeriksaan pengurus.',
      'Menunggu', false, false, false, false, false, false, false, false, false,
      true, true, true, true, 'PAM / Leding', 'Rumah Sehat', 'Beras / Nasi'
    );
  ELSE
    UPDATE public.sensus_kesejahteraan
       SET catatan_tambahan = 'Warga melaporkan NIK pada data warisan tidak sesuai KTP; perlu pemeriksaan pengurus.',
           status_validasi = 'Menunggu'
     WHERE id = v_sensus_id AND warga_id = p_warga_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Status sensus berubah';
    END IF;
  END IF;

  INSERT INTO public.audit_log (aktor, aksi, tabel_target, detail, rt_id)
  VALUES (
    left(coalesce(v_warga.nama_lengkap, 'warga'), 150),
    'Laporan Mandiri NIK Tidak Sesuai',
    'warga/sensus_kesejahteraan',
    left('Akun ' || p_warga_id::TEXT || ' diblokir sementara; tidak ada data yang dihapus.', 2000),
    p_rt_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.simpan_sensus_mandiri(UUID, TEXT, UUID, JSONB, JSONB, TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.laporkan_nik_tidak_sesuai_mandiri(UUID, TEXT, UUID)
  FROM PUBLIC;

-- Tutup seluruh overload lama dengan nama yang sama. PostgreSQL/PostgREST
-- dapat memilih overload berdasarkan tipe JSON yang dikirim; mengamankan satu
-- signature saja bukan boundary yang cukup.
DO $$
DECLARE
  v_signature RECORD;
BEGIN
  -- Rakit nama fungsi langsung dari catalog. `oid::regprocedure` dapat
  -- menghasilkan nama tanpa schema mengikuti search_path caller; pada
  -- deployment yang memiliki fungsi shadowing, REVOKE bisa mengenai objek
  -- yang salah.
  FOR v_signature IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS identity_arguments
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('simpan_sensus_mandiri', 'laporkan_nik_tidak_sesuai_mandiri')
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
    -- Cabut grant eksplisit pada overload legacy juga. Revoke PUBLIC tidak
    -- membatalkan grant langsung yang mungkin pernah dibuat migrasi lama.
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM service_role',
        v_signature.schema_name,
        v_signature.function_name,
        v_signature.identity_arguments
      );
    END IF;
  END LOOP;
END;
$$;

-- Pulihkan kapabilitas hanya untuk dua signature atomik yang dipakai aplikasi.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.simpan_sensus_mandiri(UUID, TEXT, UUID, JSONB, JSONB, TEXT)
      TO service_role;
    GRANT EXECUTE ON FUNCTION public.laporkan_nik_tidak_sesuai_mandiri(UUID, TEXT, UUID)
      TO service_role;
  END IF;
END;
$$;

COMMIT;

-- Prasyarat deployment: jalankan file ini terlebih dahulu, lalu deploy build
-- aplikasi yang memakai RPC. Tanpa migrasi, jalur mandiri sengaja gagal dan
-- tidak memiliki fallback multi-query yang dapat meninggalkan partial write.
