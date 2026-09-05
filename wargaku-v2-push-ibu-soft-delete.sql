-- ======================================================================================
-- Wargaku V2: Soft-delete warga (e-voting immutable), Web Push, Modul Ibu-ibu
-- Jalankan sekali di Supabase Dashboard → SQL Editor → Run
-- ======================================================================================

BEGIN;

-- Tambahkan nullable lebih dulu. Menambahkan NOT NULL DEFAULT true secara
-- langsung dapat menghidupkan kembali baris yang pada migrasi lama sudah
-- ditolak/diarsipkan tetapi belum memiliki kolom soft-delete.
ALTER TABLE warga
  ADD COLUMN IF NOT EXISTS status_aktif BOOLEAN;

UPDATE warga
   SET status_aktif = CASE
     WHEN lower(coalesce(status_verifikasi, '')) IN ('ditolak', 'arsip', 'nonaktif', 'tidak aktif')
       OR lower(coalesce(status_verifikasi, '')) LIKE '%arsip%'
       OR lower(btrim(coalesce(nama_lengkap, ''))) = 'arsip pemilih'
       -- Prefix 99 sendiri bukan bukti arsip: NIK sah dapat berasal dari
       -- wilayah berkode 99. Arsip yang dibuat aplikasi selalu memakai label
       -- khusus; pertahankan syarat label agar migrasi tidak memblokir warga
       -- sah secara massal.
       OR (
         btrim(coalesce(nik, '')) LIKE '99%'
         AND lower(btrim(coalesce(nama_lengkap, ''))) = 'arsip pemilih'
       )
     THEN false
     ELSE true
   END
 WHERE status_aktif IS NULL;

ALTER TABLE warga
  ALTER COLUMN status_aktif SET DEFAULT true,
  ALTER COLUMN status_aktif SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_warga_status_aktif ON warga (status_aktif);

CREATE TABLE IF NOT EXISTS push_langganan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warga_id UUID NOT NULL REFERENCES warga(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_langganan_warga ON push_langganan (warga_id);

CREATE TABLE IF NOT EXISTS notifikasi_riwayat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis TEXT NOT NULL,
  kunci_unik TEXT NOT NULL,
  judul TEXT,
  isi TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_notifikasi_riwayat UNIQUE (jenis, kunci_unik)
);

CREATE TABLE IF NOT EXISTS posyandu_lansia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id UUID,
  nama_peserta TEXT NOT NULL,
  tanggal_lahir DATE,
  tanggal_kunjungan DATE NOT NULL DEFAULT CURRENT_DATE,
  tekanan_darah TEXT,
  gula_darah TEXT,
  berat_kg NUMERIC(6,2),
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posyandu_balita (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id UUID,
  nama_anak TEXT NOT NULL,
  nama_ibu TEXT,
  tanggal_lahir DATE,
  tanggal_kunjungan DATE NOT NULL DEFAULT CURRENT_DATE,
  berat_kg NUMERIC(6,2),
  tinggi_cm NUMERIC(6,2),
  imunisasi TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS arisan_ibu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id UUID,
  nama_anggota TEXT NOT NULL,
  no_whatsapp TEXT,
  tanggal_daftar DATE DEFAULT CURRENT_DATE,
  status_keanggotaan TEXT NOT NULL DEFAULT 'Aktif',
  setoran_terakhir NUMERIC(14,2) DEFAULT 0,
  pinjaman_berjalan NUMERIC(14,2) DEFAULT 0,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS arisan_transaksi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arisan_id UUID NOT NULL REFERENCES arisan_ibu(id) ON DELETE CASCADE,
  jenis TEXT NOT NULL DEFAULT 'Setoran',
  nominal NUMERIC(14,2) NOT NULL DEFAULT 0,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE push_langganan ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifikasi_riwayat ENABLE ROW LEVEL SECURITY;
ALTER TABLE posyandu_lansia ENABLE ROW LEVEL SECURITY;
ALTER TABLE posyandu_balita ENABLE ROW LEVEL SECURITY;
ALTER TABLE arisan_ibu ENABLE ROW LEVEL SECURITY;
ALTER TABLE arisan_transaksi ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  ALTER TABLE partisipasi_pemilihan
    DROP CONSTRAINT IF EXISTS partisipasi_pemilihan_warga_id_fkey;
  ALTER TABLE partisipasi_pemilihan
    ADD CONSTRAINT partisipasi_pemilihan_warga_id_fkey
    FOREIGN KEY (warga_id) REFERENCES warga(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

COMMIT;
