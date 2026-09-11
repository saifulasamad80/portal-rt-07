import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PESAN_IMPOR_CSV_DITOLAK,
  PESAN_PERSETUJUAN_CARIK,
  tanggalTenggatDataSpesifik,
  tenggatPdpSudahLewat,
  normalisasiPersetujuanLaporDiri,
  VERSI_KEBIJAKAN_PRIVASI,
} from "../lib/kebijakan-privasi.ts";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Tenggat data spesifik 60 hari setelah pemberitahuan 11 September 2026", () => {
  assert.equal(tanggalTenggatDataSpesifik(), "2026-11-10");
  assert.equal(tenggatPdpSudahLewat(new Date("2026-11-09T00:00:00.000Z")), false);
  assert.equal(tenggatPdpSudahLewat(new Date("2026-11-10T00:00:00.000Z")), true);
});

test("Keuangan wajib hanya jika isian diisi", () => {
  const dasar = {
    versi_naskah: VERSI_KEBIJAKAN_PRIVASI,
    baca_kebijakan: true,
    data_pribadi: true,
    data_anggota: false,
    data_anak: false,
    data_keuangan: false,
    data_kesehatan: false,
  };
  const carik = normalisasiPersetujuanLaporDiri(dasar, 0, 0, {
    wajibKeuangan: false,
    pesanWajib: PESAN_PERSETUJUAN_CARIK,
  });
  assert.equal(carik.ok, true);
  const daftarKosong = normalisasiPersetujuanLaporDiri(dasar, 0, 0, { wajibKeuangan: false });
  assert.equal(daftarKosong.ok, true);
  const daftarWajib = normalisasiPersetujuanLaporDiri(dasar, 0, 0, { wajibKeuangan: true });
  assert.equal(daftarWajib.ok, false);
});

test("Carik, CSV, surat kertas, dan tenggat menempel di naskah yang sama", async () => {
  const carikUi = await baca("app/portal/sensus/SensusClient.tsx");
  const carikAksi = await baca("app/portal/sensus/actions.ts");
  const carikServer = await baca("lib/verifikasi-carik-server.ts");
  const domain = await baca("lib/verifikasi-carik.ts");
  const adminWarga = await baca("app/admin/warga/page.tsx");
  const adminUi = await baca("app/admin/warga/WargaAdminClient.tsx");
  const surat = await baca("app/kebijakan-privasi/surat/page.tsx");
  const sql = await baca("pdp-persetujuan-warga.sql");
  const portal = await baca("app/portal/page.tsx");
  const jejak = await baca("lib/persetujuan-data.ts");

  assert.match(carikUi, /Persetujuan pemrosesan data/);
  assert.match(carikUi, /bukan di draf peramban/);
  const draftStorage = carikUi.slice(carikUi.indexOf("const draft: DraftSensus"));
  assert.doesNotMatch(draftStorage.slice(0, draftStorage.indexOf("window.localStorage.setItem")), /bacaKebijakan|setujuPribadi|setujuKeuangan|setujuAnggota|setujuAnak/);
  assert.match(carikUi, /desil bansos|Profil rumah tangga/);
  assert.match(carikUi, /aksiSimpanCarik\(biodata, anggota, catatan, \{/);
  assert.match(carikAksi, /persetujuan/);
  assert.match(carikServer, /catatPersetujuanData/);
  assert.match(carikServer, /wajibKeuangan: persetujuan\.data\.data_keuangan/);
  assert.match(domain, /wajibKeuangan/);
  assert.doesNotMatch(domain, /pendapatan_bulanan\",\n  \"daya_listrik/);

  assert.match(adminWarga, /PESAN_IMPOR_CSV_DITOLAK/);
  assert.doesNotMatch(adminWarga, /Import Bulk CSV Warga/);
  assert.doesNotMatch(adminUi, /Upload CSV/);
  assert.match(adminUi, /Impor CSV NIK dimatikan/);
  assert.equal(PESAN_IMPOR_CSV_DITOLAK.includes("NIK"), true);

  assert.match(surat, /BAGIAN_KEBIJAKAN_PRIVASI/);
  assert.match(surat, /VERSI_KEBIJAKAN_PRIVASI/);
  assert.match(surat, /Jangan ganti versi/);

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.persetujuan_data_warga/);
  assert.match(sql, /nullif\(btrim\(coalesce\(p_biodata->>'pendapatan_bulanan'/);
  assert.match(sql, /warga_id=' \|\| p_warga_id::text/);
  assert.doesNotMatch(sql, /left\('NIK ' \|\| p_nik/);

  assert.match(portal, /PemberitahuanPdpPortal/);
  assert.doesNotMatch(portal, /redirect\(\"\/login\"\).*persetujuan/);
  assert.match(jejak, /Tenggat PDP data spesifik/);
  assert.doesNotMatch(jejak, /NIK/);
});
