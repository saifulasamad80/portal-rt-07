import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { petaStatusTinggalImpor } from "../lib/peta-status-tinggal.ts";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("impor memetakan status warisan ke nilai yang Carik terima", () => {
  assert.equal(petaStatusTinggalImpor(""), "Penduduk Tetap");
  assert.equal(petaStatusTinggalImpor("Warga Tetap"), "Penduduk Tetap");
  assert.equal(petaStatusTinggalImpor("1. Penduduk Tetap"), "Penduduk Tetap");
  assert.equal(petaStatusTinggalImpor("2. Penduduk Tdk Tetap"), "Penduduk Tidak Tetap");
  assert.equal(petaStatusTinggalImpor("Pendatang"), "Penduduk Tidak Tetap");
  assert.equal(petaStatusTinggalImpor("Kos"), "Penyewa Kos");
  assert.equal(petaStatusTinggalImpor("Warga Kontrak"), "Penyewa Kontrakan");
  assert.equal(petaStatusTinggalImpor("Penyewa Kontrakan"), "Penyewa Kontrakan");
});

test("impor buku induk memakai peta Carik dan batas panjang yang sama", async () => {
  const halaman = await baca("app/admin/warga/page.tsx");
  const klien = await baca("app/admin/warga/WargaAdminClient.tsx");
  assert.match(halaman, /petaStatusTinggalImpor/);
  assert.match(halaman, /validasiNik/);
  assert.match(halaman, /namaLengkap\.slice\(0, 100\)/);
  assert.match(halaman, /slice\(0, 255\)/);
  assert.match(halaman, /noKkDigit\.length === 16/);
  assert.doesNotMatch(halaman, /noKkDigit && noKkDigit\.length !== 16/);
  assert.doesNotMatch(halaman, /: "Warga Tetap"/);
  assert.match(klien, /Penduduk Tetap/);
  assert.doesNotMatch(klien, /Warga Tetap/);
});

test("simpan pengurus longgar; verifikasi carik tetap ketat", async () => {
  const domain = await baca("lib/verifikasi-carik.ts");
  const server = await baca("lib/verifikasi-carik-server.ts");
  assert.match(domain, /opsi\?\.ketat !== false/);
  assert.match(domain, /kePayloadUpdateBiodata/);
  assert.match(server, /const ketat = opsi\.capCarik/);
  assert.match(server, /sanitasiBiodata\(biodataMentah, \{ ketat \}\)/);
});
