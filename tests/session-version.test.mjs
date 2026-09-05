import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { angkaVersiSesi, sesiVersiMasihHidup, VERSI_SESI_AWAL } from "../lib/versi-sesi.ts";

test("klaim JWT lama tanpa session_version dianggap versi awal", () => {
  assert.equal(angkaVersiSesi(undefined), VERSI_SESI_AWAL);
  assert.equal(angkaVersiSesi(null), VERSI_SESI_AWAL);
  assert.equal(sesiVersiMasihHidup(undefined, 1), true);
});

test("reset PIN/sandi mematikan JWT lama", () => {
  assert.equal(sesiVersiMasihHidup(1, 2), false);
  assert.equal(sesiVersiMasihHidup(2, 2), true);
});

test("klaim versi cacat ditolak, bukan dinormalisasi", () => {
  assert.equal(angkaVersiSesi(0), null);
  assert.equal(angkaVersiSesi(1.5), null);
  assert.equal(angkaVersiSesi("1.0"), null);
  assert.equal(sesiVersiMasihHidup("abc", 1), false);
});

test("migrasi menutup tiga celah audit pilar 1 dan 3", async () => {
  const sql = await readFile(
    new URL("../session-zombie-pengurus-voting-migration.sql", import.meta.url),
    "utf8"
  );

  assert.match(sql, /ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1/);
  assert.match(sql, /tr_naikkan_session_version_warga/);
  assert.match(sql, /tr_naikkan_session_version_pengurus/);
  assert.match(sql, /NEW\.session_version := COALESCE\(OLD\.session_version, 1\) \+ 1/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.simpan_pengurus_rt/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.simpan_pengurus_rt/);
  assert.match(sql, /UNIQUE \(voting_id, warga_id\)/);
  assert.doesNotMatch(sql, /COMMIT;\s+INSERT INTO public\.pengurus_rt/i);
});
