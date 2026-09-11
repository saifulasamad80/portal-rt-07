import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { SignJWT, jwtVerify } from "jose";
import {
  PESAN_TINJAUAN_PENGURUS,
  adalahCapCarikDisetujui,
  adalahCapCarikMenunggu,
  adalahTiketPerubahanKeluarga,
  periksaKepemilikanAnggota,
  samarkanNik,
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

test("NIK anggota disamarkan tanpa mengembalikan 16 digit utuh", () => {
  assert.equal(samarkanNik("3175040305800012"), "317504******0012");
  assert.equal(samarkanNik(NIK_KORBAN), "327501******0002");
  assert.equal(samarkanNik("123"), "Tidak tercatat");
  assert.equal(samarkanNik(null), "Tidak tercatat");
  assert.equal(samarkanNik("3175040305800012").includes("3175040305800012"), false);
});

test("cap Carik Disetujui dan Menunggu tidak tertukar dengan keberadaan baris", () => {
  assert.equal(adalahCapCarikDisetujui("Disetujui"), true);
  assert.equal(adalahCapCarikDisetujui("Menunggu"), false);
  assert.equal(adalahCapCarikDisetujui(null), false);
  assert.equal(adalahCapCarikMenunggu("Menunggu"), true);
  assert.equal(adalahCapCarikMenunggu("Disetujui"), false);
});

test("halaman keluarga terverifikasi hanya baca dan tidak membuka form carik", async () => {
  const halaman = await readFile(
    new URL("../app/portal/(terkunci)/keluarga/page.tsx", import.meta.url),
    "utf8"
  );
  const permohonan = await readFile(
    new URL("../app/portal/(terkunci)/keluarga/PermohonanKeluargaClient.tsx", import.meta.url),
    "utf8"
  );
  const sensus = await readFile(new URL("../app/portal/sensus/page.tsx", import.meta.url), "utf8");

  assert.match(halaman, /samarkanNik/);
  assert.match(halaman, /JUDUL_PERMOHONAN_PERUBAHAN_KELUARGA/);
  assert.match(halaman, /ambilCapCarikRumahTangga/);
  assert.match(halaman, /ambilProfilKartuKkRumahTangga/);
  assert.match(halaman, /adalahTanggungan/);
  assert.match(halaman, /redirect\("\/portal\/sensus"\)/);
  assert.doesNotMatch(halaman, /simpanVerifikasiCarikMandiri|sanitasiBiodata|\.update\(/);
  assert.doesNotMatch(permohonan, /simpanVerifikasiCarikMandiri|type="text"|input /);
  assert.match(sensus, /redirect\("\/portal\/keluarga"\)/);
});

test("tata kelola tiket tertutup membuka cap Carik bukan status akun", async () => {
  const adminLapor = await readFile(new URL("../app/admin/lapor/page.tsx", import.meta.url), "utf8");
  const adminUi = await readFile(new URL("../app/admin/lapor/LaporAdminClient.tsx", import.meta.url), "utf8");
  const dasbor = await readFile(new URL("../app/admin/AdminDashboardClient.tsx", import.meta.url), "utf8");
  const portalLapor = await readFile(new URL("../app/portal/(terkunci)/lapor/page.tsx", import.meta.url), "utf8");
  const portalDasbor = await readFile(new URL("../app/portal/page.tsx", import.meta.url), "utf8");
  const rumahTangga = await readFile(new URL("../lib/rumah-tangga-warga.ts", import.meta.url), "utf8");
  const sensusClient = await readFile(new URL("../app/portal/sensus/SensusClient.tsx", import.meta.url), "utf8");
  const sensusPage = await readFile(new URL("../app/portal/sensus/page.tsx", import.meta.url), "utf8");
  const rpc = await readFile(new URL("../sensus-mandiri-atomic-migration.sql", import.meta.url), "utf8");

  assert.equal(adalahTiketPerubahanKeluarga("Permohonan perubahan data keluarga"), true);
  assert.equal(adalahTiketPerubahanKeluarga("Lampu mati"), false);

  assert.match(adminLapor, /aksiIzinkanRevisi/);
  assert.match(adminLapor, /rpc\("aksi_izinkan_revisi"/);
  assert.match(adminLapor, /hanya ditutup lewat Izinkan Revisi/);
  assert.doesNotMatch(adminLapor, /status_verifikasi/);

  const mulaiRevisi = adminLapor.indexOf("async function aksiIzinkanRevisi");
  const selesaiRevisi = adminLapor.indexOf("async function aksiTolakRevisi");
  assert.ok(mulaiRevisi >= 0 && selesaiRevisi > mulaiRevisi);
  const aksiRevisi = adminLapor.slice(mulaiRevisi, selesaiRevisi);
  assert.match(aksiRevisi, /adminBolehMengaksesRt/);
  assert.match(aksiRevisi, /\.from\("warga"\)/);
  assert.match(aksiRevisi, /\.eq\("id", wargaId\)/);
  assert.match(aksiRevisi, /\.eq\("rt_id", rtIdTujuan\)/);
  assert.match(aksiRevisi, /p_laporan_id: idBersih/);
  assert.doesNotMatch(aksiRevisi, /role !== "webmaster"/);

  const p3 = await readFile(new URL("../p3-sweep-execution.sql", import.meta.url), "utf8");
  assert.match(p3, /CREATE OR REPLACE FUNCTION public\.aksi_izinkan_revisi/);
  assert.match(p3, /status_validasi = 'Menunggu'/);
  assert.match(p3, /status_validasi = 'Disetujui'/);
  assert.match(p3, /Izinkan Revisi Data Keluarga/);
  assert.match(adminUi, /Izinkan Revisi/);
  assert.match(dasbor, /href="\/admin\/lapor"/);
  assert.doesNotMatch(dasbor, /Digembok/);
  assert.match(portalLapor, /redirect\("\/portal"\)/);
  assert.doesNotMatch(portalLapor, /kirimLaporan/);
  assert.match(portalDasbor, /FITUR_LAPOR_AKTIF = false/);
  assert.match(portalDasbor, /ambilCapCarikRumahTangga/);
  assert.match(portalDasbor, /capRumahTangga\.capDisetujui/);
  assert.match(portalDasbor, /capRumahTangga\.capMenunggu/);
  assert.match(rumahTangga, /adalahCapCarikDisetujui/);
  assert.match(rumahTangga, /adalahCapCarikMenunggu/);
  assert.match(portalDasbor, /Lanjutkan revisi/);
  assert.match(portalDasbor, /href="\/portal\/sensus"/);
  assert.doesNotMatch(portalDasbor, /isDataTervalidasiWarga = !!statusCarik/);
  assert.match(sensusClient, /modeRevisi/);
  assert.match(sensusPage, /modeRevisi=\{statusCarik\.data\?\.status_validasi === "Menunggu"\}/);
  assert.match(rpc, /status_validasi = 'Disetujui'/);
  assert.match(rpc, /Verifikasi sensus sudah diselesaikan/);
});

test("kartu layanan portal tergembok tanpa tautan saat cap belum Disetujui", async () => {
  const kartu = await readFile(new URL("../components/portal/KartuLayanan.tsx", import.meta.url), "utf8");
  const dasbor = await readFile(new URL("../app/portal/page.tsx", import.meta.url), "utf8");
  assert.match(kartu, /terkunci \?/);
  assert.match(kartu, /cursor-not-allowed/);
  assert.match(kartu, /aria-disabled/);
  assert.match(dasbor, /terkunci=\{layananTerkunci\}/);
});

test("modul sensus mandiri tidak memiliki kapabilitas penghapus warga", async () => {
  const domainMurni = await readFile(new URL("../lib/verifikasi-carik.ts", import.meta.url), "utf8");
  const domain = await readFile(new URL("../lib/verifikasi-carik-server.ts", import.meta.url), "utf8");
  const portal = await readFile(new URL("../app/portal/sensus/page.tsx", import.meta.url), "utf8");
  const aksi = await readFile(new URL("../app/portal/sensus/actions.ts", import.meta.url), "utf8");
  const client = await readFile(new URL("../app/portal/sensus/SensusClient.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../sensus-mandiri-atomic-migration.sql", import.meta.url), "utf8");

  assert.doesNotMatch(domainMurni, /prosesHapusAtauArsipWarga|hapusDuplikatTerdeteksi|gabungkanKkDobelKeAnggota/);
  assert.doesNotMatch(domain, /prosesHapusAtauArsipWarga|hapusDuplikatTerdeteksi|gabungkanKkDobelKeAnggota/);
  assert.doesNotMatch(domainMurni, /supabase-server|server-only|getSupabaseAdminClient/);
  assert.doesNotMatch(client, /verifikasi-carik-server|supabase-server|server-only/);
  assert.doesNotMatch(portal, /cariDuplikatWarga|hapusDuplikatPilihan|hapusKarenaNikTidakSesuai/);
  assert.match(aksi, /simpanVerifikasiCarikMandiri/);
  assert.match(aksi, /laporkanNikTidakSesuaiMandiri/);
  assert.match(domain, /rpc\("simpan_sensus_mandiri"/);
  assert.match(domain, /rpc\("laporkan_nik_tidak_sesuai_mandiri"/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /REVOKE ALL ON FUNCTION/);
  assert.match(migration, /Prasyarat wajib/i);
  assert.match(migration, /status_aktif/);
  assert.doesNotMatch(migration, /ADD COLUMN IF NOT EXISTS public\.warga[\s\S]*status_aktif/);
  assert.doesNotMatch(migration, /prosesHapusAtauArsipWarga/);

  const posisiPreflight = domain.search(/siapkanSinkronAnggota\(supabasePrivileged, wargaId,/);
  const posisiUpdateKepala = domain.search(/\.from\("warga"\)\s*\n\s*\.update\(/);
  assert.ok(posisiPreflight >= 0 && posisiUpdateKepala >= 0 && posisiPreflight < posisiUpdateKepala);
  assert.match(domain, /kePayloadUpdateBiodata\(biodata\.data, ketat\)/);
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
