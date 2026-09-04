-- Etalase Portal Warga RT 07
-- Melengkapi modul publik yang belum punya tabel: galeri, dokumen unduhan, panic button.
-- Modul lain (demografi, bank sampah, kurban, pengumuman, jumantik, posyandu, kas)
-- sudah ada dan TIDAK diubah di sini.
--
-- Tulisan ke tabel ini hanya lewat service role (dasbor admin).
-- Anon/authenticated hanya boleh membaca baris yang dipublikasikan/aktif.

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
  TO anon, authenticated
  USING (dipublikasikan = true);

GRANT SELECT ON TABLE public.galeri_kegiatan TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.galeri_kegiatan FROM anon, authenticated;

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
  TO anon, authenticated
  USING (dipublikasikan = true);

GRANT SELECT ON TABLE public.dokumen_publik_rt TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.dokumen_publik_rt FROM anon, authenticated;

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
  TO anon, authenticated
  USING (aktif = true);

GRANT SELECT ON TABLE public.kontak_darurat_rt TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.kontak_darurat_rt FROM anon, authenticated;

-- Nomor nasional resmi, bukan data rekaan.
INSERT INTO public.kontak_darurat_rt (nama_layanan, nomor, keterangan, ikon, urutan, aktif)
VALUES
  ('Polisi', '110', 'Nomor nasional 24 jam', '👮', 10, true),
  ('Pemadam Kebakaran', '113', 'Nomor nasional 24 jam', '🚒', 20, true),
  ('Ambulans', '118', 'Nomor nasional 24 jam', '🚑', 30, true)
ON CONFLICT (nama_layanan) DO NOTHING;
