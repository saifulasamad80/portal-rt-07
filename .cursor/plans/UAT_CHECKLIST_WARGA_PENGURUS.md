# Checklist UAT — Warga & Pengurus RT

Isi kolom **Hasil** dengan `Pass` / `Fail` / `Blocked`. Isi **TS video** menit:detik di file rekaman episode. Temuan: tulis ID + apa yang pecah, jangan menulis "agak aneh".

Naskah: [UAT_NASKAH_VIDEO_WARGA_PENGURUS.md](./UAT_NASKAH_VIDEO_WARGA_PENGURUS.md) · Dummy: [UAT_KARTU_DUMMY.md](./UAT_KARTU_DUMMY.md) · Negatif: [UAT_LAMPIRAN_NEGATIF_WARGA_PENGURUS.md](./UAT_LAMPIRAN_NEGATIF_WARGA_PENGURUS.md)

**Meta uji**

| | Isi saat mulai |
|---|---|
| Tanggal | |
| Lingkungan (staging / produksi) | |
| URL aplikasi | |
| Username ADM-RT | |
| Tautan `/register?rt=` | |
| Browser + viewport | Chrome profil Warga 390px · Pengurus desktop |
| Pelaksana | |

**Rekap episode**

| Episode | Judul | Hasil keseluruhan | TS mulai–selesai |
|---|---|---|---|
| 0 | Mading publik | | |
| 1 | Daftar + verifikasi | | |
| 2 | Carik + kunci | | |
| 3 | Keluarga, surat, tiket | | |
| 4 | Kas, sampah, kurban | | |
| 5 | Inventaris, lapak, ronda, voting | | |
| 6 | Ibu-ibu, jumantik, pengumuman | | |
| 7 | Sesi, Buku Induk, lupa sandi | | |

---

## Episode 0 — Mading publik

| ID | Peran | Langkah | Hasil diharapkan | Hasil | TS | Catatan |
|---|---|---|---|---|---|---|
| PUB-01 | Tamu | Buka `/` tanpa login | Halaman render, tidak redirect ke login | | | |
| PUB-02 | Tamu | Header | Tombol Masuk → `/login`; Panic terlihat | | | |
| PUB-03 | Tamu | `#demografi` | Agregat KK/jiwa/usia/gender/agama. Tidak ada NIK, WA, nama individu di HTML | | | |
| PUB-04 | Tamu | `#lingkungan` | Jumantik (target 151) + sampah agregat | | | |
| PUB-05 | Tamu | `#kesehatan` | Angka kunjungan, tanpa nama anak/ibu/peserta | | | |
| PUB-06 | Tamu | `#kas` | Saldo dan cuplikan pengeluaran | | | |
| PUB-07 | Tamu | `#pengumuman` `#galeri` `#darurat` | Section ada; kosong itu sah | | | |
| PUB-08 | Tamu | Masuk | `/login` portal warga, bukan `/admin` | | | |

---

## Episode 1 — Daftar diri dan verifikasi

| ID | Peran | Langkah | Hasil diharapkan | Hasil | TS | Catatan |
|---|---|---|---|---|---|---|
| REG-01 | Pengurus | Login `/admin` ADM-RT | Dasbor Pusat Komando. Nama pengurus tampil | | | |
| REG-02 | Pengurus | Kartu Akses Pengurus & Log Audit | Terkunci label Webmaster. Jika terbuka = akun salah | | | |
| REG-03 | Pengurus | `/admin/verifikasi` | Kotak tautan rujukan `/register?rt=...` | | | |
| REG-04 | Warga | Buka tautan | Formulir + nama wilayah. Bukan "pendaftaran belum dibuka" | | | |
| REG-05 | Warga | Daftar KK-A lengkap + 2 anggota + foto KK | Redirect `/login` | | | |
| REG-06 | Warga | Daftar KK-B KK menyusul | Sukses | | | |
| REG-07 | Warga | Daftar KK-C KK menyusul | Sukses | | | |
| REG-08 | Pengurus | Refresh verifikasi | Tiga nama UAT, status Menunggu | | | |
| REG-09 | Pengurus | Cek KK Budi | File dummy terbuka, bukan 404 | | | |
| REG-10 | Pengurus | Setujui Budi | Hilang dari antrean | | | |
| REG-11 | Pengurus | Setujui Rina (KK kosong) | Dialog jaminan dokumen. Setelah setuju, masuk Buku Induk | | | |
| REG-12 | Pengurus | Joko tidak disentuh | Tetap Menunggu | | | |
| REG-13 | Pengurus | `/admin/warga` | Budi + Rina sah. Joko tidak ada | | | |
| REG-14 | Warga | Login KK-C | Ditolak (antrean / belum disetujui) | | | |
| REG-15 | Warga | Login KK-A NIK+PIN | `/portal`, nama Budi UAT | | | |

---

## Episode 2 — Carik dan kunci layanan

| ID | Peran | Langkah | Hasil diharapkan | Hasil | TS | Catatan |
|---|---|---|---|---|---|---|
| CRK-01 | Warga A | Dasbor / klik layanan | Arah ke `/portal/sensus` atau kartu terkunci | | | |
| CRK-02 | Warga A | 5 langkah Carik, NIK dikonfirmasi | Simpan sukses, redirect `/portal` | | | |
| CRK-03 | Warga A | Dasbor setelah Carik | Kartu keluarga, surat, kas, voting, inventaris, lapak, sampah, kurban, ibu-ibu, ronda **terbuka** | | | |
| CRK-04 | Warga A | `/portal/sensus` lagi | Redirect `/portal/keluarga` (sudah Disetujui) | | | |
| CRK-05 | Warga A | Tombol push | Izin granted → status aktif; atau "tidak didukung" di HTTP. Bukan error 500 | | | |
| CRK-06 | Warga B | Login Rina, jangan isi Carik | Kartu terkunci | | | |
| CRK-07 | Warga B | Klik `/portal/inventaris` atau keuangan | Redirect `/portal/sensus`, bukan 404/500 | | | |

---

## Episode 3 — Keluarga, surat, tiket

| ID | Peran | Langkah | Hasil diharapkan | Hasil | TS | Catatan |
|---|---|---|---|---|---|---|
| KLG-01 | Warga A | `/portal/keluarga` | 3 jiwa. NIK tersamar | | | |
| SRT-01 | Warga A | `/portal/surat` pilih Domisili + cetak | Preview pengantar: nama, alamat Gang UAT, keperluan. Tanpa field RT/RW ketik manual | | | |
| SRT-02 | Warga A | Tombol cetak tanpa keperluan | Disabled sampai keperluan dipilih | | | |
| TKT-01 | Warga A | Kirim permohonan min. 10 karakter | Tiket Menunggu; form kedua ditahan | | | |
| TKT-02 | Pengurus | `/admin/lapor` | Tiket perubahan keluarga Budi | | | |
| TKT-03 | Pengurus | Status Selesai biasa pada tiket keluarga | Ditolak sistem / tombol Izinkan Revisi yang dipakai | | | |
| TKT-04 | Pengurus | Izinkan Revisi | Cap Carik terbuka; tiket tertutup | | | |
| TKT-05 | Warga A | Refresh portal | Terkunci lagi ke Carik mode revisi | | | |
| TKT-06 | Warga A | Selesai Carik revisi | Portal terbuka; NIK tidak berubah | | | |

---

## Episode 4 — Kas, sampah, kurban

| ID | Peran | Langkah | Hasil diharapkan | Hasil | TS | Catatan |
|---|---|---|---|---|---|---|
| KAS-01 | Pengurus | Iuran wajib Rp 5.000 Budi | Tersimpan, kategori mengandung Iuran Wajib | | | |
| KAS-02 | Pengurus | Iuran wajib Rp 4999 (hanya jika sempat) | Ditolak min. 5.000. Jika tidak diuji di video, isi dari lampiran | | | |
| KAS-03 | Pengurus | Pengeluaran Rp 25.000 UAT | Saldo berkurang | | | |
| KAS-04 | Pengurus | Export PDF | File berisi baris UAT | | | |
| KAS-05 | Warga A | `/portal/keuangan` | Lunas bulan ini; +5.000 di riwayat | | | |
| SMP-01 | Pengurus | Setor 2,5 kg Budi | Saldo warga naik; kas RT +500 | | | |
| SMP-02 | Warga A | `/portal/sampah` | Saldo dan grafik sesuai setor | | | |
| SMP-03 | Warga A | Lapor rak bin kipas hibah | Status menunggu di portal | | | |
| SMP-04 | Pengurus | Lihat rak bin | Baris kipas UAT | | | |
| KRB-01 | Pengurus | Setor tunai 100.000 | Saldo kurban Budi 100.000 | | | |
| KRB-02 | Pengurus | Auto-debet sampah 3.000 | Alert auto-debet; kurban +3.000; sampah −3.000 | | | |
| KRB-03 | Warga A | `/portal/kurban` | Saldo 103.000, dua mutasi | | | |
| KRB-04 | Warga A | `/portal/sampah` setelah debet | Saldo lebih kecil dari SMP-02 | | | |

---

## Episode 5 — Inventaris, lapak, ronda, voting

| ID | Peran | Langkah | Hasil diharapkan | Hasil | TS | Catatan |
|---|---|---|---|---|---|---|
| INV-01 | Pengurus | Tambah Tenda UAT 3x4 ×2 | Muncul master | | | |
| INV-02 | Warga A | Booking 2026-09-20 | Status Menunggu | | | |
| INV-03 | Pengurus | Setujui | Status Disetujui di kedua sisi | | | |
| INV-04 | Pengurus | Dikembalikan | Status Dikembalikan | | | |
| LPK-01 | Warga A | Ajukan Warung UAT Melati + foto | Menunggu | | | |
| LPK-02 | Pengurus | Setujui Layak Tayang | Status Aktif | | | |
| LPK-03 | Warga A | Katalog | Kartu warung + tautan WA | | | |
| RND-01 | Pengurus | Jadwal 2026-09-12 Budi | Tersimpan | | | |
| RND-02 | Warga A | Dasbor Siskamling | Tanggal 12 Sep 2026 | | | |
| RND-03 | Warga A | Siap Hadir | Badge Siap Hadir | | | |
| VOT-01 | Pengurus | Rilis topik UAT 2 opsi | Status Aktif | | | |
| VOT-02 | Warga A | Pilih opsi 1 | Suara tercatat, tidak bisa ubah | | | |
| VOT-03 | Warga A | Refresh | "Anda Sudah Memilih" + pilihan | | | |
| VOT-04 | Pengurus | Hitungan | Opsi 1 ≥ 1 | | | |
| VOT-05 | Pengurus | Tutup sesi | Status Ditutup; portal "belum ada pemilihan aktif" | | | |

Catatan VOT-03: jika UI selalu "belum memilih" padahal insert sukses, itu temuan M1 (policy SELECT suara). Tandai Fail UX, bukan gagal kotak suara.

---

## Episode 6 — Ibu-ibu, jumantik, pengumuman

| ID | Peran | Langkah | Hasil diharapkan | Hasil | TS | Catatan |
|---|---|---|---|---|---|---|
| PGM-01 | Pengurus | Buat pengumuman UAT | Tersimpan | | | |
| PGM-02 | Warga A | Kartu pengumuman dasbor | Judul UAT (jika dalam 3 hari) | | | |
| PGM-03 | Tamu | `/` #pengumuman | Edaran UAT publik | | | |
| JMT-01 | Pengurus | `/admin/ibu-ibu` | Banner: kunjungan legacy ditahan. Form balita/lansia disabled untuk role RT | | | |
| JMT-02 | Pengurus | Jumantik 12 rumah, tanpa DBD/jentik | Tersimpan; `/` persen ≈ 7,9% | | | |
| ARS-01 | Warga A | Daftar arisan Siti UAT | Baris Menunggu | | | |
| ARS-02 | Pengurus | Insert anggota status Aktif + setor 50.000 | Tersimpan (wajib `Aktif`, bukan `Menunggu`/`Lunas`) | | | |
| ARS-03 | Pengurus | Transaksi Setoran 50.000 | Riwayat muncul | | | |
| ARS-04 | Pengurus | Ubah baris Menunggu warga → Aktif | Jika tidak ada aksi: temuan, bukan Fail naskah. Tulis di catatan | | | |

---

## Episode 7 — Sesi dan Buku Induk

| ID | Peran | Langkah | Hasil diharapkan | Hasil | TS | Catatan |
|---|---|---|---|---|---|---|
| BIK-01 | Pengurus | Cari UAT di Buku Induk | Budi, Rina; bukan Joko | | | |
| BIK-02 | Pengurus | Profil Budi | Carik Terverifikasi, NIK terkunci | | | |
| SES-01 | Pengurus | Logout | Form login `/admin` | | | |
| SES-02 | Pengurus | `/admin/lupa-sandi` | Pesan publik netral | | | |
| SES-03 | Pengurus | Email reset (jika SMTP) | Token jalan, sandi baru, login | | | |
| SES-04 | Warga A | Keluar | Sesi warga hilang | | | |

---

## Di luar video (tetap dicentang lingkup)

| ID | Item | Keputusan | Hasil |
|---|---|---|---|
| OUT-01 | `/portal/lapor` kartu kerusakan | Tidak tampil (flag mati). Pass jika tersembunyi | |
| OUT-02 | Unggah KTP saat daftar | Tidak diminta. Pass jika hanya KK | |
| OUT-03 | `/admin/pengurus` `/admin/audit` | Terkunci untuk ADM-RT | |
| OUT-04 | Import massal | Tidak dijalankan di UAT ini | |
| OUT-05 | UAT_PATCH_01 | Dokumen terpisah, bukan seri ini | |

---

## Register temuan

| ID temuan | ID skenario | Keparahan (blokir video / UX / data) | Ringkasan | Tindakan |
|---|---|---|---|---|
| | | | | |

**Selesai UAT fungsional ini hanya jika:** semua baris episode 0–7 yang tidak Blocked bernilai Pass, KK-C masih Menunggu, voting UAT Ditutup, dan data dummy dijadwalkan dibersihkan.
