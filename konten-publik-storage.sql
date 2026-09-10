-- Bucket publik untuk galeri kegiatan dan lampiran pengumuman.
-- Unggah hanya lewat service_role di server. Anon/authenticated tidak INSERT.
-- H4 restrictive policy dokumen_warga tidak diubah.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('galeri_kegiatan', 'galeri_kegiatan', true, 204800, ARRAY['image/jpeg']::text[]),
  ('lampiran_pengumuman', 'lampiran_pengumuman', true, 1572864, ARRAY['image/jpeg', 'application/pdf']::text[])
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 204800,
  allowed_mime_types = ARRAY['image/jpeg']::text[]
WHERE id = 'lapak_warga';

DROP POLICY IF EXISTS "Publik baca galeri kegiatan" ON storage.objects;
CREATE POLICY "Publik baca galeri kegiatan"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'galeri_kegiatan');

DROP POLICY IF EXISTS "Publik baca lampiran pengumuman" ON storage.objects;
CREATE POLICY "Publik baca lampiran pengumuman"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'lampiran_pengumuman');

DROP POLICY IF EXISTS "Publik baca foto lapak" ON storage.objects;
CREATE POLICY "Publik baca foto lapak"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'lapak_warga');

COMMIT;
