-- H6 / PR2: isolasi tenant pada tabel operasional yang belum punya rt_id.
-- Pengurus hanya boleh DML pada baris rt_id = rt_id sesi/profil mereka.
-- master_rt sengaja tidak diubah: itu katalog tenant, bukan tabel operasional.
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Kolom rt_id + FK ke master_rt
-- ---------------------------------------------------------------------------
ALTER TABLE public.laporan_posyandu
  ADD COLUMN IF NOT EXISTS rt_id uuid;
ALTER TABLE public.pemilihan_rt
  ADD COLUMN IF NOT EXISTS rt_id uuid;
ALTER TABLE public.kandidat_rt
  ADD COLUMN IF NOT EXISTS rt_id uuid;
ALTER TABLE public.partisipasi_pemilihan
  ADD COLUMN IF NOT EXISTS rt_id uuid;
ALTER TABLE public.suara_pemilihan
  ADD COLUMN IF NOT EXISTS rt_id uuid;
ALTER TABLE public.notifikasi_riwayat
  ADD COLUMN IF NOT EXISTS rt_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'laporan_posyandu_rt_id_fkey'
  ) THEN
    ALTER TABLE public.laporan_posyandu
      ADD CONSTRAINT laporan_posyandu_rt_id_fkey
      FOREIGN KEY (rt_id) REFERENCES public.master_rt(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pemilihan_rt_rt_id_fkey'
  ) THEN
    ALTER TABLE public.pemilihan_rt
      ADD CONSTRAINT pemilihan_rt_rt_id_fkey
      FOREIGN KEY (rt_id) REFERENCES public.master_rt(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kandidat_rt_rt_id_fkey'
  ) THEN
    ALTER TABLE public.kandidat_rt
      ADD CONSTRAINT kandidat_rt_rt_id_fkey
      FOREIGN KEY (rt_id) REFERENCES public.master_rt(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partisipasi_pemilihan_rt_id_fkey'
  ) THEN
    ALTER TABLE public.partisipasi_pemilihan
      ADD CONSTRAINT partisipasi_pemilihan_rt_id_fkey
      FOREIGN KEY (rt_id) REFERENCES public.master_rt(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'suara_pemilihan_rt_id_fkey'
  ) THEN
    ALTER TABLE public.suara_pemilihan
      ADD CONSTRAINT suara_pemilihan_rt_id_fkey
      FOREIGN KEY (rt_id) REFERENCES public.master_rt(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifikasi_riwayat_rt_id_fkey'
  ) THEN
    ALTER TABLE public.notifikasi_riwayat
      ADD CONSTRAINT notifikasi_riwayat_rt_id_fkey
      FOREIGN KEY (rt_id) REFERENCES public.master_rt(id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Backfill dari induk. Tabel e-voting/posyandu kosong.
--    notifikasi_riwayat: 1 baris, hanya diisi jika instalasi masih 1 tenant.
--    Trigger imutabilitas e-voting di-nonaktifkan hanya untuk jendela ini.
-- ---------------------------------------------------------------------------
ALTER TABLE public.partisipasi_pemilihan DISABLE TRIGGER tr_proteksi_partisipasi_immutable;
ALTER TABLE public.suara_pemilihan DISABLE TRIGGER tr_proteksi_suara_immutable;

UPDATE public.kandidat_rt AS k
   SET rt_id = p.rt_id
  FROM public.pemilihan_rt AS p
 WHERE k.pemilihan_id = p.id
   AND k.rt_id IS NULL
   AND p.rt_id IS NOT NULL;

UPDATE public.partisipasi_pemilihan AS pp
   SET rt_id = w.rt_id
  FROM public.warga AS w
 WHERE pp.warga_id = w.id
   AND pp.rt_id IS NULL
   AND w.rt_id IS NOT NULL;

UPDATE public.suara_pemilihan AS s
   SET rt_id = p.rt_id
  FROM public.pemilihan_rt AS p
 WHERE s.pemilihan_id = p.id
   AND s.rt_id IS NULL
   AND p.rt_id IS NOT NULL;

DO $$
DECLARE
  v_rt uuid;
  v_jumlah_master integer;
  v_jumlah_warga_rt integer;
BEGIN
  SELECT COUNT(*) INTO v_jumlah_master FROM public.master_rt;
  SELECT COUNT(DISTINCT rt_id) INTO v_jumlah_warga_rt
    FROM public.warga
   WHERE rt_id IS NOT NULL;
  IF v_jumlah_master <> 1 OR v_jumlah_warga_rt <> 1 THEN
    RETURN;
  END IF;
  SELECT id INTO v_rt FROM public.master_rt;
  IF v_rt IS NULL
     OR EXISTS (SELECT 1 FROM public.warga WHERE rt_id IS DISTINCT FROM v_rt) THEN
    RETURN;
  END IF;

  UPDATE public.laporan_posyandu SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.pemilihan_rt SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.kandidat_rt SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.partisipasi_pemilihan SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.suara_pemilihan SET rt_id = v_rt WHERE rt_id IS NULL;
  UPDATE public.notifikasi_riwayat SET rt_id = v_rt WHERE rt_id IS NULL;
END $$;

ALTER TABLE public.partisipasi_pemilihan ENABLE TRIGGER tr_proteksi_partisipasi_immutable;
ALTER TABLE public.suara_pemilihan ENABLE TRIGGER tr_proteksi_suara_immutable;

ALTER TABLE public.laporan_posyandu ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.pemilihan_rt ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.kandidat_rt ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.partisipasi_pemilihan ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.suara_pemilihan ALTER COLUMN rt_id SET NOT NULL;
ALTER TABLE public.notifikasi_riwayat ALTER COLUMN rt_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_laporan_posyandu_rt_id
  ON public.laporan_posyandu (rt_id);
CREATE INDEX IF NOT EXISTS idx_pemilihan_rt_rt_id
  ON public.pemilihan_rt (rt_id);
CREATE INDEX IF NOT EXISTS idx_kandidat_rt_rt_id
  ON public.kandidat_rt (rt_id);
CREATE INDEX IF NOT EXISTS idx_partisipasi_pemilihan_rt_id
  ON public.partisipasi_pemilihan (rt_id);
CREATE INDEX IF NOT EXISTS idx_suara_pemilihan_rt_id
  ON public.suara_pemilihan (rt_id);
CREATE INDEX IF NOT EXISTS idx_notifikasi_riwayat_rt_id
  ON public.notifikasi_riwayat (rt_id);

ALTER TABLE public.notifikasi_riwayat
  DROP CONSTRAINT IF EXISTS uq_notifikasi_riwayat;
ALTER TABLE public.notifikasi_riwayat
  ADD CONSTRAINT uq_notifikasi_riwayat UNIQUE (rt_id, jenis, kunci_unik);

-- ---------------------------------------------------------------------------
-- 3. Trigger kunci rt_id: induk sesi untuk anak e-voting; wajib untuk induk.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kunci_rt_id_dari_pemilihan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_milik uuid;
BEGIN
  IF NEW.pemilihan_id IS NULL THEN
    RAISE EXCEPTION 'pemilihan_id wajib agar rt_id bisa dikunci dari sesi';
  END IF;
  SELECT p.rt_id INTO v_milik
    FROM public.pemilihan_rt AS p
   WHERE p.id = NEW.pemilihan_id;
  IF v_milik IS NULL THEN
    RAISE EXCEPTION 'Sesi pemilihan tidak punya rt_id sah';
  END IF;
  IF NEW.rt_id IS NULL THEN
    NEW.rt_id := v_milik;
  ELSIF NEW.rt_id IS DISTINCT FROM v_milik THEN
    RAISE EXCEPTION 'rt_id baris tidak sama dengan sesi pemilihan';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kunci_rt_id_dari_partisipasi_pemilihan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rt_warga uuid;
  v_rt_pemilihan uuid;
BEGIN
  SELECT w.rt_id INTO v_rt_warga
    FROM public.warga AS w
   WHERE w.id = NEW.warga_id;
  SELECT p.rt_id INTO v_rt_pemilihan
    FROM public.pemilihan_rt AS p
   WHERE p.id = NEW.pemilihan_id;
  IF v_rt_warga IS NULL THEN
    RAISE EXCEPTION 'Wilayah warga tidak valid; rt_id wajib ada di induk';
  END IF;
  IF v_rt_pemilihan IS NULL THEN
    RAISE EXCEPTION 'Sesi pemilihan tidak punya rt_id sah';
  END IF;
  IF v_rt_warga IS DISTINCT FROM v_rt_pemilihan THEN
    RAISE EXCEPTION 'Warga bukan pemilih di RT sesi pemilihan ini';
  END IF;
  IF NEW.rt_id IS NULL THEN
    NEW.rt_id := v_rt_warga;
  ELSIF NEW.rt_id IS DISTINCT FROM v_rt_warga THEN
    RAISE EXCEPTION 'rt_id partisipasi tidak sama dengan wilayah warga';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kunci_rt_laporan_posyandu ON public.laporan_posyandu;
CREATE TRIGGER trg_kunci_rt_laporan_posyandu
  BEFORE INSERT OR UPDATE ON public.laporan_posyandu
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_wajib();

DROP TRIGGER IF EXISTS trg_kunci_rt_pemilihan ON public.pemilihan_rt;
CREATE TRIGGER trg_kunci_rt_pemilihan
  BEFORE INSERT OR UPDATE ON public.pemilihan_rt
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_wajib();

DROP TRIGGER IF EXISTS trg_kunci_rt_kandidat ON public.kandidat_rt;
CREATE TRIGGER trg_kunci_rt_kandidat
  BEFORE INSERT OR UPDATE ON public.kandidat_rt
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_pemilihan();

DROP TRIGGER IF EXISTS trg_kunci_rt_partisipasi_pemilihan ON public.partisipasi_pemilihan;
CREATE TRIGGER trg_kunci_rt_partisipasi_pemilihan
  BEFORE INSERT OR UPDATE ON public.partisipasi_pemilihan
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_partisipasi_pemilihan();

DROP TRIGGER IF EXISTS trg_kunci_rt_suara_pemilihan ON public.suara_pemilihan;
CREATE TRIGGER trg_kunci_rt_suara_pemilihan
  BEFORE INSERT OR UPDATE ON public.suara_pemilihan
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_dari_pemilihan();

DROP TRIGGER IF EXISTS trg_kunci_rt_notifikasi_riwayat ON public.notifikasi_riwayat;
CREATE TRIGGER trg_kunci_rt_notifikasi_riwayat
  BEFORE INSERT OR UPDATE ON public.notifikasi_riwayat
  FOR EACH ROW EXECUTE FUNCTION public.kunci_rt_id_wajib();

REVOKE ALL ON FUNCTION public.kunci_rt_id_dari_pemilihan() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kunci_rt_id_dari_partisipasi_pemilihan() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Ganti seluruh policy lama. Policy PERMISSIVE OR-kan; sisa policy
--    adalah_pengurus() tanpa rt_id harus hilang.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN (
         'laporan_posyandu',
         'pemilihan_rt',
         'kandidat_rt',
         'partisipasi_pemilihan',
         'suara_pemilihan',
         'notifikasi_riwayat'
       )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.laporan_posyandu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pemilihan_rt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kandidat_rt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partisipasi_pemilihan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suara_pemilihan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifikasi_riwayat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pengurus kelola laporan posyandu RT sendiri"
  ON public.laporan_posyandu
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

CREATE POLICY "Pengurus kelola sesi pemilihan RT sendiri"
  ON public.pemilihan_rt
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

CREATE POLICY "Pengurus kelola kandidat RT sendiri"
  ON public.kandidat_rt
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

CREATE POLICY "Pengurus kelola partisipasi pemilihan RT sendiri"
  ON public.partisipasi_pemilihan
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

CREATE POLICY "Warga lihat partisipasi sendiri di RT-nya"
  ON public.partisipasi_pemilihan
  FOR SELECT TO authenticated
  USING (
    warga_id = (SELECT auth.uid())
    AND rt_id = (SELECT public.dapatkan_rt_id_saya())
  );

-- Surat suara tetap rahasia: SELECT langsung diblokir.
-- Isolasi tenant RESTRICTIVE menahan policy permissive masa depan.
CREATE POLICY "Blokir SELECT langsung suara pemilihan"
  ON public.suara_pemilihan
  FOR SELECT TO authenticated
  USING (false);

CREATE POLICY "H6 isolasi tenant suara pemilihan"
  ON public.suara_pemilihan
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

CREATE POLICY "Pengurus kelola riwayat notifikasi RT sendiri"
  ON public.notifikasi_riwayat
  FOR ALL TO authenticated
  USING ((SELECT public.klaim_baca_tenant(rt_id)))
  WITH CHECK ((SELECT public.klaim_tulis_tenant(rt_id)));

-- ---------------------------------------------------------------------------
-- 5. RPC e-voting: isi rt_id, tolak lintas-RT, kunci search_path.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.berikan_suara_pemilihan(
  p_warga_id uuid,
  p_pemilihan_id uuid,
  p_kandidat_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_status_pemilihan text;
  v_rt_pemilihan uuid;
  v_status_warga text;
  v_rt_warga uuid;
  v_kandidat_pemilihan uuid;
  v_sudah_memilih integer;
  v_token_audit text;
  v_garam text;
BEGIN
  SELECT status, rt_id
    INTO v_status_pemilihan, v_rt_pemilihan
    FROM public.pemilihan_rt
   WHERE id = p_pemilihan_id;

  IF v_status_pemilihan IS NULL OR v_status_pemilihan <> 'Aktif' THEN
    RAISE EXCEPTION 'TRANSAKSI BATAL: Sesi pemilihan sedang tidak aktif atau belum dimulai!';
  END IF;
  IF v_rt_pemilihan IS NULL THEN
    RAISE EXCEPTION 'TRANSAKSI BATAL: Sesi pemilihan tidak punya rt_id sah';
  END IF;

  SELECT status_verifikasi, rt_id
    INTO v_status_warga, v_rt_warga
    FROM public.warga
   WHERE id = p_warga_id;

  IF v_status_warga IS NULL OR v_status_warga <> 'Disetujui' THEN
    RAISE EXCEPTION 'TRANSAKSI BATAL: Akun warga belum disetujui/diverifikasi oleh Admin RT!';
  END IF;
  IF v_rt_warga IS DISTINCT FROM v_rt_pemilihan THEN
    RAISE EXCEPTION 'TRANSAKSI BATAL: Warga bukan pemilih di RT sesi pemilihan ini';
  END IF;

  SELECT pemilihan_id
    INTO v_kandidat_pemilihan
    FROM public.kandidat_rt
   WHERE id = p_kandidat_id;
  IF v_kandidat_pemilihan IS DISTINCT FROM p_pemilihan_id THEN
    RAISE EXCEPTION 'TRANSAKSI BATAL: Kandidat tidak terdaftar pada sesi pemilihan ini';
  END IF;

  SELECT COUNT(*) INTO v_sudah_memilih
    FROM public.partisipasi_pemilihan
   WHERE warga_id = p_warga_id AND pemilihan_id = p_pemilihan_id;
  IF v_sudah_memilih > 0 THEN
    RAISE EXCEPTION 'TRANSAKSI BATAL: Anda sudah menggunakan hak pilih Anda pada sesi pemilihan ini!';
  END IF;

  INSERT INTO public.partisipasi_pemilihan (warga_id, pemilihan_id, waktu_memilih, rt_id)
  VALUES (p_warga_id, p_pemilihan_id, CURRENT_TIMESTAMP, v_rt_pemilihan);

  v_garam := encode(gen_random_bytes(16), 'hex');
  v_token_audit := encode(digest(p_warga_id::text || p_pemilihan_id::text || v_garam, 'sha256'), 'hex');

  INSERT INTO public.suara_pemilihan (
    pemilihan_id, kandidat_id, token_verifikasi_suara, jam_suara_masuk, rt_id
  )
  VALUES (
    p_pemilihan_id, p_kandidat_id, v_token_audit, public.dapatkan_jam_anonim(), v_rt_pemilihan
  );

  INSERT INTO public.audit_log (aktor, aksi, tabel_target, detail, rt_id)
  VALUES (
    'SYSTEM/VOTE_ENGINE',
    'SUBMIT_VOTE',
    'partisipasi_pemilihan & suara_pemilihan',
    'Pemilihan ID: ' || p_pemilihan_id || ' mendeteksi masuknya satu hak suara sah.',
    v_rt_pemilihan
  );

  RETURN v_token_audit;
END;
$function$;

REVOKE ALL ON FUNCTION public.berikan_suara_pemilihan(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.berikan_suara_pemilihan(uuid, uuid, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Grant: TRUNCATE tidak tunduk RLS; cabut dari klien Data API.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE
  public.laporan_posyandu,
  public.pemilihan_rt,
  public.kandidat_rt,
  public.partisipasi_pemilihan,
  public.suara_pemilihan,
  public.notifikasi_riwayat
FROM anon;

REVOKE TRUNCATE ON TABLE
  public.laporan_posyandu,
  public.pemilihan_rt,
  public.kandidat_rt,
  public.partisipasi_pemilihan,
  public.suara_pemilihan,
  public.notifikasi_riwayat
FROM authenticated, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.laporan_posyandu,
  public.pemilihan_rt,
  public.kandidat_rt,
  public.partisipasi_pemilihan,
  public.suara_pemilihan,
  public.notifikasi_riwayat
TO authenticated;

COMMIT;
