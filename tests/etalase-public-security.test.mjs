import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("DAL etalase hanya berjalan di server dan selalu memfilter tenant", async () => {
  const source = await baca("lib/etalase-publik.ts");
  assert.match(source, /import "server-only"/);
  assert.match(source, /uuidTenantSah\(rtId\)/);
  assert.equal((source.match(/\.eq\("rt_id", tenant\)/g) || []).length, 3);
});

test("route publik mengambil tenant dari environment, bukan request", async () => {
  const source = await baca("app/api/public/etalase/route.ts");
  assert.match(source, /uuidTenantSah\(process\.env\.PUBLIC_RT_ID\)/);
  assert.doesNotMatch(source, /searchParams|request\.url|params/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
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
