-- ============================================================================
-- FINANCE ATOMIC BOUNDARY (KURBAN <-> BANK SAMPAH)
--
-- Prerequisite: tabel public.warga, public.transaksi_kurban,
-- public.transaksi_sampah, dan public.audit_log sudah ada dengan kolom yang
-- dipakai aplikasi. Jalankan di Supabase SQL Editor sebagai owner.
--
-- Mengapa file ini diperlukan:
--   * aplikasi memanggil proses_autodebet_kurban(... 5 argumen), sedangkan
--     migrasi lama mendefinisikan eksekusi_autodebet_kurban(3 argumen) yang
--     menulis tabel tabungan_kurban (bukan transaksi_kurban);
--   * saldo dibaca lalu ditulis dalam dua request terpisah, sehingga dua
--     penarikan konkuren dapat menghabiskan saldo yang sama.
--
-- Fungsi di bawah mengunci baris warga, menghitung saldo, menulis kedua ledger
-- dan audit dalam satu transaksi. Akses direct anon/authenticated dicabut;
-- hanya service_role yang boleh memanggilnya dari Server Action yang sudah
-- melakukan autentikasi dan pemeriksaan RT.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.warga') IS NULL
     OR to_regclass('public.transaksi_kurban') IS NULL
     OR to_regclass('public.transaksi_sampah') IS NULL
     OR to_regclass('public.audit_log') IS NULL THEN
    RAISE EXCEPTION
      'Schema finance belum lengkap: warga/transaksi_kurban/transaksi_sampah/audit_log wajib tersedia';
  END IF;
END;
$$;

-- transaksi_sampah adalah ledger bertenant (homepage dan laporan admin
-- menyaringnya dengan rt_id).  Versi tabel lama kadang belum memiliki kolom
-- ini; tambahkan terlebih dahulu agar transaksi auto-debet tidak menjadi
-- baris orphan yang lolos dari filter tenant.
ALTER TABLE public.transaksi_sampah
  ADD COLUMN IF NOT EXISTS rt_id UUID;

CREATE INDEX IF NOT EXISTS idx_transaksi_sampah_rt_warga
  ON public.transaksi_sampah (rt_id, warga_id, tanggal_transaksi DESC);

-- Gagal lebih awal bila schema belum memenuhi kontrak fungsi.  Tanpa check
-- ini, PL/pgSQL dapat membuat fungsi lalu baru meledak saat request pertama
-- (fail-open dari sisi deployment dan sulit didiagnosis).  status_aktif wajib
-- tersedia karena akun yang diarsipkan tidak boleh menerima debit baru.
DO $$
DECLARE
  kolom_hilang TEXT[];
BEGIN
  SELECT array_agg(format('%I.%I', kebutuhan.nama_tabel, kebutuhan.nama_kolom)
                  ORDER BY kebutuhan.nama_tabel, kebutuhan.nama_kolom)
    INTO kolom_hilang
    FROM (
      VALUES
        ('warga', 'id'),
        ('warga', 'rt_id'),
        ('warga', 'status_verifikasi'),
        ('warga', 'status_aktif'),
        ('transaksi_sampah', 'warga_id'),
        ('transaksi_sampah', 'rt_id'),
        ('transaksi_sampah', 'jenis_transaksi'),
        ('transaksi_sampah', 'keterangan'),
        ('transaksi_sampah', 'berat_kg'),
        ('transaksi_sampah', 'nominal_warga'),
        ('transaksi_sampah', 'nominal_kas_rt'),
        ('transaksi_sampah', 'tanggal_transaksi'),
        ('transaksi_kurban', 'warga_id'),
        ('transaksi_kurban', 'jenis_transaksi'),
        ('transaksi_kurban', 'sumber_dana'),
        ('transaksi_kurban', 'nominal'),
        ('transaksi_kurban', 'keterangan'),
        ('transaksi_kurban', 'tanggal_transaksi'),
        ('audit_log', 'aktor'),
        ('audit_log', 'aksi'),
        ('audit_log', 'tabel_target'),
        ('audit_log', 'detail'),
        ('audit_log', 'rt_id')
    ) AS kebutuhan(nama_tabel, nama_kolom)
    LEFT JOIN information_schema.columns AS c
      ON c.table_schema = 'public'
     AND c.table_name = kebutuhan.nama_tabel
     AND c.column_name = kebutuhan.nama_kolom
   WHERE c.column_name IS NULL;

  IF kolom_hilang IS NOT NULL THEN
    RAISE EXCEPTION
      'Schema finance tidak memenuhi kontrak: kolom hilang (%). Jalankan migrasi schema terkait terlebih dahulu.',
      array_to_string(kolom_hilang, ', ');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.proses_autodebet_kurban(
  p_warga_id UUID,
  p_nominal NUMERIC,
  p_keterangan TEXT,
  p_tanggal DATE,
  p_aktor TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rt_id UUID;
  v_saldo NUMERIC(20, 2);
  v_keterangan TEXT;
  v_aktor TEXT;
BEGIN
  IF p_warga_id IS NULL
     OR p_nominal IS NULL
     OR p_nominal <= 0
     OR p_nominal > 1000000000
     OR p_tanggal IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Parameter transaksi tidak valid';
  END IF;

  v_keterangan := left(coalesce(p_keterangan, ''), 1000);
  v_aktor := left(coalesce(p_aktor, ''), 150);
  IF v_keterangan = '' OR v_aktor = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Keterangan dan aktor wajib diisi';
  END IF;

  -- Lock stabil per warga. Semua jalur penarikan yang aman harus mengambil
  -- lock yang sama sebelum membaca saldo, sehingga request konkuren serial.
  SELECT w.rt_id
    INTO v_rt_id
    FROM public.warga AS w
   WHERE w.id = p_warga_id
     AND w.status_verifikasi = 'Disetujui'
     AND w.status_aktif IS TRUE
   FOR UPDATE;

  IF NOT FOUND OR v_rt_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Warga tidak aktif atau wilayah tidak valid';
  END IF;

  SELECT coalesce(
    sum(
      CASE
        WHEN ts.jenis_transaksi = 'Setor' THEN coalesce(ts.nominal_warga, 0)
        WHEN ts.jenis_transaksi = 'Tarik' THEN -coalesce(ts.nominal_warga, 0)
        ELSE 0
      END
    ),
    0
  )
    INTO v_saldo
    FROM public.transaksi_sampah AS ts
   WHERE ts.warga_id = p_warga_id
     -- Null rt_id menandai data legacy sebelum backfill.  Data bertenant
     -- dengan RT lain tidak boleh ikut menentukan saldo warga ini.
     AND (ts.rt_id IS NULL OR ts.rt_id = v_rt_id);

  IF p_nominal > v_saldo THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Saldo bank sampah tidak mencukupi';
  END IF;

  INSERT INTO public.transaksi_sampah (
    warga_id,
    rt_id,
    jenis_transaksi,
    keterangan,
    berat_kg,
    nominal_warga,
    nominal_kas_rt,
    tanggal_transaksi
  ) VALUES (
    p_warga_id,
    v_rt_id,
    'Tarik',
    left('Auto-debet untuk tabungan kurban: ' || v_keterangan, 1000),
    0,
    p_nominal,
    0,
    p_tanggal
  );

  INSERT INTO public.transaksi_kurban (
    warga_id,
    jenis_transaksi,
    sumber_dana,
    nominal,
    keterangan,
    tanggal_transaksi
  ) VALUES (
    p_warga_id,
    'Setoran (+)',
    'Saldo Tabungan Sampah',
    p_nominal,
    v_keterangan,
    p_tanggal
  );

  INSERT INTO public.audit_log (
    aktor,
    aksi,
    tabel_target,
    detail,
    rt_id
  ) VALUES (
    v_aktor,
    'AUTO_DEBET_KURBAN',
    'transaksi_kurban & transaksi_sampah',
    left('Warga ID: ' || p_warga_id::text || ', nominal: ' || p_nominal::text, 2000),
    v_rt_id
  );
END;
$$;

-- Hapus akses dari seluruh role client. Supabase biasanya memiliki role
-- service_role; guard membuat migrasi tetap dapat dijalankan pada instalasi
-- PostgreSQL lokal yang tidak mendefinisikannya.
REVOKE ALL ON FUNCTION public.proses_autodebet_kurban(UUID, NUMERIC, TEXT, DATE, TEXT)
  FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE EXECUTE ON FUNCTION public.proses_autodebet_kurban(UUID, NUMERIC, TEXT, DATE, TEXT) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE EXECUTE ON FUNCTION public.proses_autodebet_kurban(UUID, NUMERIC, TEXT, DATE, TEXT) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.proses_autodebet_kurban(UUID, NUMERIC, TEXT, DATE, TEXT) TO service_role;
  END IF;
END;
$$;

-- Fungsi legacy yang menulis tabungan_kurban tidak boleh tetap terbuka. Revoke
-- seluruh overload yang ditemukan tanpa mengasumsikan tipe nominal tertentu.
DO $$
DECLARE
  signature TEXT;
BEGIN
  FOR signature IN
    SELECT oid::regprocedure::text
      FROM pg_proc
     WHERE pronamespace = 'public'::regnamespace
       AND proname IN ('eksekusi_autodebet_kurban', 'proses_autodebet_kurban')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', signature);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', signature);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', signature);
    END IF;
  END LOOP;
END;
$$;

COMMIT;

-- Setelah migrasi ini berhasil, endpoint aplikasi memakai fungsi lima argumen
-- di atas. Jangan mengaktifkan kembali fungsi legacy tanpa ownership/RT check
-- dan row lock yang sama.
