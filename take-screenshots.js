const { chromium, devices } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.join(__dirname, "public", "images", "manual-guide");
const MOBILE_DEVICE = devices["iPhone 13"];

const PAGES = [
  { path: "/", fileName: "01-beranda.png", label: "Beranda utama publik" },
  { path: "/login", fileName: "02-login.png", label: "Login / Masuk Portal" },
];

async function ambilScreenshot(page, halaman) {
  const url = new URL(halaman.path, BASE_URL).toString();
  const timeout = halaman.path === "/" ? 90_000 : 30_000;
  const response = await page.goto(url, { waitUntil: "commit", timeout });

  if (!response || !response.ok()) {
    throw new Error(`${halaman.label} gagal dibuka (${response?.status() ?? "tanpa respons"}): ${url}`);
  }

  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {
    // Halaman tetap dapat discreenshot bila server menyelesaikan response bertahap.
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {
    // Beranda dapat memiliki request data yang terus berjalan; screenshot tetap aman diambil.
  });
  await page.screenshot({
    path: path.join(OUTPUT_DIR, halaman.fileName),
    fullPage: true,
    animations: "disabled",
  });
  console.log(`✓ ${halaman.label}: ${halaman.fileName}`);
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...MOBILE_DEVICE,
    locale: "id-ID",
    colorScheme: "light",
  });
  const page = await context.newPage();

  try {
    for (const halaman of PAGES) {
      await ambilScreenshot(page, halaman);
    }
  } finally {
    await browser.close();
  }

  console.log(`Screenshot tersimpan di ${path.relative(__dirname, OUTPUT_DIR)}/`);
}

main().catch((error) => {
  console.error("✗ Pengambilan screenshot gagal:", error.message);
  process.exitCode = 1;
});