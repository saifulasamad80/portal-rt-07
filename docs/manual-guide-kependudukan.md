# Manual Guide Kependudukan

## Portal Warga RT 07/09

Dokumen ini adalah draf panduan singkat penggunaan Portal Warga RT 07/09 melalui perangkat seluler. Gunakan alamat portal yang diberikan oleh pengurus RT untuk membuka aplikasi PWA.

> **Catatan:** Gambar pada panduan ini diambil otomatis dari server pengembangan `http://localhost:3000` menggunakan profil layar mobile. Jika tampilan aplikasi berubah, jalankan kembali `node take-screenshots.js` dari root project untuk memperbarui gambar.

## 1. Beranda publik

Beranda adalah halaman awal yang dapat dibuka tanpa masuk ke akun. Halaman ini menampilkan informasi publik RT, pengumuman, ringkasan kegiatan, serta tautan menuju layanan portal dan kebijakan privasi.

![Beranda utama publik Portal Warga RT 07/09](../public/images/manual-guide/01-beranda.png)

### Cara menggunakan beranda

1. Buka alamat Portal Warga RT 07/09 pada browser ponsel.
2. Baca pengumuman atau informasi publik yang tersedia.
3. Pilih **Masuk Portal** apabila ingin menggunakan layanan warga yang memerlukan akun.
4. Pilih **Daftar** jika belum memiliki akun warga.
5. Gunakan tautan **Kebijakan Privasi** untuk membaca penjelasan pemrosesan data pribadi.

## 2. Masuk ke Portal Warga

Halaman masuk digunakan oleh warga untuk mengakses layanan portal menggunakan NIK dan PIN. Jangan membagikan PIN kepada orang lain, termasuk melalui pesan atau tangkapan layar.

![Halaman Login atau Masuk Portal Warga RT 07/09](../public/images/manual-guide/02-login.png)

### Langkah masuk

1. Isi **Nomor Induk Kependudukan (NIK)** sesuai data yang terdaftar.
2. Isi PIN portal Anda.
3. Gunakan tombol tampilkan/sembunyikan PIN jika diperlukan.
4. Tekan **Masuk Portal**.
5. Jika sistem meminta pembaruan PIN, buat PIN baru yang tidak mudah ditebak dan jangan menggunakan urutan sederhana seperti `123456`.

### Jika belum mempunyai akun

Pilih **Daftar di sini**, kemudian lengkapi data pendaftaran dan persetujuan yang diminta. Pastikan data yang dikirim benar dan baca kebijakan privasi sebelum menyelesaikan pendaftaran.

## 3. Keamanan dan privasi

- Gunakan perangkat pribadi atau pastikan Anda keluar dari akun setelah memakai perangkat bersama.
- Jangan mengirim NIK, PIN, atau data keluarga ke pihak yang tidak berwenang.
- Data yang bersifat sensitif hanya digunakan sesuai layanan dan persetujuan yang diberikan.
- Hubungi pengurus RT jika menemukan data yang tidak sesuai atau mengalami kendala akses.

## 4. Pemutakhiran panduan

Screenshot panduan berada di folder `public/images/manual-guide/`:

- `01-beranda.png` — Beranda utama publik.
- `02-login.png` — Halaman Login / Masuk Portal.

Script pembaruan screenshot: `/take-screenshots.js`.