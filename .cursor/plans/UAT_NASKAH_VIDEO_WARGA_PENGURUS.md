# Naskah video UAT — Warga & Pengurus RT

Baca ini sambil merekam. Data ketik ada di [UAT_KARTU_DUMMY.md](./UAT_KARTU_DUMMY.md). Centang hasil di [UAT_CHECKLIST_WARGA_PENGURUS.md](./UAT_CHECKLIST_WARGA_PENGURUS.md). Kasus gagal ada di [UAT_LAMPIRAN_NEGATIF_WARGA_PENGURUS.md](./UAT_LAMPIRAN_NEGATIF_WARGA_PENGURUS.md) — jangan masukkan ke naskah tutorial kecuali 10 detik tips.

**Aktor di kamera:** Warga (KK-A, sesekali KK-B/KK-C) dan Pengurus RT. Anda operator di belakang, **bukan** login webmaster.

**Dua jendela:** kiri Warga 390×844, kanan Pengurus desktop. Cookie terpisah (dua profil Chrome).

**Jeda rekaman:** sesi admin mati setelah **10 menit idle**. Jangan pause di tengah modul admin.

---

## Pra-rekam (kamera mati)

1. Staging, bukan produksi. Jika produksi: semua judul berawalan `UAT:`.
2. Buat ADM-RT (`level = rt`) lewat webmaster `/admin/pengurus`. Logout webmaster.
3. Siapkan `kk-dummy-uat.jpg` dan `lapak-dummy-uat.jpg`.
4. Login ADM-RT di profil Pengurus. Buka `/admin/verifikasi`. Salin tautan rujukan ke notepad.
5. Pastikan NIK dummy belum ada di Buku Induk (cari `3174010101858891`). Jika tabrakan, ganti 4 digit terakhir dan catat di checklist.
6. Fitur yang **tidak** direkam sebagai tutorial: kartu Lapor di portal (`FITUR_LAPOR_AKTIF = false`), unggah KTP (`FITUR_KTP_AKTIF = false`), `/admin/pengurus`, `/admin/audit`, kunjungan posyandu (hanya webmaster).

---

## Episode 0 — Mading publik (4–6 menit)

**URL:** `/` · **Aktor:** tamu, belum login · **Viewport:** mobile lalu satu cuplikan desktop

**Narasi:** "Ini halaman yang dilihat warga tanpa akun. Transparan: orang, kas, kesehatan, pengumuman."

| No | Langkah | Yang harus terlihat |
|---|---|---|
| 0.1 | Buka `/` tanpa cookie | Header Portal Warga, tombol **Masuk**, **Panic** |
| 0.2 | Gulir `#demografi` | Kartu jumlah KK/jiwa, kategori usia, gender, agama — tanpa NIK/nama individu |
| 0.3 | `#lingkungan` | Progress Jumantik (target 151 rumah), kinerja sampah jika ada |
| 0.4 | `#kesehatan` | Angka kunjungan posyandu agregat, **bukan** nama anak/peserta |
| 0.5 | `#kas` | Saldo kas, cuplikan pengeluaran |
| 0.6 | `#pengumuman` | Daftar edaran; jika kosong, sah |
| 0.7 | `#galeri` dan dokumen publik | Galeri / PDF jika ada |
| 0.8 | `#darurat` | Panic / kontak darurat |
| 0.9 | Klik **Masuk** | Tiba di `/login` Portal Warga, bukan `/admin` |
| 0.10 | Kembali `/`, tunjuk tautan admin jika ada di footer/hero | `/admin` terpisah dari portal warga |

**Cut.** Jangan isi formulir di episode ini.

---

## Episode 1 — Daftar diri dan verifikasi (12–18 menit)

**Urutan kamera:** Pengurus (tautan) → Warga (tiga kali daftar) → Pengurus (setujui) → Warga (login gagal KK-C, login KK-A).

### 1A. Pengurus mengambil tautan

| No | Langkah | Data / hasil |
|---|---|---|
| 1.1 | `/admin` | Username + sandi ADM-RT. Dasbor **Pusat Komando**. Kartu **Akses Pengurus** dan **Log Audit** harus **terkunci Webmaster** — jika terbuka, Anda salah akun. |
| 1.2 | Kartu **Verifikasi Pendaftaran** | `/admin/verifikasi` |
| 1.3 | Salin **Tautan rujukan publik** | Tempel ke jendela Warga |

**Narasi:** "Warga tidak mendaftar dari Google sembarangan. Mereka pakai tautan RT."

### 1B. Warga daftar KK-A (lengkap)

| No | Langkah | Isi |
|---|---|---|
| 1.4 | Buka tautan rujukan | Formulir terbuka, nama wilayah tampil. Jika "Pendaftaran belum bisa dibuka", stop — kode `?rt=` salah. |
| 1.5 | Kepala keluarga | lihat kartu dummy KK-A |
| 1.6 | Ekonomi | Pendapatan `3 - 5 Juta`, listrik `1300 VA` |
| 1.7 | Dokumen | **Jangan** centang menyusul. Unggah `kk-dummy-uat.jpg` |
| 1.8 | **+ Tambah Warga** dua kali | Istri lalu Anak sesuai kartu |
| 1.9 | **SUBMIT DATA SENSUS & LAPOR DIRI** | Redirect `/login`. Pesan sukses. |

**Narasi:** "Data belum sah. Masih antrean pengurus."

### 1C. Daftar KK-B dan KK-C (lebih cepat)

Ulangi formulir. KK-B: tanpa anggota, **KK Menyusul**. KK-C: tanpa anggota, **KK Menyusul**. Submit keduanya.

### 1D. Pengurus memverifikasi

| No | Langkah | Hasil |
|---|---|---|
| 1.10 | Refresh `/admin/verifikasi` | Tiga baris: Budi, Rina, Joko |
| 1.11 | Budi: **Cek KK** | Gambar dummy terbuka di tab baru |
| 1.12 | Budi: **Setujui** → konfirmasi | Hilang dari antrean |
| 1.13 | Rina: **Setujui** | Dialog dokumen kosong muncul karena KK menyusul. Setujui. |
| 1.14 | Joko: **jangan** setujui | Tetap Menunggu |
| 1.15 | `/admin/warga` | Budi dan Rina di Buku Induk. Joko **tidak**. |

### 1E. Login warga

| No | Langkah | Hasil |
|---|---|---|
| 1.16 | `/login` NIK KK-C + PIN `112233` | Ditolak: masih antrean / belum disetujui |
| 1.17 | NIK KK-A + PIN `246810` | Masuk `/portal` |

**Narasi:** "Akun sah belum berarti semua layanan terbuka. Ada satu langkah lagi: Carik."

**Cut.**

---

## Episode 2 — Carik dan kunci layanan (8–12 menit)

Fakta kode: layout `portal/(terkunci)` mengalihkan ke `/portal/sensus` sampai `status_validasi = Disetujui`. Setelah warga menyelesaikan Carik mandiri, cap langsung **Disetujui** — pengurus tidak perlu mencap ulang untuk membuka layanan.

### 2A. KK-A mengisi Carik

| No | Langkah | Isi / hasil |
|---|---|---|
| 2.1 | Di dasbor KK-A | Kartu layanan terkunci atau klik kartu → `/portal/sensus` |
| 2.2 | Langkah Identitas NIK | Centang konfirmasi NIK. **Jangan** pilih NIK tidak sesuai (itu mengunci akun). |
| 2.3 | Biodata | Terisi dari daftar. Periksa alamat `Gang UAT Melati No. 7`. Lanjut. |
| 2.4 | Keluarga | Siti dan Andi tampil. NIK terkunci. Lanjut. |
| 2.5 | Ekonomi | `3 - 5 Juta`, `1300 VA`. Lanjut. |
| 2.6 | Pernyataan | Catatan: `UAT verifikasi mandiri KK Budi`. Centang kedua pernyataan. Kirim. |
| 2.7 | Kembali `/portal` | Kartu **tidak** terkunci: keluarga, surat, kas, voting, inventaris, lapak, sampah, kurban, ibu-ibu, ronda. |
| 2.8 | Opsional: bel tombol notifikasi push | Izinkan. Jika HTTP/localhost tidak didukung, sebutkan dan lanjut. |

### 2B. KK-B menunjukkan kunci (logout KK-A dulu, atau profil kedua)

| No | Langkah | Hasil |
|---|---|---|
| 2.9 | Login KK-B `3174021502928894` / `135790` | Dasbor, kartu layanan terkunci |
| 2.10 | Klik **Transparansi kas** atau **Inventaris** | Dialihkan ke `/portal/sensus`, bukan error |
| 2.11 | Logout KK-B. Jangan selesaikan Carik. | KK-B tetap terkunci sampai akhir UAT |

**Narasi:** "Ini bukan bug. Pengurus sudah menyetujui akun; warga belum mengunci data keluarga."

**Cut.**

---

## Episode 3 — Keluarga, surat, tiket perubahan (8–12 menit)

Login KK-A. Viewport mobile.

### 3A. Data keluarga

| No | Langkah | Hasil |
|---|---|---|
| 3.1 | `/portal/keluarga` | Kepala + Siti + Andi. NIK tersamar (bukan 16 digit utuh di layar). |
| 3.2 | Tunjuk bahwa NIK tidak bisa diedit | Sesuai desain |

### 3B. Surat pengantar mandiri

| No | Langkah | Isi |
|---|---|---|
| 3.3 | `/portal/surat` | Baca info: KTP/KK standar tidak butuh pengantar RT |
| 3.4 | Agama Islam, pendidikan SLTA, Kawin, WNI | |
| 3.5 | Keperluan **Domisili Tempat Tinggal** | Detail: `UAT pengantar dummy, tidak dibawa ke kelurahan` |
| 3.6 | **Cetak Kertas Pengantar** | Dialog print browser. Nama Budi, alamat tanpa ketik RT/RW manual. **Jangan simpan PDF ke folder warga sungguhan.** Batal print jika perlu. |

### 3C. Permohonan ubah data → pengurus

| No | Langkah | Isi / hasil |
|---|---|---|
| 3.7 | `/portal/keluarga` → uraian | `UAT: ejaan nama anak Andi perlu dicek, tanpa ubah NIK.` (min. 10 karakter) |
| 3.8 | **Kirim permohonan** | Status Menunggu. Form kedua ditahan. |
| 3.9 | Pengurus: `/admin/lapor` | Tiket **Permohonan perubahan data keluarga** milik Budi |
| 3.10 | **Izinkan Revisi** | Konfirmasi. Pesan: warga boleh isi ulang Carik, NIK terkunci. |
| 3.11 | Warga refresh `/portal` | Layanan terkunci lagi; `/portal/sensus` mode revisi |
| 3.12 | Warga selesaikan Carik sekali lagi (data sama, catatan `UAT revisi ejaan Andi tetap`) | Portal terbuka kembali |

Jangan pilih **Tolak** di naskah ini (ada di lampiran negatif).

**Cut.**

---

## Episode 4 — Kas, sampah, kurban (12–16 menit)

Pengurus mencatat dulu, warga melihat. Prefix `UAT` di setiap keterangan.

### 4A. Kas

| No | Langkah | Isi |
|---|---|---|
| 4.1 | `/admin/kas` | Form Catat Transaksi |
| 4.2 | Pemasukan | Warga **Budi UAT Santoso**, **Iuran Wajib**, Rp `5000` (minimum), ket. `UAT iuran September 2026` |
| 4.3 | **Simpan Transaksi** | Buku besar + Rp 5.000. Radar tunggakan: Budi tidak muncul sebagai nunggak bulan ini. |
| 4.4 | Pengeluaran | Kategori `UAT perbaikan lampu gang`, Rp `25000`, ket. `Nota dummy UAT` |
| 4.5 | Kartu saldo | Pemasukan − pengeluaran berubah |
| 4.6 | **Export PDF** (desktop) | File unduhan. Buka, pastikan baris UAT ada. |
| 4.7 | Warga `/portal/keuangan` | Status lunas bulan ini, riwayat +5.000 |

### 4B. Bank sampah

| No | Langkah | Isi |
|---|---|---|
| 4.8 | `/admin/sampah` | Nasabah Budi UAT, jenis **Setor** |
| 4.9 | Keterangan `UAT kardus dan botol` | Harga/kg `2000`, berat `2.5` → hak warga terisi (cek angka di form) |
| 4.10 | Kas RT `500` | Simpan. Alert sukses. |
| 4.11 | Warga `/portal/sampah` | Saldo > 0, grafik, riwayat setor |
| 4.12 | Tab Rak Bin → form | Nama `Kipas angin UAT`, Elektronik, **Hibah ke RT**, kondisi `Mati total, dummy UAT`, centang pernyataan, submit |
| 4.13 | Pengurus refresh sampah, blok Rak Bin | Baris kipas, status menunggu |

Jangan tarik saldo melebihi hak warga (kasus gagal di lampiran).

### 4C. Kurban

| No | Langkah | Isi |
|---|---|---|
| 4.14 | `/admin/kurban` | Pilih Budi. Form menampilkan **Saldo Sampah** |
| 4.15 | Setoran tunai | `Setoran (+)`, `Tunai`, Rp `100000`, `UAT cicilan 1 sapi` |
| 4.16 | Setoran dari sampah | `Setoran (+)`, **Tabungan Sampah**, Rp `3000` (≤ saldo). Alert auto-debet. |
| 4.17 | Warga `/portal/kurban` | Saldo ≈ 103.000, dua baris mutasi |
| 4.18 | Warga `/portal/sampah` | Saldo berkurang 3.000 |

**Cut.** Tutup voting/kas dummy dari mading jika produksi (lihat pembersihan di akhir dokumen).

---

## Episode 5 — Inventaris, lapak, ronda, voting (14–18 menit)

Silang peran. Objek pengurus dulu.

### 5A. Inventaris

| No | Langkah | Isi |
|---|---|---|
| 5.1 | Pengurus `/admin/inventaris` | Nama `Tenda UAT 3x4`, unit `2`, deskripsi sesuai kartu. Simpan. |
| 5.2 | Warga `/portal/inventaris` | Tenda di dropdown |
| 5.3 | Pinjam tanggal `2026-09-20`, ket. `UAT syukuran keluarga Budi` | Alert menunggu RT |
| 5.4 | Pengurus antrean pinjam | **Setujui** |
| 5.5 | Warga riwayat | Status **Disetujui** |
| 5.6 | Pengurus | **Dikembalikan** setelah tunjuk tombol (simulasi selesai pakai) |

### 5B. Lapak

| No | Langkah | Isi |
|---|---|---|
| 5.7 | Warga `/portal/lapak` → tab **Lapak Saya** | Nama `Warung UAT Melati`, kategori **Makanan & Minuman** (bukan Jasa — Jasa membuka alur teknisi yang panjang) |
| 5.8 | Deskripsi + WA + foto dummy | Submit. "Menunggu persetujuan" |
| 5.9 | Pengurus `/admin/lapak` | **Setujui Layak Tayang** |
| 5.10 | Warga tab **Katalog** | Kartu warung tampil. Tombol Hubungi Penjual = wa.me (tidak perlu kirim chat sungguhan) |

Kuota lapak = 2 per warga. Jangan buat yang ketiga.

### 5C. Ronda

| No | Langkah | Isi |
|---|---|---|
| 5.11 | Pengurus `/admin/ronda` | Tanggal `2026-09-12`, petugas Budi UAT. Simpan. |
| 5.12 | Warga `/portal` kartu Siskamling | Tanggal tugas tampil |
| 5.13 | `/portal/ronda` | **Siap Hadir** (bukan izin). Alert sukses. Badge **Siap Hadir**. |

### 5D. Voting

| No | Langkah | Isi |
|---|---|---|
| 5.14 | Pengurus `/admin/voting` | Judul `UAT: Cat pos ronda perlu dicat ulang?`, deskripsi `Pemilihan dummy UAT. Bukan keputusan resmi.`, opsi `Ya, cat ulang` / `Belum perlu`. **Rilis ke Portal**. Status **Aktif**. |
| 5.15 | Warga `/portal/voting` | Dua opsi. Pilih **Ya, cat ulang**. Konfirmasi. Suara tidak bisa diubah. |
| 5.16 | Refresh voting | "Anda Sudah Memilih" |
| 5.17 | Pengurus lihat hitungan | Suara opsi 1 bertambah |
| 5.18 | **Tutup Sesi Voting** sebelum cut jika mading publik menampilkan voting aktif | Status **Ditutup**. Warga melihat "Belum Ada Pemilihan Aktif" |

**Cut.**

---

## Episode 6 — Ibu-ibu, jumantik, pengumuman (8–12 menit)

### 6A. Pengumuman

| No | Langkah | Isi |
|---|---|---|
| 6.1 | Pengurus `/admin/pengumuman` | Judul `UAT: Kerja bakti Gang Melati`, isi sesuai kartu. Link GDrive **kosongkan**. Simpan. |
| 6.2 | Warga `/portal` kartu Pengumuman | Judul UAT (jendela 3 hari). Tautan "Buka mading RT" → `/` |
| 6.3 | Tamu `/` `#pengumuman` | Edaran UAT tampil publik |

### 6B. Jumantik (pengurus, di `/admin/ibu-ibu`)

| No | Langkah | Isi |
|---|---|---|
| 6.4 | `/admin/ibu-ibu` | Banner kuning: kunjungan balita/lansia ditahan untuk admin RT. **Jangan** paksa isi form balita/lansia — tombol disabled, itu benar. |
| 6.5 | Modul Jumantik | Rumah `12`. DBD tidak. Jentik tidak. Simpan. |
| 6.6 | Tamu `/` `#lingkungan` | Persentase ≈ 12/151. Status aman (bukan modal darurat) |

Jika tidak sengaja centang DBD/jentik, modal darurat muncul — uncentang dan simpan ulang, atau catat di checklist.

### 6C. Arisan

| No | Langkah | Isi |
|---|---|---|
| 6.7 | Warga `/portal/ibu-ibu` | Kartu anggota & total setoran. Hub hanya **Arisan** (posyandu individu tidak untuk warga). |
| 6.8 | `/portal/ibu-ibu/arisan` daftar | Nama `Siti UAT Rahmawati`, WA `081299900001`. Status **Menunggu**. |
| 6.9 | Pengurus tab **Arisan** | Form anggota baru: nama sama, status **Aktif** (bukan Menunggu — server hanya menerima `Aktif` / `Tidak Aktif` pada insert pengurus), setoran `50000`. Simpan. |
| 6.10 | Catat transaksi | Pilih anggota Aktif, jenis **Setoran**, Rp `50000`, `UAT setoran September`. |

Jika baris **Menunggu** dari warga tidak bisa diubah jadi Aktif, itu temuan — catat di checklist, lanjut dengan anggota yang Anda buat berstatus Aktif.

**Cut.**

---

## Episode 7 — Sesi pengurus, Buku Induk, lupa sandi (6–10 menit)

Jangan diam 10 menit di kamera. Idle lock diuji di lampiran negatif.

| No | Langkah | Hasil |
|---|---|---|
| 7.1 | `/admin/warga` cari `UAT` | Budi dan Rina. Joko tidak. |
| 7.2 | Buka profil Budi `/admin/warga/{id}` | Akun Disetujui, Carik Terverifikasi. NIK terkunci. |
| 7.3 | Tunjuk **Reset PIN** tanpa menekan di naskah utama | Jelaskan: reset ke `123456`, warga wajib ganti di login berikutnya. Eksekusi ada di lampiran. |
| 7.4 | Logout pengurus | Kembali form login `/admin` |
| 7.5 | Tautan lupa sandi `/admin/lupa-sandi` | Isi email ADM-RT. Pesan publik selalu sama (tidak membocorkan apakah email terdaftar). |
| 7.6 | Jika SMTP hidup | Buka email, tautan `/admin/reset-sandi?token=...`, set sandi baru, login ulang. Kembalikan sandi uji jika perlu. |
| 7.7 | Jika SMTP tidak dikonfigurasi | Checklist = Blocked, bukan Fail aplikasi UI. Jangan tebak pesan server. |
| 7.8 | Login warga KK-A, **Keluar** | Cookie hilang, `/` atau `/login`. |

**Narasi penutup:** "Warga memakai NIK dan PIN. Pengurus memakai username. Webmaster tidak dipakai ketua RT sehari-hari."

**Cut. Selesai seri.**

---

## Pembersihan setelah UAT (kamera mati)

Hapus atau arsipkan semua baris berlabel UAT:

- Warga KK-A/B/C (KK-C masih Menunggu di verifikasi — Tolak atau biarkan sesuai kebijakan)
- Transaksi kas, sampah, kurban, arisan
- Pengumuman, voting, inventaris tenda, peminjaman, lapak, jadwal ronda, rak bin, laporan jumantik uji
- File storage KK/lapak dummy

Jangan hapus warga produksi. Filter nama `UAT`.

---

## Yang sengaja tidak ada di naskah ini

| Item | Alasan |
|---|---|
| `/portal/lapor` kerusakan fasilitas | Flag mati |
| Unggah KTP daftar | Flag mati |
| Kunjungan balita/lansia admin | Hanya webmaster + `LEGACY_POSYANDU_RT_ID` |
| `/admin/pengurus`, `/admin/audit` | Webmaster |
| Import massal Buku Induk | Berbahaya di produksi; PIN default `123456` |
| UAT_PATCH_01 (chunk 80 UUID, demografi C8) | Uji teknis terpisah |
