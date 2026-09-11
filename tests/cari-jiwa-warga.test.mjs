import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { siapkanBukuIndukWarga, susunHasilCari, tempelAnggotaKeKartuKk, teksCari } from "../lib/cari-jiwa-warga.ts";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const RT = "00000000-0000-0000-0000-000000000007";
const ID_SAIFUL = "8d199dde-79e1-424b-821b-e5f28f816808";

test("cari Giyanti menuntun ke kartu KK Saiful, bukan baris KK baru", () => {

  const kartu = tempelAnggotaKeKartuKk(
    [
      {
        id: ID_SAIFUL,
        nama_lengkap: "Saiful Anwar Samad",
        nik: "3175040305800012",
        no_kk: "3175041111111111",
        rt_id: RT,
      },
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        nama_lengkap: "KK Lain",
        nik: "3175040000000001",
        rt_id: RT,
      },
    ],
    [
      {
        id: "0c095e71-c971-4008-aa9b-136f0306a55d",
        warga_id: ID_SAIFUL,
        nama_lengkap: "Sari Giyanti",
        hubungan_keluarga: "Istri",
        nik: "3174106002830009",
        rt_id: RT,
      },
      {
        id: "a2e60064-b2ee-451a-9f0c-b596a4a58834",
        warga_id: ID_SAIFUL,
        nama_lengkap: "Almahyra Ghaliyah Anwar",
        hubungan_keluarga: "Anak",
        nik: "3175044802131006",
        rt_id: RT,
      },
    ],
    RT
  );

  const hasil = susunHasilCari(kartu, teksCari("Giyanti"));
  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].warga.nama_lengkap, "Saiful Anwar Samad");
  assert.equal(hasil[0].cocokKk, false);
  assert.equal(hasil[0].tanggunganCocok.length, 1);
  assert.equal(hasil[0].tanggunganCocok[0].nama_lengkap, "Sari Giyanti");
  assert.equal(hasil[0].tanggunganCocok[0].hubungan_keluarga, "Istri");
  assert.equal(hasil[0].warga.anggota_keluarga.length, 2);
});

test("buku induk memuat jiwa lewat kueri anggota_keluarga terpisah", async () => {
  const halaman = await baca("app/admin/warga/page.tsx");
  const klien = await baca("app/admin/warga/WargaAdminClient.tsx");
  assert.match(halaman, /from\("anggota_keluarga"\)/);
  assert.match(halaman, /siapkanBukuIndukWarga/);
  assert.doesNotMatch(halaman, /anggota_keluarga\s*\(/);
  assert.match(klien, /from "@\/lib\/cari-jiwa-warga"/);
  assert.match(klien, /Cari istri, anak, KK, NIK, atau No\. KK/);
  assert.match(klien, /di KK \$\{jiwa\.namaKk\}/);
  assert.match(klien, /punya akun portal/);
});

test("akun portal istri tidak membuat kartu KK kedua di buku induk", () => {
  const idSuhaimi = "ce5fd463-501a-41fe-bfa9-a648f25d2292";
  const idWiwik = "bfbf26c1-2d31-4577-8ffc-093986e5cbf5";
  const kartu = siapkanBukuIndukWarga(
    [
      {
        id: idSuhaimi,
        nama_lengkap: "SUHAIMI",
        nik: "3175040502730003",
        no_kk: "3175042107111001",
        hubungan_kk: "KK",
        rt_id: RT,
      },
      {
        id: idWiwik,
        nama_lengkap: "WIWIK WINARTI",
        nik: "3175046305750001",
        no_kk: "3175042107111001",
        hubungan_kk: "Istri",
        rt_id: RT,
      },
    ],
    [
      {
        id: "cd3bc6e7-788c-47f4-bf04-bfefe25ea260",
        warga_id: idSuhaimi,
        nama_lengkap: "WIWIK WINARTI",
        hubungan_keluarga: "Istri",
        nik: "3175046305750001",
        rt_id: RT,
      },
    ],
    RT
  );

  assert.equal(kartu.length, 1);
  assert.equal(kartu[0].nama_lengkap, "SUHAIMI");
  assert.equal(kartu[0].anggota_keluarga.length, 1);
  assert.equal(kartu[0].anggota_keluarga[0].nama_lengkap, "WIWIK WINARTI");
  assert.equal(kartu[0].anggota_keluarga[0].punya_akun_portal, true);
});
