-- Rekam medis individu Posyandu (menggantikan rekapitulasi agregat laporan_posyandu)
-- Jalankan di Supabase Dashboard → SQL Editor → Run

CREATE TABLE IF NOT EXISTS public.kunjungan_balita (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  nama_anak TEXT NOT NULL,
  nama_ibu TEXT NOT NULL,
  tanggal_kunjungan DATE NOT NULL,
  berat_kg NUMERIC,
  tinggi_cm NUMERIC,
  imunisasi TEXT,
  catatan TEXT
);

CREATE TABLE IF NOT EXISTS public.kunjungan_lansia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  nama_peserta TEXT NOT NULL,
  tanggal_kunjungan DATE NOT NULL,
  tensi_darah TEXT,
  gula_darah NUMERIC,
  berat_kg NUMERIC,
  catatan TEXT
);

CREATE INDEX IF NOT EXISTS idx_kunjungan_balita_tanggal
  ON public.kunjungan_balita (tanggal_kunjungan DESC);

CREATE INDEX IF NOT EXISTS idx_kunjungan_lansia_tanggal
  ON public.kunjungan_lansia (tanggal_kunjungan DESC);

ALTER TABLE public.kunjungan_balita ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kunjungan_lansia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Izinkan baca kunjungan_balita" ON public.kunjungan_balita;
DROP POLICY IF EXISTS "Izinkan tulis kunjungan_balita" ON public.kunjungan_balita;
DROP POLICY IF EXISTS "Izinkan baca kunjungan_lansia" ON public.kunjungan_lansia;
DROP POLICY IF EXISTS "Izinkan tulis kunjungan_lansia" ON public.kunjungan_lansia;

CREATE POLICY "Izinkan baca kunjungan_balita"
  ON public.kunjungan_balita
  FOR SELECT
  USING (true);

CREATE POLICY "Izinkan tulis kunjungan_balita"
  ON public.kunjungan_balita
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Izinkan baca kunjungan_lansia"
  ON public.kunjungan_lansia
  FOR SELECT
  USING (true);

CREATE POLICY "Izinkan tulis kunjungan_lansia"
  ON public.kunjungan_lansia
  FOR INSERT
  WITH CHECK (true);

GRANT SELECT, INSERT ON TABLE public.kunjungan_balita TO anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.kunjungan_lansia TO anon, authenticated;
