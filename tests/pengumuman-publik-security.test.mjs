import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("pengumuman publik fail-closed ke tenant environment, bukan request", async () => {
  const source = await baca("lib/pengumuman-publik.ts");
  assert.match(source, /import "server-only"/);
  assert.match(source, /klienDanTenantPublik/);
  assert.match(source, /UUID_SENTINEL/);
  assert.match(source, /uuidFormatSah/);
  assert.match(source, /\.eq\("id", idMentah\)/);
  assert.match(source, /\.eq\("rt_id", tenant\)/);
  assert.match(source, /from\("pengumuman_rt"\)[\s\S]*?select\("id, judul, deskripsi, link_dokumen, tanggal_publikasi"\)/);
  assert.doesNotMatch(source, /searchParams|request\.url/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(source, /getSupabaseAdminClient\(\)/);
});

test("preview tautan tidak memakai screenshot aplikasi lama", async () => {
  const layout = await baca("app/layout.tsx");
  const halaman = await baca("app/pengumuman/[id]/page.tsx");
  const ogBeranda = await baca("app/opengraph-image.tsx");
  const ogPengumuman = await baca("app/pengumuman/[id]/opengraph-image.tsx");
  assert.doesNotMatch(layout, /og-image\.jpeg/);
  assert.doesNotMatch(halaman, /og-image\.jpeg/);
  assert.match(ogBeranda, /buatGambarOpenGraph/);
  assert.match(ogPengumuman, /ambilPengumumanPublik/);
  assert.match(ogPengumuman, /Pengumuman resmi/);
});

test("share WhatsApp memakai permalink pengumuman, bukan hanya origin", async () => {
  const helper = await baca("lib/pesan-whatsapp-pengumuman.ts");
  const tombol = await baca("components/TombolShareWhatsAppPengumuman.tsx");
  const admin = await baca("app/admin/pengumuman/PengumumanAdminClient.tsx");
  const aksi = await baca("app/admin/pengumuman/page.tsx");
  assert.match(helper, /\/pengumuman\//);
  assert.match(helper, /Selengkapnya di mading portal/);
  assert.doesNotMatch(helper, /INFO PENTING RT 07/);
  assert.match(tombol, /tautanPengumumanPublik/);
  assert.match(tombol, /sebarPengumumanKeWhatsApp/);
  assert.match(admin, /sebarPengumumanKeWhatsApp/);
  assert.match(admin, /hasil\.id/);
  assert.match(aksi, /id: barisBaru\?\.id/);
  assert.match(aksi, /\/pengumuman\/\$\{barisBaru\.id\}/);
});
