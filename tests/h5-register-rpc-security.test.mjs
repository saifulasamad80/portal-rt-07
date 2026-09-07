import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("H5 SQL mewajibkan p_rt_id dan menghapus LIMIT 1 pengurus_rt", async () => {
  const sql = await baca("h5-fix-rpc-register-warga.sql");

  assert.match(sql, /CREATE FUNCTION public\.register_warga_baru\(/);
  assert.match(sql, /p_rt_id uuid/);
  assert.match(sql, /FROM public\.master_rt AS m\s+WHERE m\.id = p_rt_id/);
  assert.match(sql, /INTO STRICT v_rt_id/);
  assert.match(sql, /INSERT INTO public\.anggota_keluarga \([\s\S]*rt_id/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.register_warga_baru\(jsonb, jsonb\) FROM PUBLIC/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.register_warga_baru\(jsonb, jsonb, uuid\) TO service_role/);
  assert.doesNotMatch(sql, /FROM pengurus_rt WHERE rt_id IS NOT NULL LIMIT 1/);
  assert.doesNotMatch(sql, /SECURITY DEFINER/);
});

test("Server Action /register tidak memanggil RPC warisan; rt_id diikat dari master_rt", async () => {
  const aksi = await baca("app/register/actions.ts");
  const halaman = await baca("app/register/page.tsx");
  const tenant = await baca("lib/registrasi-tenant.ts");

  assert.doesNotMatch(aksi, /register_warga_baru/);
  assert.doesNotMatch(aksi, /\.rpc\(/);
  assert.match(aksi, /pastikanRtRegistrasiAda/);
  assert.match(aksi, /rt_id: rtId/);
  assert.equal((aksi.match(/rt_id: rtId/g) || []).length, 3);

  assert.match(halaman, /tetapkanRtRegistrasi\(rt\)/);
  assert.match(halaman, /aksiRegister\(rtIdTerikat, payloadKepala, anggotaPayload\)/);

  assert.match(tenant, /import "server-only"/);
  assert.match(tenant, /from\("master_rt"\)/);
  assert.match(tenant, /\.eq\(filter\.kolom, filter\.nilai\)/);
  assert.doesNotMatch(tenant, /LIMIT 1/);
});
