import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Draf register tidak menyimpan PIN dan wajib mengirim persetujuan berversi", async () => {
  const klien = await baca("app/register/RegisterClient.tsx");
  const aksi = await baca("app/register/actions.ts");
  const naskah = await baca("lib/kebijakan-privasi.ts");
  const halaman = await baca("app/kebijakan-privasi/page.tsx");

  assert.match(klien, /type DraftRegister = \{[\s\S]*nik: string;[\s\S]*wa: string;[\s\S]*statusTinggal:/);
  assert.doesNotMatch(klien, /type DraftRegister = \{[\s\S]*pin: string;[\s\S]*statusTinggal:/);
  assert.doesNotMatch(klien, /setPin\(String\(parsed\.pin/);
  assert.match(klien, /versi_naskah: VERSI_KEBIJAKAN_PRIVASI/);
  assert.match(klien, /data_anak: adaAnak && setujuAnak/);
  assert.match(klien, /PIN tidak disimpan di draf peramban/);

  assert.match(aksi, /normalisasiPersetujuanLaporDiri/);
  assert.match(aksi, /catatPersetujuanData/);
  assert.match(aksi, /sumber: "lapor_diri"/);
  assert.match(aksi, /umurKepala < USIA_ANAK_PDP/);
  assert.doesNotMatch(aksi, /detail: `NIK /);

  assert.match(naskah, /export const VERSI_KEBIJAKAN_PRIVASI = "2026-09-11"/);
  assert.match(naskah, /export const USIA_ANAK_PDP = 18/);
  assert.match(naskah, /warga_id=\$\{meta\.wargaId\}/);
  const fungsiAudit = naskah.slice(naskah.indexOf("export function ringkasanAuditPersetujuan"));
  assert.doesNotMatch(fungsiAudit, /NIK/);

  assert.match(halaman, /BAGIAN_KEBIJAKAN_PRIVASI/);
});
