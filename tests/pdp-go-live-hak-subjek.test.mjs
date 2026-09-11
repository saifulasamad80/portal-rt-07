import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  HARI_TTL_KOTAK_SAMPAH,
  JUDUL_PERMINTAAN_HAPUS_DATA,
  VERSI_KEBIJAKAN_PRIVASI,
} from "../lib/kebijakan-privasi.ts";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Go-live PDP: hak subjek, kesehatan, TTL, minimisasi JWT", async () => {
  assert.equal(VERSI_KEBIJAKAN_PRIVASI, "2026-09-12");
  assert.equal(HARI_TTL_KOTAK_SAMPAH, 30);
  assert.match(JUDUL_PERMINTAAN_HAPUS_DATA, /penghapusan data pribadi/);

  const sql = await baca("pdp-go-live-hak-subjek.sql");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS data_kesehatan/);
  assert.match(sql, /hapus_kotak_sampah_kedaluwarsa/);
  assert.match(sql, /PDP_PIN_DIHAPUS/);

  const jwt = await baca("app/api/warga/login/route.ts");
  const klaim = jwt.slice(jwt.indexOf("new SignJWT"), jwt.indexOf(".setProtectedHeader"));
  assert.doesNotMatch(klaim, /nik:/);
  assert.doesNotMatch(klaim, /nama:/);

  const portal = await baca("app/portal/page.tsx");
  assert.match(portal, /HakSubjekPortal/);

  const posyandu = await baca("app/admin/ibu-ibu/page.tsx");
  assert.match(posyandu, /izinKesehatanRumahTangga/);

  const landing = await baca("app/page.tsx");
  assert.doesNotMatch(landing, /Ada warga terjangkit/);
  const demografi = await baca("app/DemografiClient.tsx");
  assert.doesNotMatch(demografi, /judul="Agama"/);

  const cookie = await baca("app/layout.tsx");
  assert.match(cookie, /PemberitahuanCookie/);

  const judulSensus = await baca("lib/kebijakan-sensus.ts");
  assert.match(judulSensus, new RegExp(`export const JUDUL_PERMINTAAN_HAPUS_DATA = "${JUDUL_PERMINTAAN_HAPUS_DATA}"`));

  const izin = await baca("lib/persetujuan-data.ts");
  const fungsiKesehatan = izin.slice(izin.indexOf("export async function izinKesehatanRumahTangga"));
  assert.match(fungsiKesehatan, /!jejak\.data\.data_kesehatan/);
  assert.doesNotMatch(fungsiKesehatan.slice(0, fungsiKesehatan.indexOf("export async function terapkanPenarikanIzin")), /sumber === "penarikan"/);

  const landingDal = await baca("lib/landing-publik.ts");
  assert.doesNotMatch(landingDal, /agama/);
  assert.doesNotMatch(landingDal, /warga_terjangkit_dbd/);
});
