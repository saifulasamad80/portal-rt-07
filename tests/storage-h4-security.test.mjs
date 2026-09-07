import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("H4 migration mengunci bucket dokumen_warga untuk direct client access", async () => {
  const sql = await baca("h4-storage-lockdown.sql");

  assert.match(sql, /UPDATE storage\.buckets[\s\S]*SET public = false[\s\S]*WHERE id = 'dokumen_warga'/);
  assert.match(sql, /DROP POLICY IF EXISTS %I ON storage\.objects/);
  assert.match(sql, /roles && ARRAY\['public'::name, 'anon'::name, 'authenticated'::name\]/);
  assert.match(sql, /cmd IN \('ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE'\)/);
  assert.match(sql, /CREATE POLICY "H4 deny direct dokumen_warga access"/);
  assert.match(sql, /AS RESTRICTIVE/);
  assert.match(sql, /FOR ALL/);
  assert.match(sql, /TO public/);
  assert.match(sql, /USING \(bucket_id <> 'dokumen_warga'\)/);
  assert.match(sql, /WITH CHECK \(bucket_id <> 'dokumen_warga'\)/);
});

test("route admin dokumen hanya menerbitkan signed URL server-side setelah validasi path dan owner", async () => {
  const source = await baca("app/api/admin/dokumen/route.ts");

  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.match(source, /POLA_PATH_DOKUMEN_WARGA/);
  assert.match(source, /\.eq\("ktp_path", path\)/);
  assert.match(source, /\.eq\("kk_path", path\)/);
  assert.match(source, /queryKtp = queryKtp\.eq\("rt_id", otentikasi\.sesi\.rtId\)/);
  assert.match(source, /queryKk = queryKk\.eq\("rt_id", otentikasi\.sesi\.rtId\)/);
  assert.match(source, /getSupabaseAdminClientDariSesi\(otentikasi\.sesi\)/);
  assert.match(source, /\.from\("dokumen_warga"\)/);
  assert.match(source, /\.createSignedUrl\(path, 60\)/);
  assert.doesNotMatch(source, /storage\/v1\/object\/public\/dokumen_warga/);
  assert.doesNotMatch(source, /getPublicUrl/);
});
