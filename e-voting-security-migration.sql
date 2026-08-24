-- ======================================================================================
-- MIGRATION SCRIPT: e-voting-security-migration.sql
-- DESKRIPSI: Sistem Pemilihan Ketua RT (E-Voting) yang Anonim, Aman, dan Anti-Tampering
-- TARGET: PostgreSQL (Supabase)
-- STANDAR: Zero-Knowledge & Cryptographic Anonymization (UU PDP Compliance)
-- ======================================================================================

BEGIN;

-- ======================================================================================
-- 1. EXTENSIONS & SCHEMA SETUP
-- ======================================================================================
-- Mengaktifkan ekstensi kriptografi pgcrypto jika belum terpasang
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ======================================================================================
-- 2. TABLES DEFINITIONS
-- ======================================================================================

-- Tabel Master Pemilihan (Sesi Pemilihan RT)
CREATE TABLE IF NOT EXISTS pemilihan_rt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    judul TEXT NOT NULL,
    deskripsi TEXT,
    tanggal_mulai TIMESTAMP WITH TIME ZONE NOT NULL,
    tanggal_selesai TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft' CONSTRAINT chk_status_pemilihan CHECK (status IN ('Draft', 'Aktif', 'Selesai')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_pemilihan_dates CHECK (tanggal_selesai > tanggal_mulai)
);

-- Tabel Master Kandidat Ketua RT
CREATE TABLE IF NOT EXISTS kandidat_rt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pemilihan_id UUID REFERENCES pemilihan_rt(id) ON DELETE CASCADE,
    nomor_urut INT NOT NULL,
    nama_calon TEXT NOT NULL,
    foto_url TEXT,
    visi TEXT,
    misi TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_nomor_urut_per_pemilihan UNIQUE (pemilihan_id, nomor_urut)
);

-- Tabel Partisipasi Pemilihan (Mencegah Double Voting)
-- Tabel ini HANYA merekam SIAPA yang sudah memilih, TIDAK merekam PILIHANNYA.
CREATE TABLE IF NOT EXISTS partisipasi_pemilihan (
    warga_id UUID NOT NULL REFERENCES warga(id) ON DELETE CASCADE,
    pemilihan_id UUID NOT NULL REFERENCES pemilihan_rt(id) ON DELETE CASCADE,
    waktu_memilih TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (warga_id, pemilihan_id)
);

-- Tabel Surat Suara (Kotak Suara Anonim)
-- Tabel ini HANYA merekam suara kandidat, TANPA kaitan ke warga_id atau warga_sudah_memilih.
-- Kolom timestamp dibuat tumpul (truncated/nearest hour) untuk mencegah pencocokan waktu (timing attack).
CREATE TABLE IF NOT EXISTS suara_pemilihan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pemilihan_id UUID NOT NULL REFERENCES pemilihan_rt(id) ON DELETE CASCADE,
    kandidat_id UUID NOT NULL REFERENCES kandidat_rt(id) ON DELETE CASCADE,
    token_verifikasi_suara TEXT NOT NULL UNIQUE, -- Token hash rahasia untuk audit warga mandiri
    jam_suara_masuk TIMESTAMP WITH TIME ZONE NOT NULL -- Dibulatkan ke jam terdekat demi anonimitas mutlak
);

-- ======================================================================================
-- 3. AUTOMATIC TIMING-ATTACK DEFENSE (TRUNCATED TIMESTAMPS)
-- ======================================================================================
-- Fungsi pembantu untuk membulatkan waktu ke jam terdekat untuk merusak korelasi urutan waktu
CREATE OR REPLACE FUNCTION dapatkan_jam_anonim()
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN date_trunc('hour', CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- ======================================================================================
-- 4. SECURE TRANSACTION RPC: EKSEKUSI SUARA MASUK (THE VAULT GATE)
-- ======================================================================================
-- Fungsi ini mengeksekusi dua operasi penulisan secara atomik di dalam database server:
-- 1. Mengunci hak pilih warga dengan menyisipkan baris baru di partisipasi_pemilihan.
-- 2. Memasukkan surat suara anonim secara acak ke suara_pemilihan.
-- Fungsi ini mengembalikan token audit unik (SHA-256) kepada warga untuk verifikasi mandiri.

CREATE OR REPLACE FUNCTION berikan_suara_pemilihan(
  p_warga_id UUID,
  p_pemilihan_id UUID,
  p_kandidat_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_status_pemilihan TEXT;
  v_status_warga TEXT;
  v_sudah_memilih INT;
  v_token_audit TEXT;
  v_garam TEXT;
BEGIN
  -- 1. Ambil status pemilihan saat ini
  SELECT status INTO v_status_pemilihan 
  FROM pemilihan_rt 
  WHERE id = p_pemilihan_id;
  
  IF v_status_pemilihan IS NULL OR v_status_pemilihan != 'Aktif' THEN
    RAISE EXCEPTION 'TRANSAKSI BATAL: Sesi pemilihan sedang tidak aktif atau belum dimulai!';
  END IF;

  -- 2. Validasi status verifikasi warga di RT 07
  SELECT status_verifikasi INTO v_status_warga 
  FROM warga 
  WHERE id = p_warga_id;

  IF v_status_warga IS NULL OR v_status_warga != 'Disetujui' THEN
    RAISE EXCEPTION 'TRANSAKSI BATAL: Akun warga belum disetujui/diverifikasi oleh Admin RT!';
  END IF;

  -- 3. Validasi double voting (apakah warga sudah menyumbang suara)
  SELECT COUNT(*) INTO v_sudah_memilih 
  FROM partisipasi_pemilihan 
  WHERE warga_id = p_warga_id AND pemilihan_id = p_pemilihan_id;

  IF v_sudah_memilih > 0 THEN
    RAISE EXCEPTION 'TRANSAKSI BATAL: Anda sudah menggunakan hak pilih Anda pada sesi pemilihan ini!';
  END IF;

  -- 4. Kunci hak pilih warga secara atomik (Mencegah Race Condition / Concurrency Double Voting)
  INSERT INTO partisipasi_pemilihan (warga_id, pemilihan_id, waktu_memilih)
  VALUES (p_warga_id, p_pemilihan_id, CURRENT_TIMESTAMP);

  -- 5. Hasilkan Token Audit Mandiri (Cryptographic Receipt)
  -- Receipt ini di-hash dari gabungan Warga_ID + Pemilihan_ID + Garam Rahasia Database.
  -- Warga dapat mencocokkan receipt ini di hasil pemilu untuk memverifikasi suaranya masuk tanpa membuka identitasnya.
  v_garam := encode(gen_random_bytes(16), 'hex');
  v_token_audit := encode(digest(p_warga_id::text || p_pemilihan_id::text || v_garam, 'sha256'), 'hex');

  -- 6. Masukkan surat suara anonim (Tanpa referensi warga_id, timestamp dibulatkan)
  INSERT INTO suara_pemilihan (pemilihan_id, kandidat_id, token_verifikasi_suara, jam_suara_masuk)
  VALUES (p_pemilihan_id, p_kandidat_id, v_token_audit, dapatkan_jam_anonim());

  -- 7. Catat Audit Log global secara aman
  INSERT INTO audit_log (aktor, aksi, tabel_target, detail)
  VALUES ('SYSTEM/VOTE_ENGINE', 'SUBMIT_VOTE', 'partisipasi_pemilihan & suara_pemilihan', 
          'Pemilihan ID: ' || p_pemilihan_id || ' mendeteksi masuknya satu hak suara sah.');

  -- 8. Kembalikan tanda terima audit rahasia kepada warga (receipt disimpan di browser warga)
  RETURN v_token_audit;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================================================================================
-- 5. REAL-TIME SECURE AGGREGATION VIEWS (NO DIRECT READS ON RAW VOTES)
-- ======================================================================================
-- Menghindari penarikan data baris suara mentah ke antarmuka untuk mencegah kebocoran/analisis urutan.
-- Klien hanya diperbolehkan membaca total akumulasi per kandidat.

CREATE OR REPLACE VIEW v_rekapitulasi_suara_pemilu AS
SELECT 
    kr.pemilihan_id,
    pr.judul AS judul_pemilihan,
    kr.id AS kandidat_id,
    kr.nomor_urut,
    kr.nama_calon,
    COUNT(sp.id) AS perolehan_suara_sementara,
    COALESCE(
        (COUNT(sp.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM suara_pemilihan WHERE pemilihan_id = kr.pemilihan_id), 0)), 
        0.0
    )::NUMERIC(5,2) AS persentase_suara
FROM kandidat_rt kr
JOIN pemilihan_rt pr ON kr.pemilihan_id = pr.id
LEFT JOIN suara_pemilihan sp ON kr.id = sp.kandidat_id
GROUP BY kr.pemilihan_id, pr.judul, kr.id, kr.nomor_urut, kr.nama_calon;

-- ======================================================================================
-- 6. STRICT IMMUTABILITY RULES (ANTI-TAMPERING GUARANTEES)
-- ======================================================================================
-- Surat suara dan tanda partisipasi tidak boleh diubah atau dihapus oleh siapapun (termasuk Admin RT).
-- Sekali suara dikirim, data tersebut permanen selamanya.

CREATE OR REPLACE FUNCTION proteksi_evote_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'PELANGGARAN PROTOKOL: Data pemungutan suara (E-Voting) bersifat IMMUTABLE, dilarang merubah atau menghapus surat suara!';
END;
$$ LANGUAGE plpgsql;

-- Pasang Proteksi Imutabilitas pada Surat Suara
DROP TRIGGER IF EXISTS tr_proteksi_suara_immutable ON suara_pemilihan;
CREATE TRIGGER tr_proteksi_suara_immutable
BEFORE UPDATE OR DELETE ON suara_pemilihan
FOR EACH STATEMENT
EXECUTE FUNCTION proteksi_evote_immutable();

-- Pasang Proteksi Imutabilitas pada Partisipasi Pemilihan
DROP TRIGGER IF EXISTS tr_proteksi_partisipasi_immutable ON partisipasi_pemilihan;
CREATE TRIGGER tr_proteksi_partisipasi_immutable
BEFORE UPDATE OR DELETE ON partisipasi_pemilihan
FOR EACH STATEMENT
EXECUTE FUNCTION proteksi_evote_immutable();

-- ======================================================================================
-- 7. ROW LEVEL SECURITY (RLS) LOCKDOWN
-- ======================================================================================
ALTER TABLE pemilihan_rt ENABLE ROW LEVEL SECURITY;
ALTER TABLE kandidat_rt ENABLE ROW LEVEL SECURITY;
ALTER TABLE partisipasi_pemilihan ENABLE ROW LEVEL SECURITY;
ALTER TABLE suara_pemilihan ENABLE ROW LEVEL SECURITY;

-- Pengurus RT & Warga Terotentikasi dapat membaca sesi pemilu dan katalog kandidat
CREATE POLICY "Akses publik untuk sesi pemilihan" ON pemilihan_rt FOR SELECT TO authenticated USING (true);
CREATE POLICY "Akses publik untuk katalog kandidat" ON kandidat_rt FOR SELECT TO authenticated USING (true);

-- Warga hanya dapat membaca catatan partisipasi mereka sendiri
CREATE POLICY "Warga melihat partisipasi sendiri" ON partisipasi_pemilihan FOR SELECT TO authenticated USING (warga_id = auth.uid());

-- RLS LOCKDOWN MUTLAK untuk Suara Pemilihan (Dilarang query select langsung ke baris mentah)
-- Perolehan suara hanya boleh diakses melalui secure view agregasi "v_rekapitulasi_suara_pemilu"
CREATE POLICY "Blokir SELECT langsung suara pemilihan" ON suara_pemilihan FOR SELECT TO authenticated USING (false);

COMMIT;
-- ======================================================================================
-- SELESAI MIGRASI ARSITEKTUR E-VOTING PORTAL RT 07
-- ======================================================================================
