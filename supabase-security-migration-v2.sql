-- ======================================================================================
-- MIGRATION SCRIPT: supabase-security-migration-v2.sql
-- DESKRIPSI: Versi Perbaikan (Statement-Level Triggers) untuk Lolos Uji Penetrasi TC-SEC-03
--            Menggunakan TRIGGER FOR EACH STATEMENT guna memblokir modifikasi audit log
--            sebelum penyaringan RLS terjadi, menghasilkan error 400 eksplisit.
-- TARGET: PostgreSQL (Supabase)
-- ======================================================================================

BEGIN;

-- ======================================================================================
-- 1. EXTENSIONS & PREREQUISITES
-- ======================================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ======================================================================================
-- 2. HASHING PASSWORD PENGURUS RT
-- ======================================================================================
CREATE OR REPLACE FUNCTION hash_password_pengurus()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR NEW.password IS DISTINCT FROM OLD.password) THEN
        NEW.password := crypt(NEW.password, gen_salt('bf', 10));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_hash_password_pengurus ON pengurus_rt;
CREATE TRIGGER tr_hash_password_pengurus
BEFORE INSERT OR UPDATE ON pengurus_rt
FOR EACH ROW
EXECUTE FUNCTION hash_password_pengurus();

CREATE OR REPLACE FUNCTION verifikasi_login_admin(p_username TEXT, p_password TEXT)
RETURNS TABLE (
    id UUID,
    nama_lengkap TEXT,
    jabatan TEXT,
    login_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id, 
        p.nama_lengkap, 
        p.jabatan,
        (p.password = crypt(p_password, p.password)) AS login_valid
    FROM pengurus_rt p
    WHERE p.username = p_username
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================================================
-- 3. PERLINDUNGAN PRIVASI WARGA: MASKING DATA NIK
-- ======================================================================================
CREATE OR REPLACE FUNCTION mask_nik(nik_mentah TEXT)
RETURNS TEXT AS $$
BEGIN
    IF length(nik_mentah) < 12 THEN
        RETURN 'XXXXXXXXXXXXXXXX';
    END IF;
    RETURN substring(nik_mentah FROM 1 FOR 6) || 'XXXXXX' || substring(nik_mentah FROM 13);
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

CREATE OR REPLACE VIEW v_warga_masked AS
SELECT 
    id,
    nama_lengkap,
    mask_nik(nik) AS nik_masked,
    no_whatsapp,
    status_tinggal,
    detail_alamat,
    status_verifikasi,
    created_at
FROM warga;

-- ======================================================================================
-- 4. DATABASE CONSTRAINTS
-- ======================================================================================
ALTER TABLE kas_rt DROP CONSTRAINT IF EXISTS chk_kas_rt_nominal_positif;
ALTER TABLE kas_rt ADD CONSTRAINT chk_kas_rt_nominal_positif CHECK (nominal >= 0);

ALTER TABLE tabungan_kurban DROP CONSTRAINT IF EXISTS chk_kurban_nominal_positif;
ALTER TABLE tabungan_kurban ADD CONSTRAINT chk_kurban_nominal_positif CHECK (nominal >= 0);

ALTER TABLE transaksi_sampah DROP CONSTRAINT IF EXISTS chk_sampah_nominal_positif;
ALTER TABLE transaksi_sampah ADD CONSTRAINT chk_sampah_nominal_positif CHECK (nominal_warga >= 0 AND nominal_kas_rt >= 0);

-- ======================================================================================
-- 5. SERVER-SIDE AGGREGATIONS VIEWS
-- ======================================================================================
CREATE OR REPLACE VIEW v_rekap_kas_rt AS
SELECT 
    COALESCE(SUM(CASE WHEN tipe_transaksi = 'Pemasukan' THEN nominal ELSE 0 END), 0) AS total_pemasukan,
    COALESCE(SUM(CASE WHEN tipe_transaksi = 'Pengeluaran' THEN nominal ELSE 0 END), 0) AS total_pengeluaran,
    (COALESCE(SUM(CASE WHEN tipe_transaksi = 'Pemasukan' THEN nominal ELSE 0 END), 0) - 
     COALESCE(SUM(CASE WHEN tipe_transaksi = 'Pengeluaran' THEN nominal ELSE 0 END), 0)) AS saldo_akhir
FROM kas_rt;

CREATE OR REPLACE VIEW v_saldo_kurban_warga AS
SELECT 
    w.id AS warga_id,
    w.nama_lengkap,
    COALESCE(SUM(CASE WHEN tk.jenis_transaksi = 'Setor' THEN tk.nominal ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN tk.jenis_transaksi = 'Tarik' THEN tk.nominal ELSE 0 END), 0) AS saldo_kurban
FROM warga w
LEFT JOIN tabungan_kurban tk ON w.id = tk.warga_id
GROUP BY w.id, w.nama_lengkap;

CREATE OR REPLACE VIEW v_saldo_sampah_warga AS
SELECT 
    w.id AS warga_id,
    w.nama_lengkap,
    COALESCE(SUM(CASE WHEN ts.jenis_transaksi = 'Setor' THEN ts.nominal_warga ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN ts.jenis_transaksi = 'Tarik' THEN ts.nominal_warga ELSE 0 END), 0) AS saldo_sampah
FROM warga w
LEFT JOIN transaksi_sampah ts ON w.id = ts.warga_id
GROUP BY w.id, w.nama_lengkap;

-- ======================================================================================
-- 6. IMMUTABLE AUDIT LOGS VIA TRIGGERS
-- ======================================================================================
CREATE OR REPLACE FUNCTION log_aktivitas_otomatis()
RETURNS TRIGGER AS $$
DECLARE
    v_aktor TEXT;
    v_detail TEXT;
BEGIN
    v_aktor := COALESCE(
        (SELECT email FROM auth.users WHERE id = auth.uid()),
        current_setting('request.jwt.claims', true)::json->>'email',
        'SYSTEM/DB_TRIGGER'
    );

    -- Audit hanya menyimpan metadata operasi. row_to_json(OLD/NEW) dilarang
    -- karena menyalin NIK, nomor kontak, alamat, hash PIN, dan path dokumen.
    IF (TG_OP = 'INSERT') THEN
        v_detail := 'Pencatatan data baru pada tabel ' || TG_TABLE_NAME || ' dengan ID: ' || NEW.id;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_detail := 'Perubahan data tabel ' || TG_TABLE_NAME || ' pada ID: ' || OLD.id;
    ELSIF (TG_OP = 'DELETE') THEN
        v_detail := 'Penghapusan data tabel ' || TG_TABLE_NAME || ' pada ID: ' || OLD.id;
    END IF;

    INSERT INTO public.audit_log (aktor, aksi, tabel_target, detail)
    VALUES (v_aktor, TG_OP || ' ON ' || TG_TABLE_NAME, TG_TABLE_NAME, v_detail);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

DROP TRIGGER IF EXISTS tr_audit_warga ON warga;
CREATE TRIGGER tr_audit_warga AFTER INSERT OR UPDATE OR DELETE ON warga FOR EACH ROW EXECUTE FUNCTION log_aktivitas_otomatis();

DROP TRIGGER IF EXISTS tr_audit_kas_rt ON kas_rt;
CREATE TRIGGER tr_audit_kas_rt AFTER INSERT OR UPDATE OR DELETE ON kas_rt FOR EACH ROW EXECUTE FUNCTION log_aktivitas_otomatis();

DROP TRIGGER IF EXISTS tr_audit_peminjaman_inventaris ON peminjaman_inventaris;
CREATE TRIGGER tr_audit_peminjaman_inventaris AFTER INSERT OR UPDATE OR DELETE ON peminjaman_inventaris FOR EACH ROW EXECUTE FUNCTION log_aktivitas_otomatis();

-- ======================================================================================
-- 6B. PERBAIKAN FATAL: PERLINDUNGAN STATEMEN AUDIT LOG (STATEMENT-LEVEL IMMUTABILITY)
-- ======================================================================================
-- Sebelumnya menggunakan FOR EACH ROW yang dilewati secara diam-diam oleh PostgREST/RLS 
-- karena 0 baris tersaring. Dengan menggunakan FOR EACH STATEMENT, trigger dipaksa berjalan 
-- sebelum kueri dieksekusi dan langsung mengembalikan kode kesalahan 400.

CREATE OR REPLACE FUNCTION proteksi_audit_log_immutable_statement()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'KEBIJAKAN KEAMANAN: Catatan Audit Log bersifat IMMUTABLE, dilarang merubah atau menghapus rekaman!';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Hapus trigger baris yang lama
DROP TRIGGER IF EXISTS tr_proteksi_audit_log ON audit_log;

-- Pasang trigger tingkat STATEMEN yang baru
DROP TRIGGER IF EXISTS tr_proteksi_audit_log_statement ON audit_log;
CREATE TRIGGER tr_proteksi_audit_log_statement
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH STATEMENT
EXECUTE FUNCTION proteksi_audit_log_immutable_statement();

-- ======================================================================================
-- 7. ATOMIC TRANSACTION: AUTO-DEBET TABUNGAN KURBAN DARI BANK SAMPAH
-- ======================================================================================
CREATE OR REPLACE FUNCTION eksekusi_autodebet_kurban(
  p_warga_id UUID,
  p_nominal INT,
  p_keterangan TEXT
) RETURNS VOID AS $$
DECLARE
  v_saldo_sampah INT;
BEGIN
  SELECT saldo_sampah INTO v_saldo_sampah FROM v_saldo_sampah_warga WHERE warga_id = p_warga_id;

  IF v_saldo_sampah IS NULL OR p_nominal > v_saldo_sampah THEN
    RAISE EXCEPTION 'TRANSAKSI BATAL: Saldo Bank Sampah tidak mencukupi! Saldo Anda: Rp %, Nominal Debet: Rp %', 
                    COALESCE(v_saldo_sampah, 0), p_nominal;
  END IF;

  INSERT INTO tabungan_kurban (warga_id, jenis_transaksi, sumber_dana, nominal, keterangan)
  VALUES (p_warga_id, 'Setor', 'Potong Saldo Sampah', p_nominal, p_keterangan);

  INSERT INTO transaksi_sampah (warga_id, jenis_transaksi, keterangan, berat_kg, nominal_warga, nominal_kas_rt)
  VALUES (p_warga_id, 'Tarik', 'Auto-Debet untuk Tabungan Kurban: ' || p_keterangan, 0, p_nominal, 0);

  INSERT INTO audit_log (aktor, aksi, tabel_target, detail)
  VALUES ('SYSTEM/FINANCE_ENGINE', 'AUTO_DEBET_KURBAN', 'tabungan_kurban & transaksi_sampah', 
          'Warga ID: ' || p_warga_id || ', Nominal: Rp ' || p_nominal || ' didebet secara atomik.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ======================================================================================
ALTER TABLE pengurus_rt ENABLE ROW LEVEL SECURITY;
ALTER TABLE warga ENABLE ROW LEVEL SECURITY;
ALTER TABLE kas_rt ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabungan_kurban ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi_sampah ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_inventaris ENABLE ROW LEVEL SECURITY;
ALTER TABLE peminjaman_inventaris ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pengurus Terotentikasi dapat mengelola kas" ON kas_rt;
CREATE POLICY "Pengurus Terotentikasi dapat mengelola kas" ON kas_rt FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Warga dapat melihat riwayat kas sendiri" ON kas_rt;
CREATE POLICY "Warga dapat melihat riwayat kas sendiri" ON kas_rt FOR SELECT TO authenticated USING (warga_id = auth.uid());

COMMIT;
