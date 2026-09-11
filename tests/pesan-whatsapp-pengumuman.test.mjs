import assert from "node:assert/strict";
import test from "node:test";
import {
  ringkasTeksPengumuman,
  susunPesanWhatsAppPengumuman,
  tautanPengumumanPublik,
} from "../lib/pesan-whatsapp-pengumuman.ts";

test("tautan pengumuman menunjuk permalink, bukan beranda", () => {
  assert.equal(
    tautanPengumumanPublik("https://wargaku-six.vercel.app", "11111111-1111-1111-1111-111111111111"),
    "https://wargaku-six.vercel.app/pengumuman/11111111-1111-1111-1111-111111111111",
  );
});

test("pesan WA memuat judul, ringkasan, dan tautan", () => {
  const pesan = susunPesanWhatsAppPengumuman({
    judul: "Penutupan dekat Masjid Al-Hawi Condet",
    deskripsi: "Peringatan tahun Masjid Al-Hawi Condet, mohon warga mencari jalan alternatif.",
    tautan: "https://contoh.test/pengumuman/abc",
    namaRt: "RT 07",
  });
  assert.match(pesan, /Pengumuman RT 07/);
  assert.match(pesan, /Penutupan dekat Masjid Al-Hawi Condet/);
  assert.match(pesan, /jalan alternatif/);
  assert.match(pesan, /https:\/\/contoh\.test\/pengumuman\/abc/);
  assert.doesNotMatch(pesan, /INFO PENTING RT 07/);
});

test("ringkasan memotong deskripsi panjang di batas kata", () => {
  const panjang = `${"lorem ".repeat(120)}selesai`;
  const ringkas = ringkasTeksPengumuman(panjang, 80);
  assert.ok(ringkas.endsWith("…"));
  assert.ok(ringkas.length <= 81);
  assert.doesNotMatch(ringkas, /selesai/);
});
