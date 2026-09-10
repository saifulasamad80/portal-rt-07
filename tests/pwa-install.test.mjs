import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baca = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Manifest PWA menolak APK terkait dan cukup untuk Chrome/iOS", async () => {
  const manifest = JSON.parse(await baca("public/manifest.json"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.prefer_related_applications, false);
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
  assert.ok(manifest.icons.some((ikon) => ikon.purpose === "maskable"));
  assert.ok(manifest.icons.every((ikon) => !String(ikon.src).endsWith(".apk")));
});

test("Aplikasi tidak menawarkan unduhan APK; pasang lewat peramban", async () => {
  const layout = await baca("app/layout.tsx");
  const ajakan = await baca("components/AjakanPasangAplikasi.tsx");
  const tombol = await baca("components/TombolNotifikasiPush.tsx");
  const sw = await baca("public/sw.js");

  assert.match(layout, /appleWebApp:/);
  assert.match(layout, /capable:\s*true/);
  assert.match(layout, /<AjakanPasangAplikasi \/>/);
  assert.match(layout, /apple-touch-icon\.png/);
  assert.match(ajakan, /beforeinstallprompt/);
  assert.match(ajakan, /Jangan unduh berkas APK/);
  assert.doesNotMatch(ajakan, /href=["'][^"']+\.apk/i);
  assert.match(tombol, /perlu-pasang/);
  assert.doesNotMatch(tombol, /if \(status === "tidak-didukung"\) return null/);
  assert.match(sw, /addEventListener\("fetch"/);
});
