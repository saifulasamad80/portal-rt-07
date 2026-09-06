import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const AKAR = fileURLToPath(new URL("..", import.meta.url));

async function baca(relatif) {
  return readFile(path.join(AKAR, relatif), "utf8");
}

async function kumpulkanBerkas(relatifDir, ekstensi) {
  const absolut = path.join(AKAR, relatifDir);
  const entri = await readdir(absolut, { withFileTypes: true });
  const hasil = [];
  for (const item of entri) {
    const lanjut = path.join(relatifDir, item.name);
    if (item.isDirectory()) {
      hasil.push(...(await kumpulkanBerkas(lanjut, ekstensi)));
      continue;
    }
    if (ekstensi.some((akhir) => item.name.endsWith(akhir))) hasil.push(lanjut);
  }
  return hasil;
}

const IZIN_SERVICE_ROLE = new Set([
  "app/api/admin/login/route.ts",
  "app/api/warga/login/route.ts",
  "app/admin/lupa-sandi/page.tsx",
  "app/admin/reset-sandi/page.tsx",
  "app/api/cron/notifikasi/route.ts",
  "app/page.tsx",
  "app/register/actions.ts",
]);

test("klien data tidak menandatangani PostgREST dengan JWT_SECRET cookie", async () => {
  const sumber = await baca("lib/supabase-server.ts");
  assert.match(sumber, /export async function buatKlienTerautentikasi/);
  assert.match(sumber, /function kunciJwtProyekSupabase/);
  assert.match(sumber, /process\.env\.SUPABASE_JWT_SECRET/);
  assert.match(sumber, /getSupabaseAdminClientDariSesi\(sesi\)/);
  assert.match(sumber, /role:\s*"authenticated"/);
  assert.match(sumber, /aud:\s*"authenticated"/);
  assert.match(sumber, /rt_id:\s*rtId/);
  assert.match(sumber, /app_role:\s*kastaAplikasiDariSesi\(sesi\)/);
  assert.match(sumber, /accessToken:\s*async \(\) => tokenData/);
  assert.match(sumber, /penerbitJwtAuth\(urlProyek\)/);
  assert.match(sumber, /\.setSubject\(id\)/);
  assert.doesNotMatch(sumber, /role:\s*sesi\.role/);
  assert.doesNotMatch(sumber, /function kunciJwtPostgrest/);
  assert.match(sumber, /export function getSupabaseAdminClientDariSesi/);
  assert.match(sumber, /!POLA_UUID\.test\(id\) \|\| !POLA_UUID\.test\(rtId\)/);
});

test("migrasi RLS menutup jumantik publik dan memakai helper tenant", async () => {
  const sql = await baca("rls-authenticated-data-layer-migration.sql");
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.adalah_pengurus\(\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.dapatkan_rt_id_saya\(\)/);
  assert.match(sql, /auth\.jwt\(\) ->> p_nama/);
  assert.match(sql, /klaim_teks_jwt\('rt_id'\)/);
  assert.match(sql, /DROP POLICY IF EXISTS "Bebas baca laporan" ON public\.laporan_jumantik/);
  assert.match(sql, /DROP POLICY IF EXISTS "Bebas tambah laporan" ON public\.laporan_jumantik/);
  assert.match(sql, /Pengurus kelola jumantik RT sendiri/);
  assert.match(sql, /Warga daftar arisan RT sendiri/);
  assert.match(sql, /Webmaster kelola pengurus/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.dapatkan_rt_id_saya\(\) TO authenticated/);
});

test("script JWT claims membaca rt_id dari auth.jwt dan punya SELECT tenant", async () => {
  const sql = await baca("rls-jwt-rt-id-claims-migration.sql");
  assert.match(sql, /auth\.jwt\(\) ->> p_nama/);
  assert.match(sql, /klaim_teks_jwt\('rt_id'\)/);
  assert.match(sql, /klaim_teks_jwt\('app_role'\)/);
  assert.match(sql, /request\.jwt\.claim\.' \|\| p_nama/);
  assert.match(sql, /Pengurus baca pengurus RT sendiri/);
  assert.match(sql, /rt_id = \(SELECT public\.dapatkan_rt_id_saya\(\)\)/);
  assert.match(sql, /ON public\.warga/);
  assert.match(sql, /ON public\.kas_rt/);
  assert.match(sql, /ON public\.pengurus_rt/);
});

test("halaman kas, pengumuman, dan jumantik tidak memakai service_role", async () => {
  const kas = await baca("app/admin/kas/page.tsx");
  const pengumuman = await baca("app/admin/pengumuman/page.tsx");
  const jumantik = await baca("app/admin/ibu-ibu/page.tsx");
  const portalArisan = await baca("app/portal/(terkunci)/ibu-ibu/arisan/page.tsx");

  for (const [nama, sumber] of [
    ["kas", kas],
    ["pengumuman", pengumuman],
    ["jumantik", jumantik],
    ["arisan portal", portalArisan],
  ]) {
    assert.match(sumber, /buatKlienTerautentikasi/, `${nama} wajib klien terautentikasi`);
    assert.doesNotMatch(sumber, /SUPABASE_SERVICE_ROLE_KEY/, `${nama} tidak boleh memuat service_role`);
    assert.doesNotMatch(sumber, /getSupabaseAdminClient\(\)/, `${nama} tidak boleh memanggil admin tanpa sesi`);
  }

  assert.match(jumantik, /rt_id: sesi\.rtId/);
  assert.match(kas, /rt_id: idRt/);
  assert.match(pengumuman, /buatKlienTerautentikasi\(sesi\)/);
  assert.match(portalArisan, /rt_id: sesi\.rtId/);
});

test("API warga GET memakai klien terautentikasi; DELETE privileged setelah otorisasi sesi", async () => {
  const sumber = await baca("app/api/admin/warga/route.ts");
  assert.match(sumber, /buatKlienTerautentikasi\(otentikasi\.sesi\)/);
  assert.match(sumber, /otorisasiWargaUntukAdmin/);
  assert.match(sumber, /getSupabaseAdminClientDariSesi\(otentikasi\.sesi\)/);
  assert.doesNotMatch(sumber, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(sumber, /createClient\(/);
});

test("RPC pengurus dan kurban mengambil rt_id dari sesi, bukan payload klien", async () => {
  const pengurus = await baca("app/admin/pengurus/page.tsx");
  const kurban = await baca("app/admin/kurban/page.tsx");
  assert.match(pengurus, /rpc\("simpan_pengurus_rt"/);
  assert.match(pengurus, /p_rt_id: sesiAsli\.rtId/);
  assert.match(pengurus, /getSupabaseAdminClientDariSesi\(sesiAsli\)/);
  assert.match(pengurus, /buatKlienTerautentikasi/);
  assert.match(kurban, /rpc\("proses_autodebet_kurban"/);
  assert.match(kurban, /getSupabaseAdminClientDariSesi\(sesiAsli\)/);
});

test("sisa service_role di app/ hanya jalur tanpa sesi yang diizinkan", async () => {
  const berkas = await kumpulkanBerkas("app", [".ts", ".tsx"]);
  const tersisa = [];
  for (const file of berkas) {
    const isi = await baca(file);
    if (!/SUPABASE_SERVICE_ROLE_KEY|getSupabaseAdminClient\(\)/.test(isi)) continue;
    if (IZIN_SERVICE_ROLE.has(file.replaceAll("\\", "/"))) continue;
    tersisa.push(file);
  }
  assert.deepEqual(tersisa, [], `service_role bocor di: ${tersisa.join(", ")}`);
});

test("reset PIN tidak mengirim string kosong ke kolom uuid rt_id", async () => {
  const keamanan = await baca("lib/session-security.ts");
  const bukuInduk = await baca("app/admin/warga/page.tsx");
  const dashboard = await baca("app/admin/page.tsx");
  const profil = await baca("app/admin/warga/[id]/page.tsx");

  assert.match(keamanan, /export function wilayahMutasiWarga/);
  assert.match(keamanan, /dasar\.is\("rt_id", null\)/);

  for (const [nama, sumber] of [
    ["buku induk", bukuInduk],
    ["dashboard", dashboard],
    ["profil warga", profil],
  ]) {
    assert.match(sumber, /wilayahMutasiWarga/, `${nama} wajib memakai wilayahMutasiWarga`);
    assert.match(sumber, /saringWargaTerotorisasi/, `${nama} wajib menyaring tanpa uuid kosong`);
    assert.doesNotMatch(
      sumber,
      /\.eq\("rt_id", target(?:Warga)?\.sesi\.rtId\)/,
      `${nama} tidak boleh .eq rt_id mentah dari sesi target`
    );
  }
});

test("audit carik dan arsip wajib membawa rt_id", async () => {
  const carik = await baca("lib/verifikasi-carik.ts");
  const arsip = await baca("lib/arsip-warga.ts");
  assert.match(carik, /tabel_target: "warga", detail, rt_id: rtId/);
  assert.match(arsip, /rt_id: rtId/);
});
