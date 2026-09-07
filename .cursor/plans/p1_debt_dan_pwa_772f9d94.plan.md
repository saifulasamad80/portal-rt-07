---
name: P1 debt dan PWA
overview: Menutup technical debt UUID (chunking `.in()` di admin Kurban + paginasi range Posyandu publik) dan memperbaiki Console Error `<script>` mentah di RootLayout lewat `next/script`, tanpa menyentuh logika umur C8 atau UI layout lain.
todos:
  - id: kurban-chunk-in
    content: Chunk .in(warga_id) per 80 UUID di app/admin/kurban/page.tsx (kurban + sampah, non-webmaster); urutkan hasil kurban setelah gabung
    status: completed
  - id: posyandu-range
    content: Ganti limit(400) kunjungan_balita/lansia di app/page.tsx dengan paginasi .range seperti ambilKasRt (cap 20.000); jangan sentuh C8
    status: completed
  - id: layout-script
    content: Ganti <script> mentah di app/layout.tsx dengan next/script id=pwa-sw strategy=afterInteractive; jangan sentuh UI/logika lain
    status: completed
isProject: false
---

# P1 Debt UUID + Fix Script RootLayout

Dua pekerjaan terpisah. Tidak ada ketergantungan file di antara keduanya.

## A. Chunking `.in()` di admin Kurban

File: [app/admin/kurban/page.tsx](app/admin/kurban/page.tsx)

Masalah: untuk non-webmaster, `queryKurban` dan `querySampah` memakai `.in("warga_id", ids)` sekali tembak (hingga 1000 UUID dari `.limit(1000)`). PostgREST menaruh `.in()` di query string → HTTP 400. Pola yang sudah benar ada di `ambilKurbanRt` ([app/page.tsx](app/page.tsx) baris 156–168) dan `ambilKurbanCakupan` ([app/admin/page.tsx](app/admin/page.tsx) baris 76–83): `UKURAN_KELOMPOK = 80`, loop `slice`, gabung hasil.

Implementasi (hanya di file ini):

- Tambah helper lokal di file yang sama, meniru landing: loop 80 ID, `.in("warga_id", potong)`, gabung baris. Sentinel UUID tetap dipakai jika RT tidak punya warga.
- Webmaster **tidak** memakai `.in()` — biarkan query tanpa allow-list seperti sekarang.
- **Jangan** pasang `.limit(500)` / `.limit(5000)` per potongan. `KurbanClient` menghitung `totalTerkumpul`, `saldoKurbanTerpilih`, dan `saldoSampahTerpilih` dari seluruh array; limit per chunk mendistorsi saldo. Landing juga tidak membatasi baris per chunk.
- Setelah gabung, urutkan `transaksi_kurban` di memori menurut `tanggal_transaksi` menurun agar tabel tetap terbaru-dulu (urutan per-chunk tidak global).
- Path `simpanTransaksiKurban` (RPC, tarikan, insert) **tidak diubah**.

Dampak: modul admin sampah (`app/admin/sampah/page.tsx`) masih unchunked — di luar instruksi, tidak disentuh.

## B. Posyandu publik: hapus `limit(400)`

File: [app/page.tsx](app/page.tsx) baris 220–221.

Satu-satunya `limit(400)` di app: `kunjungan_balita` dan `kunjungan_lansia` di `#kesehatan`. Kalkulasi `balitaBulanIni` / `lansiaBulanIni` / `imunisasiTercatat` terpotong setelah 400 baris.

Ganti dengan helper lokal meniru `ambilKasRt` (baris 172–193):

- `.eq("rt_id", PUBLIC_RT_ID)` wajib di setiap batch
- `.range(dari, dari + 999)` ukuran 1000
- loop sampai batch < 1000 atau `dari >= 20000`
- kolom tetap sama: balita `tanggal_kunjungan, imunisasi`; lansia `tanggal_kunjungan` (tanpa PII)
- panggil helper itu di `Promise.all` yang sekarang memuat kedua query

**Dilarang:** [lib/demografi-publik.ts](lib/demografi-publik.ts), `ambilDemografiSah`, `hitungUmur` / bucket umur C8, `DemografiClient`, dan `limit(200)` admin ibu-ibu.

## C. Console Error `<script>` di RootLayout

File: [app/layout.tsx](app/layout.tsx) baris 57–72.

React 19/Next menolak `<script>` mentah di komponen (overlay di `/admin`). Instruksi JSX yang diketik rusak; yang sah menurut [Next.js Script — Inline Scripts](https://nextjs.org/docs/app/guides/scripts):

1. Tambah `import Script from "next/script";` di atas file (satu-satunya import baru).
2. Ganti **hanya** tag `<script>` mentah dengan:

```tsx
<Script
  id="pwa-sw"
  strategy="afterInteractive"
  dangerouslySetInnerHTML={{
    __html: `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/sw.js').then(
            function(registration) { console.log('PWA Service Worker sukses terdaftar'); },
            function(err) { console.log('PWA Service Worker gagal: ', err); }
          );
        });
      }
    `,
  }}
/>
```

3. Isi registrasi SW **identik**. Wrapper `<head>`, `metadata`, `viewport`, font, `<html>`/`<body>`/`<main>` tidak diubah.

## Verifikasi

- Browser `/admin/kurban` (akun RT, bukan webmaster): daftar/saldo tidak kosong karena HTTP 400.
- Browser `/#kesehatan`: angka Posyandu masih tampil; tidak ada regresi `#demografi`.
- Browser `/admin`: overlay "Encountered a script tag..." hilang; console masih bisa mencatat registrasi SW.
