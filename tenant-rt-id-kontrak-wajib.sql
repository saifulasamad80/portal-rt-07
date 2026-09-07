-- ======================================================================================
-- Kontrak tenant: rt_id wajib, diisi dari induk, bukan LIMIT 1 master_rt.
-- Fase 0 (backfill yatim) + Fase 1 (kolom baru, NOT NULL, trigger, RPC keuangan).
-- ======================================================================================

-- ---------- Fase 0: backfill dari induk ----------
UPDATE public.transaksi_sampah AS ts
   SET rt_id = w.rt_id
  FROM public.warga AS w
 WHERE ts.warga_id = w.id
   AND ts.rt_id IS NULL
   AND w.rt_id IS NOT NULL;

UPDATE public.peminjaman_inventaris AS pi
   SET rt_id = w.rt_id
  FROM public.warga AS w
 WHERE pi.warga_id = w.id
   AND pi.rt_id IS NULL
   AND w.rt_id IS NOT NULL;

UPDATE public.master_inventaris AS mi
   SET rt_id = pi.rt_id
  FROM public.peminjaman_inventaris AS pi
 WHERE mi.rt_id IS NULL
   AND pi.rt_id IS NOT NULL
   AND lower(btrim(mi.nama_barang)) = lower(btrim(pi.nama_barang));

UPDATE public.kas_rt AS k
   SET rt_id = w.rt_id
  FROM public.warga AS w
 WHERE k.warga_id = w.id
   AND k.rt_id IS NULL
   AND w.rt_id IS NOT NULL;

UPDATE public.laporan_warga AS l
   SET rt_id = w.rt_id
  FROM public.warga AS w
 WHERE l.warga_id = w.id
   AND l.rt_id IS NULL
   AND w.rt_id IS NOT NULL;

UPDATE public.jadwal_ronda AS j
   SET rt_id = w.rt_id
  FROM public.warga AS w
 WHERE j.warga_id = w.id
   AND j.rt_id IS NULL
   AND w.rt_id IS NOT NULL;

UPDATE public.suara_voting AS s
   SET rt_id = w.rt_id
  FROM public.warga AS w
 WHERE s.warga_id = w.id
   AND s.rt_id IS NULL
   AND w.rt_id IS NOT NULL;

UPDATE public.lapak_warga AS l
   SET rt_id = w.rt_id
  FROM public.warga AS w
 WHERE l.warga_id = w.id
   AND l.rt_id IS NULL
   AND w.rt_id IS NOT NULL;

UPDATE public.limbah_ekonomis AS l
   SET rt_id = w.rt_id
  FROM public.warga AS w
 WHERE l.warga_id = w.id
   AND l.rt_id IS NULL
   AND w.rt_id IS NOT NULL;

UPDATE public.tabungan_kurban AS t
   SET rt_id = w.rt_id
  FROM public.warga AS w
 WHERE t.warga_id = w.id
   AND t.rt_id IS NULL
   AND w.rt_id IS NOT NULL;

-- audit_log IMMUTABLE via statement trigger; backfill tenant hanya jendela migrasi ini.
ALTER TABLE public.audit_log DISABLE TRIGGER tr_proteksi_audit_log_statement;
ALTER TABLE public.audit_log DISABLE TRIGGER tr_proteksi_audit_log_stmt;

UPDATE public.audit_log AS a
   SET rt_id = p.rt_id
  FROM public.pengurus_rt AS p
 WHERE a.rt_id IS NULL
   AND a.aktor IS NOT NULL
   AND a.aktor = p.nama_lengkap
   AND p.rt_id IS NOT NULL;

-- Sisa katalog tanpa induk (kunjungan, audit trigger, barang tanpa pinjaman):
-- hanya jika instalasi ini punya tepat satu master_rt DAN seluruh warga
-- berada di wilayah itu. Ini bukan LIMIT 1 tanpa penjaga.
DO $$
DECLARE
  v_rt uuid;
  v_jumlah_master integer;
  v_jumlah_warga_rt integer;
BEGIN
  SELECT COUNT(*) INTO v_jumlah_master FROM public.master_rt;
  SELECT COUNT(DISTINCT rt_id) INTO v_jumlah_warga_rt FROM public.warga;
  IF v_jumlah_master <> 1 OR v_jumlah_warga_rt <> 1 THEN
    RETURN;
  END IF;
  SELECT id INTO v_rt FROM public.master_rt;
  IF v_rt IS NULL OR EXISTS (SELECT 1 FROM public.warga WHERE rt_id IS DISTINCT FROM v_rt) THEN
    RETURN;
  END IF;

  UPDATE public.kunjungan_balita SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.kunjungan_lansia SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.master_inventaris SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.audit_log SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.galeri_kegiatan SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.dokumen_publik_rt SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.kontak_darurat_rt SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.pengumuman_rt SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.voting_rt SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.laporan_jumantik SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.arisan_ibu SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.pengurus_rt SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.posyandu_balita SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.posyandu_lansia SET rt_id = v_rt WHERE rt_id IS NULL;
END;
$$;

ALTER TABLE public.audit_log ENABLE TRIGGER tr_proteksi_audit_log_statement;
ALTER TABLE public.audit_log ENABLE TRIGGER tr_proteksi_audit_log_stmt;

-- ---------- Fase 1: kolom rt_id pada tabel anak ----------
ALTER TABLE public.transaksi_kurban
  ADD COLUMN IF NOT EXISTS rt_id uuid;
ALTER TABLE public.sensus_kesejahteraan
  ADD COLUMN IF NOT EXISTS rt_id uuid;
ALTER TABLE public.arisan_transaksi
  ADD COLUMN IF NOT EXISTS rt_id uuid;
ALTER TABLE public.push_langganan
  ADD COLUMN IF NOT EXISTS rt_id uuid;

UPDATE public.transaksi_kurban AS t
   SET rt_id = w.rt_id
  FROM public.warga AS w
 WHERE t.warga_id = w.id
   AND t.rt_id IS NULL
   AND w.rt_id IS NOT NULL;

UPDATE public.sensus_kesejahteraan AS s
   SET rt_id = w.rt_id
  FROM public.warga AS w
 WHERE s.warga_id = w.id
   AND s.rt_id IS NULL
   AND w.rt_id IS NOT NULL;

UPDATE public.arisan_transaksi AS t
   SET rt_id = a.rt_id
  FROM public.arisan_ibu AS a
 WHERE t.arisan_id = a.id
   AND t.rt_id IS NULL
   AND a.rt_id IS NOT NULL;

UPDATE public.push_langganan AS p
   SET rt_id = w.rt_id
  FROM public.warga AS w
 WHERE p.warga_id = w.id
   AND p.rt_id IS NULL
   AND w.rt_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.kunci_rt_id_dari_warga()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_milik uuid;
BEGIN
  IF NEW.warga_id IS NOT NULL THEN
    SELECT w.rt_id INTO v_milik
      FROM public.warga AS w
     WHERE w.id = NEW.warga_id;
    IF v_milik IS NULL THEN
      RAISE EXCEPTION 'Wilayah warga tidak valid; rt_id wajib ada di induk';
    END IF;
    IF NEW.rt_id IS NULL THEN
      NEW.rt_id := v_milik;
    ELSIF NEW.rt_id IS DISTINCT FROM v_milik THEN
      RAISE EXCEPTION 'rt_id baris tidak sama dengan wilayah warga';
    END IF;
  END IF;
  IF NEW.rt_id IS NULL THEN
    RAISE EXCEPTION 'rt_id wajib diisi';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.master_rt AS m WHERE m.id = NEW.rt_id) THEN
    RAISE EXCEPTION 'rt_id tidak terdaftar di master_rt';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kunci_rt_id_wajib()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.rt_id IS NULL THEN
    RAISE EXCEPTION 'rt_id wajib diisi';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.master_rt AS m WHERE m.id = NEW.rt_id) THEN
    RAISE EXCEPTION 'rt_id tidak terdaftar di master_rt';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kunci_rt_id_dari_arisan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_milik uuid;
BEGIN
  SELECT a.rt_id INTO v_milik
    FROM public.arisan_ibu AS a
   WHERE a.id = NEW.arisan_id;
  IF v_milik IS NULL THEN
    RAISE EXCEPTION 'Arisan tidak punya rt_id sah';
  END IF;
  IF NEW.rt_id IS NULL THEN
    NEW.rt_id := v_milik;
  ELSIF NEW.rt_id IS DISTINCT FROM v_milik THEN
    RAISE EXCEPTION 'rt_id transaksi arisan tidak sama dengan kelompok arisan';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kunci_rt_transaksi_sampah ON public.transaksi_sampah;
CREATE TRIGGER trg_kunci_rt_transaksi_sampah
  BEFORE INSERT OR UPDATE ON public.transaksi_sampah
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_warga();

DROP TRIGGER IF EXISTS trg_kunci_rt_kas ON public.kas_rt;
CREATE TRIGGER trg_kunci_rt_kas
  BEFORE INSERT OR UPDATE ON public.kas_rt
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_warga();

DROP TRIGGER IF EXISTS trg_kunci_rt_laporan_warga ON public.laporan_warga;
CREATE TRIGGER trg_kunci_rt_laporan_warga
  BEFORE INSERT OR UPDATE ON public.laporan_warga
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_warga();

DROP TRIGGER IF EXISTS trg_kunci_rt_peminjaman ON public.peminjaman_inventaris;
CREATE TRIGGER trg_kunci_rt_peminjaman
  BEFORE INSERT OR UPDATE ON public.peminjaman_inventaris
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_warga();

DROP TRIGGER IF EXISTS trg_kunci_rt_ronda ON public.jadwal_ronda;
CREATE TRIGGER trg_kunci_rt_ronda
  BEFORE INSERT OR UPDATE ON public.jadwal_ronda
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_warga();

DROP TRIGGER IF EXISTS trg_kunci_rt_suara ON public.suara_voting;
CREATE TRIGGER trg_kunci_rt_suara
  BEFORE INSERT OR UPDATE ON public.suara_voting
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_warga();

DROP TRIGGER IF EXISTS trg_kunci_rt_lapak ON public.lapak_warga;
CREATE TRIGGER trg_kunci_rt_lapak
  BEFORE INSERT OR UPDATE ON public.lapak_warga
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_warga();

DROP TRIGGER IF EXISTS trg_kunci_rt_limbah ON public.limbah_ekonomis;
CREATE TRIGGER trg_kunci_rt_limbah
  BEFORE INSERT OR UPDATE ON public.limbah_ekonomis
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_warga();

DROP TRIGGER IF EXISTS trg_kunci_rt_tabungan_kurban ON public.tabungan_kurban;
CREATE TRIGGER trg_kunci_rt_tabungan_kurban
  BEFORE INSERT OR UPDATE ON public.tabungan_kurban
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_warga();

DROP TRIGGER IF EXISTS trg_kunci_rt_transaksi_kurban ON public.transaksi_kurban;
CREATE TRIGGER trg_kunci_rt_transaksi_kurban
  BEFORE INSERT OR UPDATE ON public.transaksi_kurban
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_warga();

DROP TRIGGER IF EXISTS trg_kunci_rt_sensus ON public.sensus_kesejahteraan;
CREATE TRIGGER trg_kunci_rt_sensus
  BEFORE INSERT OR UPDATE ON public.sensus_kesejahteraan
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_warga();

DROP TRIGGER IF EXISTS trg_kunci_rt_push ON public.push_langganan;
CREATE TRIGGER trg_kunci_rt_push
  BEFORE INSERT OR UPDATE ON public.push_langganan
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_warga();

DROP TRIGGER IF EXISTS trg_kunci_rt_arisan_tx ON public.arisan_transaksi;
CREATE TRIGGER trg_kunci_rt_arisan_tx
  BEFORE INSERT OR UPDATE ON public.arisan_transaksi
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_arisan();

DROP TRIGGER IF EXISTS trg_kunci_rt_pengumuman ON public.pengumuman_rt;
CREATE TRIGGER trg_kunci_rt_pengumuman
  BEFORE INSERT OR UPDATE ON public.pengumuman_rt
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_wajib();

DROP TRIGGER IF EXISTS trg_kunci_rt_voting ON public.voting_rt;
CREATE TRIGGER trg_kunci_rt_voting
  BEFORE INSERT OR UPDATE ON public.voting_rt
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_wajib();

DROP TRIGGER IF EXISTS trg_kunci_rt_inventaris ON public.master_inventaris;
CREATE TRIGGER trg_kunci_rt_inventaris
  BEFORE INSERT OR UPDATE ON public.master_inventaris
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_wajib();

DROP TRIGGER IF EXISTS trg_kunci_rt_audit ON public.audit_log;
CREATE TRIGGER trg_kunci_rt_audit
  BEFORE INSERT OR UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_wajib();

DROP TRIGGER IF EXISTS trg_kunci_rt_pengurus ON public.pengurus_rt;
CREATE TRIGGER trg_kunci_rt_pengurus
  BEFORE INSERT OR UPDATE ON public.pengurus_rt
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_wajib();

DROP TRIGGER IF EXISTS trg_kunci_rt_jumantik ON public.laporan_jumantik;
CREATE TRIGGER trg_kunci_rt_jumantik
  BEFORE INSERT OR UPDATE ON public.laporan_jumantik
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_wajib();

DROP TRIGGER IF EXISTS trg_kunci_rt_arisan ON public.arisan_ibu;
CREATE TRIGGER trg_kunci_rt_arisan
  BEFORE INSERT OR UPDATE ON public.arisan_ibu
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_wajib();

DROP TRIGGER IF EXISTS trg_kunci_rt_galeri ON public.galeri_kegiatan;
CREATE TRIGGER trg_kunci_rt_galeri
  BEFORE INSERT OR UPDATE ON public.galeri_kegiatan
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_wajib();

DROP TRIGGER IF EXISTS trg_kunci_rt_dokumen ON public.dokumen_publik_rt;
CREATE TRIGGER trg_kunci_rt_dokumen
  BEFORE INSERT OR UPDATE ON public.dokumen_publik_rt
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_wajib();

DROP TRIGGER IF EXISTS trg_kunci_rt_kontak ON public.kontak_darurat_rt;
CREATE TRIGGER trg_kunci_rt_kontak
  BEFORE INSERT OR UPDATE ON public.kontak_darurat_rt
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_wajib();

REVOKE ALL ON FUNCTION public.kunci_rt_id_dari_warga() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kunci_rt_id_wajib() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kunci_rt_id_dari_arisan() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  r record;
  v_sisa integer;
BEGIN
  FOR r IN
    SELECT *
      FROM (VALUES
        ('transaksi_sampah'::text),
        ('kas_rt'),
        ('pengumuman_rt'),
        ('tabungan_kurban'),
        ('laporan_warga'),
        ('peminjaman_inventaris'),
        ('voting_rt'),
        ('suara_voting'),
        ('jadwal_ronda'),
        ('master_inventaris'),
        ('audit_log'),
        ('pengurus_rt'),
        ('lapak_warga'),
        ('laporan_jumantik'),
        ('kunjungan_balita'),
        ('kunjungan_lansia'),
        ('limbah_ekonomis'),
        ('arisan_ibu'),
        ('galeri_kegiatan'),
        ('dokumen_publik_rt'),
        ('kontak_darurat_rt'),
        ('posyandu_balita'),
        ('posyandu_lansia'),
        ('transaksi_kurban'),
        ('sensus_kesejahteraan'),
        ('arisan_transaksi'),
        ('push_langganan')
      ) AS t(nama)
  LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM public.%I WHERE rt_id IS NULL',
      r.nama
    ) INTO v_sisa;
    IF v_sisa > 0 THEN
      RAISE EXCEPTION
        'Backfill rt_id belum selesai: %. masih punya % baris NULL. Petakan manual dari induk, jangan LIMIT 1 master_rt.',
        r.nama, v_sisa;
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE public.transaksi_sampah ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.kas_rt ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.pengumuman_rt ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.tabungan_kurban ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.laporan_warga ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.peminjaman_inventaris ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.voting_rt ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.suara_voting ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.jadwal_ronda ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.master_inventaris ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.audit_log ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.pengurus_rt ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.lapak_warga ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.laporan_jumantik ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.kunjungan_balita ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.kunjungan_lansia ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.limbah_ekonomis ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.arisan_ibu ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.galeri_kegiatan ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.dokumen_publik_rt ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.kontak_darurat_rt ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.posyandu_balita ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.posyandu_lansia ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.transaksi_kurban ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.sensus_kesejahteraan ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.arisan_transaksi ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.push_langganan ALTER COLUMN rt_id SET NOT NULL;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT *
      FROM (VALUES
        ('transaksi_kurban', 'transaksi_kurban_rt_id_fkey'),
        ('sensus_kesejahteraan', 'sensus_kesejahteraan_rt_id_fkey'),
        ('arisan_transaksi', 'arisan_transaksi_rt_id_fkey'),
        ('push_langganan', 'push_langganan_rt_id_fkey'),
        ('galeri_kegiatan', 'galeri_kegiatan_rt_id_fkey'),
        ('dokumen_publik_rt', 'dokumen_publik_rt_rt_id_fkey'),
        ('kontak_darurat_rt', 'kontak_darurat_rt_rt_id_fkey'),
        ('posyandu_balita', 'posyandu_balita_rt_id_fkey'),
        ('posyandu_lansia', 'posyandu_lansia_rt_id_fkey'),
        ('arisan_ibu', 'arisan_ibu_rt_id_fkey'),
        ('limbah_ekonomis', 'limbah_ekonomis_rt_id_fkey')
      ) AS t(nama, kunci)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = r.kunci
         AND conrelid = format('public.%I', r.nama)::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (rt_id) REFERENCES public.master_rt(id) ON DELETE RESTRICT',
        r.nama, r.kunci
      );
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE public.kunjungan_balita VALIDATE CONSTRAINT kunjungan_balita_rt_id_fkey;
ALTER TABLE public.kunjungan_lansia VALIDATE CONSTRAINT kunjungan_lansia_rt_id_fkey;

CREATE INDEX IF NOT EXISTS idx_transaksi_kurban_rt_warga
  ON public.transaksi_kurban (rt_id, warga_id, tanggal_transaksi DESC);
CREATE INDEX IF NOT EXISTS idx_sensus_rt_warga
  ON public.sensus_kesejahteraan (rt_id, warga_id);
CREATE INDEX IF NOT EXISTS idx_arisan_transaksi_rt
  ON public.arisan_transaksi (rt_id, arisan_id);
CREATE INDEX IF NOT EXISTS idx_push_langganan_rt
  ON public.push_langganan (rt_id, warga_id);

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
     AND ts.rt_id = v_rt_id;

  IF p_nominal > v_saldo THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Saldo bank sampah tidak mencukupi';
  END IF;

  INSERT INTO public.transaksi_sampah (
    warga_id, rt_id, jenis_transaksi, keterangan, berat_kg,
    nominal_warga, nominal_kas_rt, tanggal_transaksi
  ) VALUES (
    p_warga_id, v_rt_id, 'Tarik',
    left('Auto-debet untuk tabungan kurban: ' || v_keterangan, 1000),
    0, p_nominal, 0, p_tanggal
  );

  INSERT INTO public.transaksi_kurban (
    warga_id, rt_id, jenis_transaksi, sumber_dana, nominal, keterangan, tanggal_transaksi
  ) VALUES (
    p_warga_id, v_rt_id, 'Setoran (+)', 'Saldo Tabungan Sampah',
    p_nominal, v_keterangan, p_tanggal
  );

  INSERT INTO public.audit_log (aktor, aksi, tabel_target, detail, rt_id)
  VALUES (
    v_aktor,
    'AUTO_DEBET_KURBAN',
    'transaksi_kurban & transaksi_sampah',
    left('Warga ID: ' || p_warga_id::text || ', nominal: ' || p_nominal::text, 2000),
    v_rt_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.proses_autodebet_kurban(UUID, NUMERIC, TEXT, DATE, TEXT) FROM PUBLIC;
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
