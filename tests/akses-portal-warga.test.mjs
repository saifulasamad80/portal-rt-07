import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("jiwa ber-NIK Disetujui tidak ditolak hanya karena status_aktif", async () => {
  const gerbang = await readFile(new URL("../lib/akses-portal-warga.ts", import.meta.url), "utf8");
  assert.match(gerbang, /alasanTolakMasukPortal/);
  assert.match(gerbang, /adalahArsipPemilu/);
  assert.match(gerbang, /verifikasi === "Menunggu"/);
  assert.match(gerbang, /verifikasi === "Ditolak"/);
  assert.match(gerbang, /verifikasi !== "Disetujui"/);
  assert.doesNotMatch(gerbang, /status_aktif !== true/);
  assert.doesNotMatch(gerbang, /status_aktif === false/);
});

test("login, sesi, dan carik mandiri memisahkan akun portal dari kartu KK", async () => {
  const login = await readFile(new URL("../app/api/warga/login/route.ts", import.meta.url), "utf8");
  const sesi = await readFile(new URL("../lib/session-security.ts", import.meta.url), "utf8");
  const mandiri = await readFile(new URL("../lib/verifikasi-carik-server.ts", import.meta.url), "utf8");
  const kunci = await readFile(new URL("../app/portal/(terkunci)/layout.tsx", import.meta.url), "utf8");
  const dasbor = await readFile(new URL("../app/portal/page.tsx", import.meta.url), "utf8");
  const sensus = await readFile(new URL("../app/portal/sensus/page.tsx", import.meta.url), "utf8");
  assert.match(login, /alasanTolakMasukPortal/);
  assert.doesNotMatch(login, /status_aktif !== true/);
  assert.match(sesi, /alasanTolakMasukPortal/);
  assert.doesNotMatch(sesi, /statusAktifTersedia && warga\.status_aktif !== true/);
  assert.match(mandiri, /rumahTangga\.adalahTanggungan/);
  assert.match(kunci, /ambilCapCarikRumahTangga/);
  assert.match(dasbor, /ambilCapCarikRumahTangga/);
  assert.match(sensus, /SensusTanggungan/);
  assert.match(sensus, /capRumahTangga\.rumah\.adalahTanggungan/);
});
