import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { SignJWT, jwtVerify } from "jose";
import {
  PESAN_TINJAUAN_PENGURUS,
  periksaKepemilikanAnggota,
} from "../lib/kebijakan-sensus.ts";

const ID_PEMILIK = "11111111-1111-4111-8111-111111111111";
const ID_ASING = "22222222-2222-4222-8222-222222222222";
const NIK_PEMILIK = "3275010101010001";
const NIK_KORBAN = "3275010202020002";

test("ID anggota asing ditolak dan tidak diturunkan menjadi insert", () => {
  const hasil = periksaKepemilikanAnggota(
    [{ id: ID_PEMILIK, nik: NIK_PEMILIK }],
    [{ id: ID_ASING, nik: NIK_KORBAN }]
  );

  assert.deepEqual(hasil, { ok: false });
});

test("NIK request anggota lama wajib sama dengan NIK tersimpan", () => {
  const hasil = periksaKepemilikanAnggota(
    [{ id: ID_PEMILIK, nik: NIK_PEMILIK }],
    [{ id: ID_PEMILIK, nik: NIK_KORBAN }]
  );

  assert.deepEqual(hasil, { ok: false });
});

test("anggota baru hanya diteruskan sebagai NIK untuk pemeriksaan konflik", () => {
  const hasil = periksaKepemilikanAnggota(
    [{ id: ID_PEMILIK, nik: NIK_PEMILIK }],
    [
      { id: ID_PEMILIK, nik: NIK_PEMILIK },
      { nik: NIK_KORBAN },
    ]
  );

  assert.deepEqual(hasil, { ok: true, nikBaru: [NIK_KORBAN] });
});

test("ID anggota yang dikirim dua kali ditolak", () => {
  const hasil = periksaKepemilikanAnggota(
    [{ id: ID_PEMILIK, nik: NIK_PEMILIK }],
    [
      { id: ID_PEMILIK, nik: NIK_PEMILIK },
      { id: ID_PEMILIK, nik: NIK_PEMILIK },
    ]
  );

  assert.deepEqual(hasil, { ok: false });
});

test("pesan konflik tidak menjadi oracle identitas korban", () => {
  assert.equal(PESAN_TINJAUAN_PENGURUS.includes(NIK_KORBAN), false);
  assert.equal(PESAN_TINJAUAN_PENGURUS.includes(ID_ASING), false);
  assert.match(PESAN_TINJAUAN_PENGURUS, /diperiksa pengurus RT/);
});

test("modul sensus mandiri tidak memiliki kapabilitas penghapus warga", async () => {
  const domain = await readFile(new URL("../lib/verifikasi-carik.ts", import.meta.url), "utf8");
  const portal = await readFile(new URL("../app/portal/sensus/page.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../sensus-mandiri-atomic-migration.sql", import.meta.url), "utf8");

  assert.doesNotMatch(domain, /prosesHapusAtauArsipWarga|hapusDuplikatTerdeteksi|gabungkanKkDobelKeAnggota/);
  assert.doesNotMatch(portal, /cariDuplikatWarga|hapusDuplikatPilihan|hapusKarenaNikTidakSesuai/);
  assert.match(portal, /simpanVerifikasiCarikMandiri/);
  assert.match(portal, /laporkanNikTidakSesuaiMandiri/);
  assert.match(domain, /rpc\("simpan_sensus_mandiri"/);
  assert.match(domain, /rpc\("laporkan_nik_tidak_sesuai_mandiri"/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /REVOKE ALL ON FUNCTION/);
  assert.match(migration, /Prasyarat wajib/i);
  assert.match(migration, /status_aktif/);
  assert.doesNotMatch(migration, /ADD COLUMN IF NOT EXISTS public\.warga[\s\S]*status_aktif/);
  assert.doesNotMatch(migration, /prosesHapusAtauArsipWarga/);

  const posisiPreflight = domain.search(/siapkanSinkronAnggota\(supabase, wargaId,[^)]*anggota\.data\)/);
  const posisiUpdateKepala = domain.indexOf('.from("warga")\n    .update(biodata.data)');
  assert.ok(posisiPreflight >= 0 && posisiPreflight < posisiUpdateKepala);
  assert.match(domain, /\.from\("warga"\)\.select\("id"\)\.in\("nik", kebijakan\.nikBaru\)/);
  assert.match(domain, /\.from\("anggota_keluarga"\)\.select\("id"\)\.in\("nik", kebijakan\.nikBaru\)/);
});

test("token warga tidak dapat dipakai sebagai token admin (confusion boundary)", async () => {
  const source = await readFile(new URL("../lib/session-security.ts", import.meta.url), "utf8");
  const secret = new TextEncoder().encode("S".repeat(32));
  const kunciWarga = secret;
  const kunciAdmin = new Uint8Array(
    createHmac("sha256", secret).update("aplikasi-rt:admin-session:v1").digest()
  );
  const id = ID_PEMILIK;

  const tokenWarga = await new SignJWT({ token_use: "warga" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuer("aplikasi-rt")
    .setAudience("portal-warga")
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(kunciWarga);

  // Simulasikan opsi yang dipakai verifier admin: kunci terpisah + audience
  // terpisah. Keduanya wajib gagal, sehingga pemindahan cookie tidak memberi
  // hak lintas boundary.
  await assert.rejects(
    jwtVerify(tokenWarga, kunciAdmin, {
      algorithms: ["HS256"],
      issuer: "aplikasi-rt",
      audience: "portal-admin",
      requiredClaims: ["exp", "iat", "sub", "iss", "aud"],
      maxTokenAge: "2h",
    })
  );
  await assert.rejects(
    jwtVerify(tokenWarga, kunciWarga, {
      algorithms: ["HS256"],
      issuer: "aplikasi-rt",
      audience: "portal-admin",
    })
  );

  assert.match(source, /createHmac\("sha256", kunciUtama\)/);
  assert.match(source, /aplikasi-rt:admin-session:v1/);
  assert.match(source, /SESSION_AUDIENCE_ADMIN/);
});

test("fallback status_aktif hanya aktif untuk error kolom skema yang dikenal", async () => {
  const source = await readFile(new URL("../lib/session-security.ts", import.meta.url), "utf8");
  assert.match(source, /statusAktifTidakTersedia/);
  assert.match(source, /42703/);
  assert.match(source, /PGRST204/);
  assert.match(source, /!teks\.includes\(kolom\)/);
  assert.match(source, /kolomTidakTersedia\(error, "status_aktif"\)/);
  assert.match(source, /statusAktifTersedia = false/);
});
