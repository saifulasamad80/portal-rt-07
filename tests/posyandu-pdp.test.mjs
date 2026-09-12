import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  USIA_MAKS_POSYANDU_BALITA,
  USIA_MIN_POSYANDU_LANSIA,
  umurDariTanggalIso,
} from "../lib/kebijakan-privasi.ts";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Posyandu PDP: usia sasaran 0–5 dan 45+", () => {
  assert.equal(USIA_MAKS_POSYANDU_BALITA, 5);
  assert.equal(USIA_MIN_POSYANDU_LANSIA, 45);
  const acuan = new Date("2026-09-12T00:00:00.000Z");
  assert.equal(umurDariTanggalIso("2024-01-01", acuan), 2);
  assert.equal(umurDariTanggalIso("2018-01-01", acuan) > USIA_MAKS_POSYANDU_BALITA, true);
  assert.equal(umurDariTanggalIso("1970-01-01", acuan) >= USIA_MIN_POSYANDU_LANSIA, true);
  assert.equal(umurDariTanggalIso("2000-01-01", acuan) >= USIA_MIN_POSYANDU_LANSIA, false);
});

test("Posyandu PDP: tulis tertaut subjek, tarik izin menganonimkan, publik hanya rekap", async () => {
  const aturan = await baca("lib/posyandu-aturan.ts");
  assert.match(aturan, /jiwaLayakPosyanduBalita/);
  assert.match(aturan, /jiwaLayakPosyanduLansia/);
  assert.match(aturan, /KUNCI_JIWA_KEPALA/);

  const dal = await baca("lib/posyandu-kunjungan.ts");
  assert.match(dal, /warga_id: wargaId/);
  assert.match(dal, /anggota_id: anggotaId/);
  assert.match(dal, /jiwaLayakPosyanduBalita/);
  assert.match(dal, /dianonimkan_pada/);
  assert.match(dal, /count: "exact"/);

  const tarik = await baca("lib/persetujuan-data.ts");
  assert.match(tarik, /anonimkanKunjunganRumahTangga/);
  assert.match(tarik, /Catatan posyandu rumah tangga dianonimkan/);

  const hak = await baca("lib/hak-subjek.ts");
  assert.match(hak, /salinanKunjunganRumahTangga/);
  assert.match(hak, /posyandu,/);

  const admin = await baca("app/admin/ibu-ibu/page.tsx");
  assert.doesNotMatch(admin, /LEGACY_POSYANDU_RT_ID/);
  assert.match(admin, /wajibOtentikasiAdmin/);

  const klien = await baca("app/admin/ibu-ibu/IbuIbuAdminClient.tsx");
  assert.doesNotMatch(klien, /placeholder="Nama lengkap anak"/);
  assert.match(klien, /Pilih anak 0–5 tahun/);

  const landing = await baca("lib/landing-publik.ts");
  assert.match(landing, /rekapPosyanduPublik/);
  assert.doesNotMatch(landing, /tanggal_kunjungan, imunisasi/);

  const sql = await baca("posyandu-pdp-subjek.sql");
  assert.match(sql, /kunci_kunjungan_posyandu_pdp/);
  assert.match(sql, /tolak_tulis_posyandu_lama/);
  assert.match(sql, /ON DELETE SET NULL/);
});
