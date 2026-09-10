import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("DAL etalase hanya berjalan di server dan selalu memfilter tenant", async () => {
  const source = await baca("lib/etalase-publik.ts");
  assert.match(source, /import "server-only"/);
  assert.match(source, /klienDanTenantPublik/);
  assert.match(source, /resolveTenantPublik/);
  assert.match(source, /UUID_SENTINEL/);
  assert.equal((source.match(/\.eq\("rt_id", tenant\)/g) || []).length, 3);
  assert.doesNotMatch(source, /searchParams|request\.url/);
});

test("route publik mengambil tenant dari environment, bukan request", async () => {
  const source = await baca("app/api/public/etalase/route.ts");
  assert.match(source, /uuidTenantSah\(process\.env\.PUBLIC_RT_ID\)/);
  assert.doesNotMatch(source, /searchParams|request\.url|params/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(source, /getSupabaseAdminClient/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("halaman landing tidak memegang service_role; DAL mengikat tenant termasuk suara_voting", async () => {
  const halaman = await baca("app/page.tsx");
  const dal = await baca("lib/landing-publik.ts");
  const tenant = await baca("lib/tenant-publik.ts");

  assert.match(halaman, /ambilMuatanLandingPublik/);
  assert.match(halaman, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(halaman, /revalidate = 60/);
  assert.doesNotMatch(halaman, /getSupabaseAdminClient/);
  assert.doesNotMatch(halaman, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(halaman, /createClient\(/);
  assert.match(halaman, /daftarLapak/);
  assert.match(halaman, /LapakPublik/);
  assert.doesNotMatch(halaman, /Unduh dokumen warga/);
  const lapakPublik = await baca("app/LapakPublik.tsx");
  assert.match(lapakPublik, /Masuk untuk hubungi/);
  assert.doesNotMatch(lapakPublik, /wa\.me/);
  assert.doesNotMatch(lapakPublik, /nomor_wa/);
  assert.match(dal, /from\("lapak_warga"\)[\s\S]*?\.eq\("rt_id", tenant\)/);
  assert.match(dal, /from\("lapak_warga"\)[\s\S]*?\.eq\("status", "Aktif"\)/);
  assert.match(dal, /from\("lapak_warga"\)\s*\.select\("id, nama_usaha, kategori, deskripsi, foto_url"\)/);
  const galeri = await baca("app/GaleriKegiatanClient.tsx");
  assert.match(galeri, /grid-cols-2 md:grid-cols-3/);
  assert.doesNotMatch(galeri, /md:col-span-3/);

  assert.match(dal, /import "server-only"/);
  assert.match(dal, /klienDanTenantPublik/);
  assert.doesNotMatch(dal, /getSupabaseAdminClient\(\)/);
  assert.match(dal, /from\("suara_voting"\)[\s\S]*?\.eq\("rt_id", tenant\)/);
  assert.match(dal, /from\("suara_voting"\)[\s\S]*?\.eq\("voting_id", votingTerbaru\.id\)/);
  assert.match(dal, /from\("master_rt"\)[\s\S]*?\.eq\("id", tenant\)/);
  assert.ok(
    (dal.match(/\.eq\("rt_id", tenant\)/g) || []).length >= 9,
    "setiap kueri operasional landing wajib .eq rt_id",
  );

  assert.match(tenant, /uuidTenantSah\(nilai\)/);
  assert.match(tenant, /process\.env\.PUBLIC_RT_ID/);
  assert.match(tenant, /getSupabaseServerClient/);
  assert.match(tenant, /UUID_SENTINEL/);
  assert.doesNotMatch(tenant, /searchParams|request\.url/);
});

test("migration H1 hanya mencabut anon dan mempertahankan authenticated tenant-aware", async () => {
  const source = await baca("h1-etalase-anon-lockdown.sql");
  assert.match(source, /FROM anon;/);
  assert.doesNotMatch(source, /FROM\s+authenticated/i);
  assert.doesNotMatch(source, /TO\s+anon\s*,\s*authenticated/i);
  assert.match(source, /TO authenticated;/);
  assert.equal((source.match(/FOR SELECT TO anon/g) || []).length, 3);
  assert.equal((source.match(/FOR ALL TO authenticated/g) || []).length, 3);
  assert.equal((source.match(/klaim_baca_tenant\(rt_id\)/g) || []).length, 3);
  assert.equal((source.match(/klaim_tulis_tenant\(rt_id\)/g) || []).length, 3);
});
