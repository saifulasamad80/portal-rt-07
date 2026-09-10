import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("helper penyimpanan publik hanya di server dan mengikat path ke rt_id", async () => {
  const source = await baca("lib/penyimpanan-konten-publik.ts");
  assert.match(source, /import "server-only"/);
  assert.match(source, /\$\{rtId\}\/\$\{uuidv4\(\)\}/);
  assert.match(source, /path\.startsWith\(`\$\{rtId\}\//);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("validasi berkas menolak selain JPEG terkompresi dan PDF sampai 1,5 MB", async () => {
  const source = await baca("lib/validasi-berkas-unggah.ts");
  assert.match(source, /import "server-only"/);
  assert.match(source, /BATAS_BYTE_FOTO/);
  assert.match(source, /BATAS_BYTE_PDF/);
  assert.match(source, /image\/jpeg/);
  assert.match(source, /application\/pdf/);
});

test("admin galeri memverifikasi sesi dan tenant sebelum menulis", async () => {
  const source = await baca("app/admin/galeri/page.tsx");
  assert.match(source, /wajibOtentikasiAdmin/);
  assert.match(source, /\.eq\("rt_id", rtIdAktif\)/);
  assert.match(source, /\.eq\("rt_id", sesi\.rtId\)/);
  assert.match(source, /KUOTA_FOTO_GALERI/);
  assert.match(source, /parseDataUrlGambar/);
  assert.match(source, /segarKanPortalPublik/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("pengumuman unggah berkas langsung, bukan form Google Drive", async () => {
  const halaman = await baca("app/admin/pengumuman/page.tsx");
  const klien = await baca("app/admin/pengumuman/PengumumanAdminClient.tsx");
  assert.match(halaman, /parseDataUrlLampiran/);
  assert.match(halaman, /BUCKET_LAMPIRAN_PENGUMUMAN/);
  assert.match(halaman, /segarKanPortalPublik/);
  assert.match(klien, /type="file"/);
  assert.match(klien, /ThumbnailPdf/);
  assert.match(klien, /kompresGambarKeDataUrl/);
  assert.doesNotMatch(klien, /jpegHalamanPertamaDariBerkas/);
  assert.doesNotMatch(klien, /thumbnailDataUrl/);
  assert.match(halaman, /jpegHalamanPertamaPdfServer/);
  assert.match(await baca("lib/penyimpanan-konten-publik.ts"), /\.thumb\.jpg/);
  assert.match(await baca("components/ThumbnailPdf.tsx"), /urlApiThumbnailPdf/);
  assert.match(await baca("lib/thumbnail-pdf-server.ts"), /import "server-only"/);
  assert.match(await baca("app/api/thumbnail-pdf/route.ts"), /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(await baca("app/api/thumbnail-pdf/route.ts"), /BUCKET_LAMPIRAN_PENGUMUMAN/);
  assert.doesNotMatch(klien, /drive\.google\.com\/\.\.\./);
  assert.doesNotMatch(klien, /Link GDrive/);
});

test("foto lapak memakai helper kompresi dan hapus storage", async () => {
  const halaman = await baca("app/portal/(terkunci)/lapak/page.tsx");
  const klien = await baca("app/portal/(terkunci)/lapak/LapakClient.tsx");
  const admin = await baca("app/admin/lapak/page.tsx");
  assert.match(halaman, /parseDataUrlGambar/);
  assert.match(halaman, /hapusBerkasPublikDariUrl/);
  assert.match(halaman, /BUCKET_LAPAK/);
  assert.match(halaman, /segarKanPortalPublik/);
  assert.match(admin, /segarKanPortalPublik/);
  assert.match(klien, /kompresGambarKeDataUrl\(fileFoto, "fotoLapak"\)/);
  assert.doesNotMatch(halaman, /524_288/);
});

test("SQL bucket konten publik tidak membuka unggah anon", async () => {
  const source = await baca("konten-publik-storage.sql");
  assert.match(source, /galeri_kegiatan/);
  assert.match(source, /lampiran_pengumuman/);
  assert.match(source, /FOR SELECT/);
  assert.doesNotMatch(source, /FOR INSERT/);
  assert.match(source, /file_size_limit = 204800/);
  assert.match(source, /1572864/);
});
