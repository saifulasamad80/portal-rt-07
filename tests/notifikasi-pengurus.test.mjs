import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("SQL push pengurus mengunci pemilik, tenant, dan RLS", async () => {
  const sql = await baca("push-langganan-pengurus.sql");
  assert.match(sql, /ALTER COLUMN warga_id DROP NOT NULL/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS pengurus_id uuid/);
  assert.match(sql, /REFERENCES public\.pengurus_rt\(id\) ON DELETE CASCADE/);
  assert.match(sql, /CHECK \(warga_id IS NOT NULL OR pengurus_id IS NOT NULL\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.kunci_rt_id_dari_push\(\)/);
  assert.match(sql, /Langganan push tidak boleh menautkan warga dan pengurus beda RT/);
  assert.match(sql, /Pengurus kelola langganan push sendiri/);
  assert.match(sql, /pengurus_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(sql, /dapatkan_rt_id_saya\(\)/);
  assert.doesNotMatch(sql, /SERVICE_ROLE/);
});

test("Registrasi mengetuk pengurus setelah tiket sukses, tanpa menggagalkan insert", async () => {
  const aksi = await baca("app/register/actions.ts");
  assert.match(aksi, /kirimNotifikasiKePengurus/);
  assert.match(aksi, /url: "\/admin\/verifikasi"/);
  assert.match(aksi, /Pendaftaran tersimpan, namun notifikasi pengurus gagal/);
  const tiket = aksi.indexOf("tiketId = String(tiketBaru.id)");
  const push = aksi.lastIndexOf("kirimNotifikasiKePengurus(");
  const sukses = aksi.lastIndexOf('return { success: true, message: "SUKSES" }');
  assert.ok(tiket >= 0 && push > tiket && sukses > push);
});

test("Siaran catatDanKirimSekali dengan rtId mengirim ke warga RT itu", async () => {
  const sumber = await baca("lib/notifikasi-push.ts");
  assert.match(sumber, /export async function kirimNotifikasiKePengurus/);
  const fn = sumber.slice(sumber.indexOf("export async function catatDanKirimSekali"));
  assert.match(fn, /if \(sasaran\.semua\)/);
  assert.match(fn, /return kirimNotifikasiKeSemuaWarga\(payload, rtId\)/);
});

test("Klik notifikasi membuka path tujuan, bukan tab sembarang yang mengandung /", async () => {
  const sw = await baca("public/sw.js");
  assert.doesNotMatch(sw, /client\.url\.includes\(tujuan\)/);
  assert.match(sw, /pathClient === tujuan/);
  assert.match(sw, /self\.clients\.openWindow/);
});

test("Tombol pengurus menyinkronkan langganan yang sudah ada ke API admin", async () => {
  const tombol = await baca("components/TombolNotifikasiPush.tsx");
  const dasbor = await baca("app/admin/AdminDashboardClient.tsx");
  const verifikasi = await baca("app/admin/verifikasi/VerifikasiWargaClient.tsx");
  assert.match(tombol, /sasaran === "pengurus" \? "\/api\/admin\/push\/subscribe"/);
  assert.match(tombol, /method: "POST"/);
  assert.match(tombol, /existing\.toJSON\(\)/);
  assert.match(dasbor, /<TombolNotifikasiPush sasaran="pengurus" \/>/);
  assert.match(verifikasi, /<TombolNotifikasiPush sasaran="pengurus" \/>/);
});

test("API langganan pengurus memakai sesi admin dan klien privileged ber-sesi", async () => {
  const langganan = await baca("app/api/admin/push/subscribe/route.ts");
  const tes = await baca("app/api/admin/push/tes/route.ts");
  const tesWarga = await baca("app/api/push/tes/route.ts");
  const pengumuman = await baca("app/admin/pengumuman/page.tsx");

  assert.match(langganan, /otentikasiAdminAktif/);
  assert.match(langganan, /getSupabaseAdminClientDariSesi\(sesi\)/);
  assert.match(langganan, /pengurus_id: sesi\.id/);
  assert.match(langganan, /\.eq\("rt_id", sesi\.rtId\)/);
  assert.doesNotMatch(langganan, /getSupabaseAdminClient\(\)/);
  assert.match(tes, /pengurusId: sesi\.id/);
  assert.doesNotMatch(tesWarga, /RT 07/);
  assert.match(pengumuman, /url: "\/portal"/);
});
