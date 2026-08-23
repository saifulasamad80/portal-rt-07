-- ======================================================================================
-- MIGRATION SCRIPT: portal-security-migration.sql
-- DESKRIPSI: Setup Keamanan Otentikasi Warga Mandiri (Hashing Password, RPC Login, 
--            dan Penambahan Kolom Kredensial pada Tabel Warga)
-- TARGET: PostgreSQL (Supabase)
-- ======================================================================================

BEGIN;

-- 1. TAMBAHKAN KOLOM PASSWORD PADA TABEL WARGA (JIKA BELUM ADA)
-- Menggunakan blok DO untuk mencegah error jika kolom sudah ada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='warga' AND column_name='password'
    ) THEN
        ALTER TABLE warga ADD COLUMN password TEXT;
    END IF;
END $$;

-- 2. AUTOMATIC BCRYPT HASHING UNTUK PASSWORD WARGA
CREATE OR REPLACE FUNCTION hash_password_warga()
RETURNS TRIGGER AS $$
BEGIN
    -- Hanya lakukan hashing jika password baru dimasukkan atau diubah
    IF (NEW.password IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.password IS DISTINCT FROM OLD.password)) THEN
        -- Memastikan password tidak disimpan polos, langsung di-hash dengan bcrypt (bf)
        NEW.password := crypt(NEW.password, gen_salt('bf', 10));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_hash_password_warga ON warga;
CREATE TRIGGER tr_hash_password_warga
BEFORE INSERT OR UPDATE ON warga
FOR EACH ROW
EXECUTE FUNCTION hash_password_warga();

-- 3. RPC VERIFIKASI LOGIN WARGA DI SISI SERVER (ANTI BYPASS)
CREATE OR REPLACE FUNCTION verifikasi_login_warga(p_nik TEXT, p_password TEXT)
RETURNS TABLE (
    id UUID,
    nama_lengkap TEXT,
    no_whatsapp TEXT,
    status_tinggal TEXT,
    detail_alamat TEXT,
    status_verifikasi TEXT,
    login_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id, 
        w.nama_lengkap, 
        w.no_whatsapp,
        w.status_tinggal,
        w.detail_alamat,
        w.status_verifikasi,
        (w.password IS NOT NULL AND w.password = crypt(p_password, w.password)) AS login_valid
    FROM warga w
    WHERE w.nik = p_nik
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. KEBIJAKAN RLS WARGA MANDIRI (ROW LEVEL SECURITY)
-- Mengizinkan warga mengakses data milik mereka sendiri secara aman berdasarkan JWT token
ALTER TABLE warga ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Warga hanya bisa membaca profil sendiri" ON warga;
CREATE POLICY "Warga hanya bisa membaca profil sendiri" 
ON warga FOR SELECT 
TO authenticated 
USING (id = auth.uid());

DROP POLICY IF EXISTS "Warga hanya bisa memperbarui profil sendiri" ON warga;
CREATE POLICY "Warga hanya bisa memperbarui profil sendiri" 
ON warga FOR UPDATE 
TO authenticated 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

COMMIT;
