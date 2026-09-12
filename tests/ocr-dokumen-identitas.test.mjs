import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  nikDigitSah,
  nikKodeTanggalSah,
  parseTeksOcr,
  petaAgamaOcr,
  petaPendidikanOcr,
  rapikanAlamatOcr,
  susunIsianDariOcr,
  uraikanTanggalDariNik,
} from "../lib/ocr-dokumen-identitas.ts";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const TEKS_KTP = `
PROVINSI DKI JAKARTA
KOTA JAKARTA SELATAN
NIK : 3174025212850001
Nama : SITI AMINAH
Tempat/Tgl Lahir : JAKARTA, 12-12-1985
Jenis Kelamin : PEREMPUAN Gol. Darah : O
Alamat : JL PELITA NO 28
RT/RW : 007/009
Kel/Desa : CIPETE
Kecamatan : CILANDAK
Agama : ISLAM
Status Perkawinan : KAWIN
Pekerjaan : MENGURUS RUMAH TANGGA
Kewarganegaraan : WNI
`;

const TEKS_KK = `
KARTU KELUARGA
No. 3174022201090001
Nama Kepala Keluarga : BUDI SANTOSO
Alamat : GANG PELITA NO 28
RT/RW : 007/009

NIK 3174021212850001 Nama BUDI SANTOSO Jenis Kelamin LAKI-LAKI Tempat/Tgl Lahir JAKARTA, 12-12-1985 Agama ISLAM Pendidikan SLTA Pekerjaan KARYAWAN SWASTA Status Hub Dalam Keluarga KEPALA KELUARGA
NIK 3174025212850002 Nama SITI AMINAH Jenis Kelamin PEREMPUAN Tempat/Tgl Lahir BANDUNG, 12-12-1985 Agama ISLAM Pendidikan SLTA Pekerjaan MENGURUS RUMAH TANGGA Status Hub Dalam Keluarga ISTRI
NIK 3174021212200003 Nama RAFI SANTOSO Jenis Kelamin LAKI-LAKI Tempat/Tgl Lahir JAKARTA, 12-12-2020 Agama ISLAM Pendidikan BELUM SEKOLAH Pekerjaan PELAJAR Status Hub Dalam Keluarga ANAK
`;

test("NIK 16 digit menolak spam dan huruf", () => {
  assert.equal(nikDigitSah("3174021212850001"), true);
  assert.equal(nikDigitSah("0000000000000000"), false);
  assert.equal(nikDigitSah("1234567890123456"), false);
  assert.equal(nikDigitSah("317402121285000"), false);
});

test("Kode tanggal NIK membedakan perempuan (+40) dan menolak No KK tanpa tanggal lahir sah", () => {
  const perempuan = uraikanTanggalDariNik("3174025212850001");
  assert.ok(perempuan);
  assert.equal(perempuan.jenis_kelamin, "Perempuan");
  assert.equal(perempuan.tanggal_lahir, "1985-12-12");
  const laki = uraikanTanggalDariNik("3174021212850001");
  assert.ok(laki);
  assert.equal(laki.jenis_kelamin, "Laki-laki");
  assert.equal(nikKodeTanggalSah("3174020000000001"), false);
});

test("Agama, pendidikan, dan alamat dipetakan ke nilai formulir tanpa RT/RW", () => {
  assert.equal(petaAgamaOcr("KRISTEN PROTESTAN"), "Kristen/Katolik");
  assert.equal(petaPendidikanOcr("STRATA I"), "DIP IV/STRATA 1");
  assert.equal(petaPendidikanOcr("BELUM SEKOLAH"), "Belum sekolah");
  assert.equal(rapikanAlamatOcr("JL PELITA NO 28 RT/RW 007/009 KEL/DESA CIPETE"), "JL PELITA NO 28");
});

test("OCR KTP mengisi kepala, tidak mengarang anggota, dan tidak menyentuh WhatsApp", () => {
  const hasil = parseTeksOcr(TEKS_KTP);
  assert.equal(hasil.jenis, "ktp");
  assert.equal(hasil.kepala?.nik, "3174025212850001");
  assert.match(hasil.kepala?.nama_lengkap || "", /Siti Aminah/i);
  assert.equal(hasil.kepala?.jenis_kelamin, "Perempuan");
  assert.equal(hasil.kepala?.agama, "Islam");
  assert.equal(hasil.anggota.length, 0);
  assert.doesNotMatch(JSON.stringify(hasil), /whatsapp|pin/i);
  assert.match(hasil.alamat, /PELITA NO 28/i);
  assert.doesNotMatch(hasil.alamat, /007/);
});

test("OCR KK memisahkan nomor KK, kepala, istri, dan anak", () => {
  const hasil = parseTeksOcr(TEKS_KK);
  assert.equal(hasil.jenis, "kk");
  assert.equal(hasil.no_kk, "3174022201090001");
  assert.equal(hasil.kepala?.nik, "3174021212850001");
  assert.match(hasil.kepala?.nama_lengkap || "", /Budi Santoso/i);
  assert.equal(hasil.anggota.length, 2);
  assert.equal(hasil.anggota[0]?.hubungan_keluarga, "Istri");
  assert.equal(hasil.anggota[1]?.hubungan_keluarga, "Anak");
  assert.equal(hasil.anggota[1]?.pendidikan, "Belum sekolah");
});

test("Carik menolak menerapkan KK yang NIK-nya tidak cocok dengan akun", () => {
  const hasil = parseTeksOcr(TEKS_KK);
  const ditolak = susunIsianDariOcr(hasil, { nikTerkunci: "3174029999990001" });
  assert.equal(ditolak.bisaDiterapkan, false);
  assert.equal(ditolak.anggota.length, 0);
  assert.equal(ditolak.kepala.nik, "");
  const sah = susunIsianDariOcr(hasil, { nikTerkunci: "3174025212850002" });
  assert.equal(sah.bisaDiterapkan, true);
  assert.equal(sah.kepala.nik, "3174025212850002");
  assert.equal(sah.kepala.hubungan_kk, "Istri");
  assert.equal(sah.anggota.some((item) => item.nik === "3174025212850002"), false);
});

test("Huruf OCR O/I pada untai 16 digit dikembalikan ke angka", () => {
  const hasil = parseTeksOcr("NIK : 3I7402I2I285OOO1\nNama : BUDI SANTOSO\nJenis Kelamin : LAKI-LAKI");
  assert.equal(hasil.kepala?.nik, "3174021212850001");
});

test("Lapor Diri dan Carik memakai OCR sebagai isian, bukan insert tabel", async () => {
  const klienDaftar = await baca("app/register/RegisterClient.tsx");
  const aksiDaftar = await baca("app/register/actions.ts");
  const klienCarik = await baca("app/portal/sensus/SensusClient.tsx");
  const aksiCarik = await baca("app/portal/sensus/actions.ts");
  const komponen = await baca("components/BacaFotoIdentitas.tsx");
  const mesin = await baca("lib/ocr-tesseract-klien.ts");
  const proxy = await baca("proxy.ts");

  assert.match(klienDaftar, /BacaFotoIdentitas/);
  assert.match(klienCarik, /BacaFotoIdentitas/);
  assert.match(komponen, /Terapkan ke formulir/);
  assert.match(komponen, /Bukan ditulis langsung ke buku induk/);
  assert.doesNotMatch(komponen, /localStorage/);
  assert.match(mesin, /createWorker/);
  assert.match(mesin, /Gambar tidak diunggah ke mesin OCR/);
  assert.doesNotMatch(aksiDaftar, /tesseract|parseTeksOcr|bacaFotoIdentitas/);
  assert.doesNotMatch(aksiCarik, /tesseract|parseTeksOcr|bacaFotoIdentitas/);
  assert.match(proxy, /wasm-unsafe-eval/);
});
