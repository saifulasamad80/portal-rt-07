import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("arsip pemilu melepas tanggungan tanpa mengisi kotak sampah", async () => {
  const sql = await baca("kotak-sampah-recycle-bin.sql");
  const arsip = await baca("lib/arsip-warga.ts");
  assert.match(sql, /app\.kotak_sampah_lewati/);
  assert.match(sql, /hapus_anggota_tanpa_kotak_sampah/);
  assert.match(arsip, /rpc\("hapus_anggota_tanpa_kotak_sampah"/);
  assert.match(arsip, /lewatiAnggotaKeluarga: true/);
});
