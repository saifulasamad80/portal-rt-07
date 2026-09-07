-- M7 / PR1: cabut hak tulis/destruktif dari role publik.
-- Role anon hanya boleh memiliki SELECT eksplisit; RLS tetap menjadi pagar baca.
BEGIN;

-- Grant ke PUBLIC diwarisi oleh semua role, termasuk anon. Karena itu DML dan
-- TRUNCATE dicabut dari anon langsung dan dari PUBLIC sebagai defense in depth.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON ALL TABLES IN SCHEMA public
  FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON ALL TABLES IN SCHEMA public
  FROM PUBLIC;

-- Cegah objek public baru yang dibuat oleh role migrasi saat ini memberi ulang
-- hak tulis/destruktif ke anon atau PUBLIC melalui default privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM PUBLIC;

COMMIT;
