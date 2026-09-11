-- Skema & seed minimal untuk pengembangan lokal (Cloud Agent environment).
--
-- TUJUAN: menyediakan cukup tabel + data contoh agar halaman publik (app/page.tsx)
-- dan Data Access Layer landing (lib/landing-publik.ts, lib/etalase-publik.ts)
-- bisa dijalankan end-to-end tanpa kredensial Supabase produksi.
--
-- Ini BUKAN skema produksi. Tenant, kolom, dan RLS disederhanakan seperlunya
-- untuk demo landing publik. Klien landing memakai service_role sehingga RLS
-- tidak dievaluasi di jalur ini; role anon/authenticated tetap dibuat agar
-- kompatibel dengan PostgREST/supabase-js.

BEGIN;

-- Satu tenant demo bertema "RT 07". UUID vanity ini lolos POLA_UUID proyek.
\set tenant '00000000-0000-0000-0000-000000000007'

DROP TABLE IF EXISTS suara_voting, voting_rt, pengumuman_rt,
  kontak_darurat_rt, dokumen_publik_rt, galeri_kegiatan,
  kunjungan_lansia, kunjungan_balita, laporan_jumantik,
  transaksi_sampah, transaksi_kurban, kas_rt,
  anggota_keluarga, warga, master_rt CASCADE;

CREATE TABLE master_rt (
  id uuid PRIMARY KEY,
  nama_rt text,
  nama_rw text,
  kelurahan text
);

CREATE TABLE warga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id uuid NOT NULL,
  nama_lengkap text,
  tanggal_lahir date,
  jenis_kelamin text,
  agama text,
  pekerjaan text,
  status_verifikasi text NOT NULL DEFAULT 'Menunggu',
  status_aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE anggota_keluarga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id uuid NOT NULL,
  warga_id uuid NOT NULL REFERENCES warga(id) ON DELETE CASCADE,
  nama_lengkap text,
  tanggal_lahir date,
  jenis_kelamin text,
  agama text,
  pekerjaan text
);

CREATE TABLE kas_rt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id uuid NOT NULL,
  tipe_transaksi text NOT NULL,
  nominal numeric NOT NULL DEFAULT 0,
  kategori text,
  keterangan text,
  tanggal_transaksi date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE transaksi_kurban (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id uuid NOT NULL,
  jenis_transaksi text NOT NULL,
  nominal numeric NOT NULL DEFAULT 0,
  warga_id uuid
);

CREATE TABLE transaksi_sampah (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id uuid NOT NULL,
  jenis_transaksi text NOT NULL,
  berat_kg numeric,
  nominal_warga numeric,
  nominal_kas_rt numeric,
  tanggal_transaksi date
);

CREATE TABLE laporan_jumantik (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id uuid NOT NULL,
  jumlah_rumah_diperiksa integer,
  ditemukan_jentik boolean,
  warga_terjangkit_dbd boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE kunjungan_balita (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id uuid NOT NULL,
  tanggal_kunjungan date NOT NULL,
  imunisasi text
);

CREATE TABLE kunjungan_lansia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id uuid NOT NULL,
  tanggal_kunjungan date NOT NULL
);

CREATE TABLE galeri_kegiatan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id uuid NOT NULL,
  judul text NOT NULL,
  deskripsi text,
  url_foto text NOT NULL,
  kategori text,
  tanggal_kegiatan date,
  dipublikasikan boolean NOT NULL DEFAULT false,
  urutan integer NOT NULL DEFAULT 0
);

CREATE TABLE dokumen_publik_rt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id uuid NOT NULL,
  judul text NOT NULL,
  deskripsi text,
  kategori text,
  url_berkas text NOT NULL,
  ukuran_berkas text,
  tanggal_terbit date,
  dipublikasikan boolean NOT NULL DEFAULT false,
  urutan integer NOT NULL DEFAULT 0
);

CREATE TABLE kontak_darurat_rt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id uuid NOT NULL,
  nama_layanan text NOT NULL,
  nomor text NOT NULL,
  keterangan text,
  ikon text,
  urutan integer NOT NULL DEFAULT 0,
  aktif boolean NOT NULL DEFAULT true
);

CREATE TABLE pengumuman_rt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id uuid NOT NULL,
  judul text NOT NULL,
  deskripsi text,
  link_dokumen text,
  tanggal_publikasi date
);

CREATE TABLE voting_rt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id uuid NOT NULL,
  judul text NOT NULL,
  deskripsi text,
  opsi_1 text NOT NULL,
  opsi_2 text NOT NULL,
  status text NOT NULL DEFAULT 'Aktif',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE suara_voting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rt_id uuid NOT NULL,
  voting_id uuid NOT NULL REFERENCES voting_rt(id) ON DELETE CASCADE,
  pilihan text NOT NULL
);

-- ------------------------------------------------------------------
-- Data contoh untuk tenant RT 07
-- ------------------------------------------------------------------
INSERT INTO master_rt (id, nama_rt, nama_rw, kelurahan)
VALUES (:'tenant', 'RT 07', 'RW 09', 'Tengah');

-- Kepala keluarga (warga sah). Sisipkan dengan id tetap agar anggota bisa direferensi.
INSERT INTO warga (id, rt_id, nama_lengkap, tanggal_lahir, jenis_kelamin, agama, pekerjaan, status_verifikasi, status_aktif) VALUES
  ('11111111-0000-4000-8000-000000000001', :'tenant', 'Budi Santoso',    '1980-04-12', 'Laki-laki', 'Islam',    'Wiraswasta',      'Disetujui', true),
  ('11111111-0000-4000-8000-000000000002', :'tenant', 'Siti Rahayu',     '1985-09-03', 'Perempuan', 'Islam',    'Guru',            'Disetujui', true),
  ('11111111-0000-4000-8000-000000000003', :'tenant', 'Agus Wijaya',     '1975-01-22', 'Laki-laki', 'Kristen',  'Karyawan Swasta', 'Disetujui', true),
  ('11111111-0000-4000-8000-000000000004', :'tenant', 'Dewi Lestari',    '1990-12-30', 'Perempuan', 'Islam',    'Ibu Rumah Tangga','Disetujui', true),
  ('11111111-0000-4000-8000-000000000005', :'tenant', 'Rudi Hartono',    '1968-07-17', 'Laki-laki', 'Katolik',  'Pensiunan',       'Disetujui', true),
  ('11111111-0000-4000-8000-000000000006', :'tenant', 'Maria Ulfa',      '1993-03-08', 'Perempuan', 'Islam',    'Perawat',         'Disetujui', true),
  -- Pendaftar menunggu: sengaja TIDAK Disetujui, harus terkecuali dari demografi sah.
  ('11111111-0000-4000-8000-000000000099', :'tenant', 'Pendaftar Baru',  '2000-01-01', 'Laki-laki', 'Islam',    'Mahasiswa',       'Menunggu',  true);

INSERT INTO anggota_keluarga (rt_id, warga_id, nama_lengkap, tanggal_lahir, jenis_kelamin, agama, pekerjaan) VALUES
  (:'tenant', '11111111-0000-4000-8000-000000000001', 'Ani Santoso',    '1983-06-01', 'Perempuan', 'Islam',   'Ibu Rumah Tangga'),
  (:'tenant', '11111111-0000-4000-8000-000000000001', 'Rina Santoso',   '2010-02-14', 'Perempuan', 'Islam',   'Pelajar'),
  (:'tenant', '11111111-0000-4000-8000-000000000001', 'Rio Santoso',    '2013-08-20', 'Laki-laki', 'Islam',   'Pelajar'),
  (:'tenant', '11111111-0000-4000-8000-000000000002', 'Andi Pratama',   '1982-11-11', 'Laki-laki', 'Islam',   'PNS'),
  (:'tenant', '11111111-0000-4000-8000-000000000002', 'Nadia Pratama',  '2012-05-05', 'Perempuan', 'Islam',   'Pelajar'),
  (:'tenant', '11111111-0000-4000-8000-000000000003', 'Yohana Wijaya',  '1978-04-19', 'Perempuan', 'Kristen', 'Wiraswasta'),
  (:'tenant', '11111111-0000-4000-8000-000000000003', 'Kevin Wijaya',   '2008-09-09', 'Laki-laki', 'Kristen', 'Pelajar'),
  (:'tenant', '11111111-0000-4000-8000-000000000005', 'Endang Hartono', '1970-10-02', 'Perempuan', 'Katolik', 'Ibu Rumah Tangga'),
  (:'tenant', '11111111-0000-4000-8000-000000000006', 'Fajar Nugroho',  '1991-01-25', 'Laki-laki', 'Islam',   'Dokter');

INSERT INTO kas_rt (rt_id, tipe_transaksi, nominal, kategori, keterangan, tanggal_transaksi) VALUES
  (:'tenant', 'Pemasukan',   3500000, 'Iuran Warga',   'Iuran bulanan Januari',           now()::date - 40),
  (:'tenant', 'Pemasukan',   3600000, 'Iuran Warga',   'Iuran bulanan Februari',          now()::date - 10),
  (:'tenant', 'Pengeluaran',  750000, 'Kebersihan',    'Honor petugas sampah',            now()::date - 8),
  (:'tenant', 'Pengeluaran',  420000, 'Keamanan',      'Perlengkapan ronda',              now()::date - 6),
  (:'tenant', 'Pengeluaran',  180000, 'Administrasi',  'ATK & fotokopi',                  now()::date - 3),
  (:'tenant', 'Pengeluaran', 1200000, 'Sosial',        'Santunan warga sakit',            now()::date - 2);

INSERT INTO transaksi_kurban (rt_id, jenis_transaksi, nominal, warga_id) VALUES
  (:'tenant', 'Setoran', 500000, '11111111-0000-4000-8000-000000000001'),
  (:'tenant', 'Setoran', 500000, '11111111-0000-4000-8000-000000000002'),
  (:'tenant', 'Setoran', 250000, '11111111-0000-4000-8000-000000000003'),
  (:'tenant', 'Penarikan', 100000, NULL);

INSERT INTO transaksi_sampah (rt_id, jenis_transaksi, berat_kg, nominal_warga, nominal_kas_rt, tanggal_transaksi) VALUES
  (:'tenant', 'Setor Bank Sampah', 42.5, 85000, 21000, now()::date - 20),
  (:'tenant', 'Setor Bank Sampah', 37.0, 74000, 18500, now()::date - 12),
  (:'tenant', 'Setor Bank Sampah', 55.3, 110600, 27000, now()::date - 4),
  (:'tenant', 'Tarik Saldo',       0,    30000,  0,     now()::date - 1);

INSERT INTO laporan_jumantik (rt_id, jumlah_rumah_diperiksa, ditemukan_jentik, warga_terjangkit_dbd, created_at) VALUES
  (:'tenant', 148, false, false, now() - interval '2 days');

INSERT INTO kunjungan_balita (rt_id, tanggal_kunjungan, imunisasi) VALUES
  (:'tenant', now()::date - 5,  'Campak'),
  (:'tenant', now()::date - 5,  'Polio'),
  (:'tenant', now()::date - 5,  NULL),
  (:'tenant', now()::date - 35, 'DPT'),
  (:'tenant', now()::date - 65, 'BCG');

INSERT INTO kunjungan_lansia (rt_id, tanggal_kunjungan) VALUES
  (:'tenant', now()::date - 6),
  (:'tenant', now()::date - 6),
  (:'tenant', now()::date - 40);

INSERT INTO galeri_kegiatan (rt_id, judul, deskripsi, url_foto, kategori, tanggal_kegiatan, dipublikasikan, urutan) VALUES
  (:'tenant', 'Kerja Bakti Bulanan', 'Warga bergotong royong membersihkan selokan.', '/og-image.jpeg', 'Lingkungan', now()::date - 14, true, 1),
  (:'tenant', 'Posyandu Balita',     'Penimbangan dan imunisasi rutin.',            '/og-image.jpeg', 'Kesehatan',  now()::date - 5,  true, 2),
  (:'tenant', 'Rapat Pengurus (draf)','Belum dipublikasikan.',                      '/og-image.jpeg', 'Organisasi', now()::date - 1,  false, 3);

INSERT INTO dokumen_publik_rt (rt_id, judul, deskripsi, kategori, url_berkas, ukuran_berkas, tanggal_terbit, dipublikasikan, urutan) VALUES
  (:'tenant', 'Peraturan RT 07',       'Tata tertib warga.',        'Peraturan', '/file.svg', '120 KB', now()::date - 30, true, 1),
  (:'tenant', 'Blanko Surat Pengantar','Formulir pengajuan surat.', 'Formulir',  '/file.svg', '48 KB',  now()::date - 20, true, 2);

INSERT INTO kontak_darurat_rt (rt_id, nama_layanan, nomor, keterangan, ikon, urutan, aktif) VALUES
  (:'tenant', 'Ketua RT',       '0812-1111-2222', 'Aktif 24 jam',        '📞', 1, true),
  (:'tenant', 'Satpam / Ronda', '0813-3333-4444', 'Pos ronda RT 07',     '🛡️', 2, true),
  (:'tenant', 'Ambulans Desa',  '119',            'Layanan gawat darurat','🚑', 3, true);

INSERT INTO pengumuman_rt (rt_id, judul, deskripsi, link_dokumen, tanggal_publikasi) VALUES
  (:'tenant', 'Kerja Bakti Minggu Ini', 'Mohon partisipasi seluruh warga pukul 07.00.', NULL, now()::date - 2),
  (:'tenant', 'Iuran Bulan Ini',        'Iuran dapat disetor ke bendahara.',            NULL, now()::date - 9);

-- Voting aktif + suara agar rekap muncul di landing.
INSERT INTO voting_rt (id, rt_id, judul, deskripsi, opsi_1, opsi_2, status, created_at) VALUES
  ('22222222-0000-4000-8000-000000000001', :'tenant', 'Jadwal Ronda Baru',
   'Pilih pola jadwal ronda malam.', 'Per RT', 'Per Blok', 'Aktif', now() - interval '1 day');

INSERT INTO suara_voting (rt_id, voting_id, pilihan) VALUES
  (:'tenant', '22222222-0000-4000-8000-000000000001', 'Per RT'),
  (:'tenant', '22222222-0000-4000-8000-000000000001', 'Per RT'),
  (:'tenant', '22222222-0000-4000-8000-000000000001', 'Per RT'),
  (:'tenant', '22222222-0000-4000-8000-000000000001', 'Per Blok'),
  (:'tenant', '22222222-0000-4000-8000-000000000001', 'Per Blok');

-- ------------------------------------------------------------------
-- Role & hak akses kompatibel PostgREST / supabase-js
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

COMMIT;
