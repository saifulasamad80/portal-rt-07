import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  anggotaSamaWilayah,
  normalisasiAgama,
  normalisasiStatusTinggal,
  siapkanBarisImporWarga,
} from "../lib/normalisasi-warga.ts";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const RT_SAH = "00000000-0000-0000-0000-000000000007";
const RT_ASING = "11111111-1111-4111-8111-111111111111";
const NIK_KEPALA = "3175040305800012";

test("alias status tinggal warisan dipetakan ke kosakata Carik/sensus", () => {
  assert.equal(normalisasiStatusTinggal("Penyewa Kontrakan"), "Penyewa Kontrakan");
  assert.equal(normalisasiStatusTinggal("Warga Kontrak"), "Penyewa Kontrakan");
  assert.equal(normalisasiStatusTinggal("Kontrak"), "Penyewa Kontrakan");
  assert.equal(normalisasiStatusTinggal("Kos"), "Penyewa Kos");
  assert.equal(normalisasiStatusTinggal("Pendatang"), "Penyewa Kontrakan");
  assert.equal(normalisasiStatusTinggal("Warga Tetap"), "Warga Tetap");
  assert.equal(normalisasiStatusTinggal("Rumah Dinas"), "");
});

test("agama bebas dipetakan ke pilihan formulir tanpa mengunci simpan", () => {
  assert.equal(normalisasiAgama("Kristen"), "Kristen/Katolik");
  assert.equal(normalisasiAgama("Katolik"), "Kristen/Katolik");
  assert.equal(normalisasiAgama("Buddha"), "Budha");
  assert.equal(normalisasiAgama("Islam"), "Islam");
});

test("sanitasi biodata dan anggota memakai normalisasi alias sebelum validasi daftar", async () => {
  const sumber = await baca("lib/verifikasi-carik.ts");
  assert.match(sumber, /status_tinggal: normalisasiStatusTinggal\(sisa\.status_tinggal\)/);
  assert.match(sumber, /agama: normalisasiAgama\(sisa\.agama\)/);
  assert.match(sumber, /const agama = normalisasiAgama\(a\.agama\)/);
});

test("impor CSV tidak menstempel Penyewa Kontrakan menjadi Warga Tetap", () => {
  const sah = siapkanBarisImporWarga({
    nik: NIK_KEPALA,
    nama_lengkap: "Saiful Anwar Samad",
    no_whatsapp: "08235468756",
    status_tinggal: "Penyewa Kontrakan",
    detail_alamat: "Griya Alfatihah No. 129",
    tanggal_lahir: "1983-08-11",
    tempat_lahir: "Malang",
    jenis_kelamin: "Laki-laki",
    pekerjaan: "Karyawan Swasta",
  });
  assert.equal(sah.ok, true);
  if (sah.ok) assert.equal(sah.data.status_tinggal, "Penyewa Kontrakan");

  const warisan = siapkanBarisImporWarga({
    nik: NIK_KEPALA,
    nama_lengkap: "Saiful Anwar Samad",
    status_tinggal: "Warga Kontrak",
  });
  assert.equal(warisan.ok, true);
  if (warisan.ok) assert.equal(warisan.data.status_tinggal, "Penyewa Kontrakan");

  const sampah = siapkanBarisImporWarga({
    nik: NIK_KEPALA,
    nama_lengkap: "Saiful Anwar Samad",
    status_tinggal: "Rumah Dinas",
  });
  assert.equal(sampah.ok, false);
});

test("anggota tanpa rt_id tetap milik rumah tangga; UUID asing ditolak", () => {
  assert.equal(anggotaSamaWilayah(null, RT_SAH), true);
  assert.equal(anggotaSamaWilayah("", RT_SAH), true);
  assert.equal(anggotaSamaWilayah(RT_SAH, RT_SAH), true);
  assert.equal(anggotaSamaWilayah(RT_ASING, RT_SAH), false);
  assert.equal(anggotaSamaWilayah(RT_SAH, ""), false);
});

test("Buku Induk impor memakai jalur privileged dan kosakata kanonik", async () => {
  const sumber = await baca("app/admin/warga/page.tsx");
  assert.match(sumber, /siapkanBarisImporWarga/);
  assert.match(sumber, /getSupabaseAdminClientDariSesi/);
  assert.match(sumber, /privileged\.from\("warga"\)\.insert/);
  assert.doesNotMatch(sumber, /Warga Kontrak|Pendatang/);
  assert.match(sumber, /status_aktif: true/);
});

test("portal tidak mengunci sesi hanya karena anggota warisan tanpa rt_id", async () => {
  const sensus = await baca("app/portal/sensus/page.tsx");
  const keluarga = await baca("app/portal/(terkunci)/keluarga/page.tsx");
  assert.match(sensus, /anggotaSamaWilayah/);
  assert.match(keluarga, /anggotaSamaWilayah/);
  assert.doesNotMatch(sensus, /anggotaTerbaca[\s\S]{0,500}redirect\("\/login"\)/);
  assert.doesNotMatch(keluarga, /anggotaTerbaca[\s\S]{0,500}redirect\("\/login"\)/);
});

test("demografi publik menyaring anggota di aplikasi, bukan membuang rt_id kosong di PostgREST", async () => {
  const dal = await baca("lib/landing-publik.ts");
  assert.match(dal, /anggotaSamaWilayah/);
  assert.match(dal, /normalisasi-warga/);
  assert.doesNotMatch(dal, /foreignTable:\s*"anggota_keluarga"/);
});
