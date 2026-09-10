import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Service worker PWA mengimpor OneSignal v16 di file yang sama", async () => {
  const worker = await baca("public/push/onesignal/OneSignalSDKWorker.js");
  const swPwa = await baca("public/sw.js");
  assert.match(worker, /cdn\.onesignal\.com\/sdks\/web\/v16\/OneSignalSDK\.sw\.js/);
  assert.match(swPwa, /cdn\.onesignal\.com\/sdks\/web\/v16\/OneSignalSDK\.sw\.js/);
  assert.match(swPwa, /data\.custom \|\| data\.onesignal \|\| data\.os_data/);
});

test("Layout memuat SDK OneSignal dan memakai worker PWA di scope root", async () => {
  const layout = await baca("app/layout.tsx");
  const klien = await baca("lib/onesignal-klien.ts");
  const konstanta = await baca("lib/onesignal.ts");
  assert.match(layout, /ONESIGNAL_SDK_URL/);
  assert.match(layout, /<InisialisasiOneSignal \/>/);
  assert.match(layout, /<PesanDialogProvider \/>/);
  assert.match(layout, /navigator\.serviceWorker\.register\('\/sw\.js'\)/);
  assert.match(konstanta, /ONESIGNAL_SW_PATH = "sw\.js"/);
  assert.match(konstanta, /ONESIGNAL_SW_SCOPE = "\/"/);
  assert.match(klien, /serviceWorkerPath: ONESIGNAL_SW_PATH/);
  assert.match(klien, /scope: ONESIGNAL_SW_SCOPE/);
  assert.match(klien, /notifyButton: \{ enable: false \}/);
  assert.match(klien, /autoPrompt: false/);
});

test("CSP mengizinkan CDN OneSignal dan tetap menahan frame asing", async () => {
  const proxy = await baca("proxy.ts");
  assert.match(proxy, /https:\/\/cdn\.onesignal\.com/);
  assert.match(proxy, /https:\/\/\*\.onesignal\.com/);
  assert.match(proxy, /script-src[^;]*https:\/\/\*\.onesignal\.com/);
  assert.match(proxy, /worker-src 'self' blob: https:\/\/cdn\.onesignal\.com/);
  assert.match(proxy, /frame-ancestors 'none'/);
});

test("Kiriman server memakai alias eksternal berperan, bukan siaran lintas RT", async () => {
  const kirim = await baca("lib/onesignal-kirim.ts");
  const notifikasi = await baca("lib/notifikasi-push.ts");
  assert.match(kirim, /include_aliases/);
  assert.match(kirim, /ONESIGNAL_REST_API_KEY/);
  assert.doesNotMatch(kirim, /included_segments/);
  assert.match(notifikasi, /export type HasilKirimNotifikasi/);
  assert.match(notifikasi, /onesignalPengirimanSiap\(\)/);
  assert.match(notifikasi, /idEksternalWarga/);
  assert.match(notifikasi, /\.eq\("rt_id", rtBersih\)/);
});

test("Tombol notifikasi tetap menyimpan langganan VAPID dan mendaftar ke OneSignal", async () => {
  const tombol = await baca("components/TombolNotifikasiPush.tsx");
  assert.match(tombol, /daftarkanLanggananOneSignal\(sasaran\)/);
  assert.match(tombol, /existing\.toJSON\(\)/);
  assert.match(tombol, /urlLangganan/);
  assert.match(tombol, /Notification\.permission === "granted"/);
  assert.match(tombol, /disabled=\{status === "menunggu"\}/);
});
