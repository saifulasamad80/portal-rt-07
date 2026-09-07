-- DITARIK. Jangan jalankan skrip ini.
-- Backfill LIMIT 1 FROM master_rt menstempel tenant acak jika ada >1 wilayah.
-- Kontrak tenant yang sah: tenant-rt-id-kontrak-wajib.sql
-- (backfill dari induk warga, stempel unik hanya jika tepat 1 master_rt
-- DAN seluruh warga.rt_id sama).

DO $$
BEGIN
  RAISE EXCEPTION
    'warga-orphan-rt-id-backfill.sql sudah ditarik. Jalankan tenant-rt-id-kontrak-wajib.sql.';
END;
$$;
