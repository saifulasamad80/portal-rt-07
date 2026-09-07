-- Etalase Portal Warga RT 07
-- Melengkapi modul publik yang belum punya tabel: galeri, dokumen unduhan, panic button.
-- Modul lain (demografi, bank sampah, kurban, pengumuman, jumantik, posyandu, kas)
-- sudah ada dan TIDAK diubah di sini.
--
-- Tulisan ke tabel ini hanya lewat service role (dasbor admin).
-- Browser publik membaca lewat Next.js DAL. Anon tidak boleh mengakses tabel
-- etalase secara langsung; authenticated dikelola migrasi tenant-aware.

-- ---------------------------------------------------------------------------
-- 1. Galeri Kegiatan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.galeri_kegiatan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  judul TEXT NOT NULL,
  deskripsi TEXT,
  url_foto TEXT NOT NULL,
  kategori TEXT,
  tanggal_kegiatan DATE,
  dipublikasikan BOOLEAN NOT NULL DEFAULT true,
  urutan INTEGER NOT NULL DEFAULT 0,
  rt_id UUID
);

CREATE INDEX IF NOT EXISTS idx_galeri_kegiatan_terbit
  ON public.galeri_kegiatan (tanggal_kegiatan DESC NULLS LAST, urutan ASC)
  WHERE dipublikasikan = true;

ALTER TABLE public.galeri_kegiatan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Publik baca galeri terbit" ON public.galeri_kegiatan;
CREATE POLICY "Publik baca galeri terbit"
  ON public.galeri_kegiatan
  FOR SELECT
  TO anon
  USING (false);

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.galeri_kegiatan FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.galeri_kegiatan TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Dokumen publik warga (bukan berkas KTP/KK di bucket dokumen_warga)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dokumen_publik_rt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  judul TEXT NOT NULL,
  deskripsi TEXT,
  kategori TEXT,
  url_berkas TEXT NOT NULL,
  ukuran_berkas TEXT,
  tanggal_terbit DATE,
  dipublikasikan BOOLEAN NOT NULL DEFAULT true,
  urutan INTEGER NOT NULL DEFAULT 0,
  rt_id UUID
);

CREATE INDEX IF NOT EXISTS idx_dokumen_publik_terbit
  ON public.dokumen_publik_rt (tanggal_terbit DESC NULLS LAST, urutan ASC)
  WHERE dipublikasikan = true;

ALTER TABLE public.dokumen_publik_rt ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Publik baca dokumen terbit" ON public.dokumen_publik_rt;
CREATE POLICY "Publik baca dokumen terbit"
  ON public.dokumen_publik_rt
  FOR SELECT
  TO anon
  USING (false);

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.dokumen_publik_rt FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dokumen_publik_rt TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Kontak darurat (Panic Button)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kontak_darurat_rt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  nama_layanan TEXT NOT NULL,
  nomor TEXT NOT NULL,
  keterangan TEXT,
  ikon TEXT,
  urutan INTEGER NOT NULL DEFAULT 0,
  aktif BOOLEAN NOT NULL DEFAULT true,
  rt_id UUID,
  CONSTRAINT uq_kontak_darurat_nama UNIQUE (nama_layanan)
);

CREATE INDEX IF NOT EXISTS idx_kontak_darurat_aktif
  ON public.kontak_darurat_rt (urutan ASC)
  WHERE aktif = true;

ALTER TABLE public.kontak_darurat_rt ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Publik baca kontak darurat aktif" ON public.kontak_darurat_rt;
CREATE POLICY "Publik baca kontak darurat aktif"
  ON public.kontak_darurat_rt
  FOR SELECT
  TO anon
  USING (false);

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.kontak_darurat_rt FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kontak_darurat_rt TO authenticated;

-- Kontak resmi dan kontak lokal yang diberikan pengurus RT.
INSERT INTO public.kontak_darurat_rt (nama_layanan, nomor, keterangan, ikon, urutan, aktif)
VALUES
  ('Layanan Panggilan Darurat Terpadu', '112', 'Nomor darurat terpadu', '🚨', 10, true),
  ('Kepolisian Republik Indonesia (Polri)', '110', 'Nomor nasional 24 jam', '👮', 20, true),
  ('Ambulans & Layanan Medis Darurat', '119 / 118', 'Nomor layanan medis darurat', '🚑', 30, true),
  ('Pemadam Kebakaran', '113 / 1131', 'Nomor pemadam kebakaran', '🚒', 40, true),
  ('Bimas Kelurahan Tengah', '081293488745', 'Kontak Bimas wilayah', '🛡️', 50, true),
  ('Babinsa Kelurahan Tengah', '082112643400', 'Kontak Babinsa wilayah', '🪖', 60, true)
ON CONFLICT (nama_layanan) DO UPDATE SET
  nomor = EXCLUDED.nomor,
  keterangan = EXCLUDED.keterangan,
  ikon = EXCLUDED.ikon,
  urutan = EXCLUDED.urutan,
  aktif = EXCLUDED.aktif;
