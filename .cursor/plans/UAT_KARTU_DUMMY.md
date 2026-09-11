# Kartu dummy UAT — cetak dan taruh di meja rekaman

Semua NIK, nama, dan alamat di bawah **palsu**. Jangan pakai NIK/KTP warga sungguhan. Prefix `UAT` wajib di setiap nama dan judul agar data uji mudah dibersihkan.

**Lingkungan:** staging. Jika terpaksa produksi, bersihkan semua baris berlabel UAT setelah rekaman.

## Akun pengurus (ADM-RT)

| Field | Nilai |
|---|---|
| Peran | Pengurus RT (`level = rt`), **bukan** webmaster |
| Username | `[isi username akun uji pengurus RT]` |
| Password | `[isi sandi akun uji]` |
| Email (untuk lupa sandi) | `[isi email yang Anda kendalikan]` |
| URL login | `/admin` |

Buat akun ini **sebelum rekaman**, lewat webmaster → `/admin/pengurus`. Jangan rekam langkah webmaster itu sebagai tutorial pengurus.

## Tautan daftar diri

Salin dari `/admin/verifikasi` → kotak **Tautan rujukan publik**. Bentuknya `/register?rt=KODE`. Tanpa `?rt=` yang sah, formulir tertutup.

## KK-A — alur bahagia (rekam hampir semua layanan portal)

| Field | Kepala KK | Anggota 1 (Istri) | Anggota 2 (Anak) |
|---|---|---|---|
| Nama | Budi UAT Santoso | Siti UAT Rahmawati | Andi UAT Santoso |
| NIK | `3174010101858891` | `3174014101858892` | `3174010105158893` |
| Tempat lahir | Jakarta | Jakarta | Jakarta |
| Tanggal lahir | `1985-01-01` | `1985-01-01` | `2015-05-01` |
| Gender | Laki-laki | Perempuan | Laki-laki |
| Agama | Islam | Islam | Islam |
| Hubungan | — | Istri | Anak |
| Pekerjaan | Wiraswasta | Ibu Rumah Tangga | Pelajar |
| WhatsApp | `081299900001` | — | — |
| PIN portal | `246810` | — | — |
| Status tinggal | Warga Tetap | — | — |
| Alamat | Gang UAT Melati No. 7 | — | — |
| Pendapatan | `3 - 5 Juta` | — | — |
| Daya listrik | `1300 VA` | — | — |
| Dokumen | Unggah `kk-dummy-uat.jpg` (bukan KK sungguhan) | — | — |

## KK-B — layanan terkunci (jangan isi Carik)

| Field | Nilai |
|---|---|
| Nama | Rina UAT Wulandari |
| NIK | `3174021502928894` |
| Tempat / tgl lahir | Bandung / `1992-02-15` |
| Gender / Agama | Perempuan / Islam |
| Pekerjaan | Karyawan Swasta |
| WhatsApp | `081299900002` |
| PIN | `135790` |
| Status tinggal | Penyewa Kontrakan |
| Alamat | Kontrakan UAT Flamboyan No. 3 |
| Pendapatan | `1 - 3 Juta` |
| Daya listrik | `900 VA (Non-Subsidi)` |
| Anggota | tidak ditambah |
| Dokumen | centang **KK Menyusul / Fisik** |
| Setelah disetujui | **Jangan** isi Carik |

## KK-C — antrean verifikasi (jangan disetujui)

| Field | Nilai |
|---|---|
| Nama | Joko UAT Pratama |
| NIK | `3174032003888895` |
| Tempat / tgl lahir | Bekasi / `1988-03-20` |
| Gender / Agama | Laki-laki / Islam |
| Pekerjaan | Supir |
| WhatsApp | `081299900003` |
| PIN | `112233` |
| Status tinggal | Penyewa Kos |
| Alamat | Kos UAT Melati Kamar 05, Gang UAT Melati No. 9 |
| Pendapatan | `< 1 Juta` |
| Daya listrik | `450 VA (Subsidi)` |
| Anggota | tidak ditambah |
| Dokumen | KK Menyusul |
| Status akhir UAT | tetap **Menunggu** |

## Isian modul (KK-A)

| Modul | Nilai ketik |
|---|---|
| Pengumuman judul | `UAT: Kerja bakti Gang Melati` |
| Pengumuman isi | `Sabtu 12 September 2026 pukul 07.00. Bawa sapu dan karung. Titik kumpul pos ronda.` |
| Kas pemasukan | Tipe `Pemasukan`, warga Budi UAT, `Iuran Wajib`, Rp `5000`, ket. `UAT iuran September 2026` |
| Kas pengeluaran | Tipe `Pengeluaran`, kategori `UAT perbaikan lampu gang`, Rp `25000`, ket. `Nota dummy UAT` |
| Sampah setor | Budi UAT, `Setor`, ket. `UAT kardus dan botol`, harga/kg `2000`, berat `2.5`, hak warga otomatis, kas RT `500` |
| Kurban setor tunai | Budi UAT, `Setoran (+)`, sumber `Tunai`, Rp `100000`, ket. `UAT cicilan 1 sapi` |
| Kurban dari sampah | `Setoran (+)`, sumber `Tabungan Sampah`, Rp `3000` (harus ≤ saldo sampah) |
| Inventaris master | Nama `Tenda UAT 3x4`, unit `2`, deskripsi `Tenda uji UAT jangan dipinjam hajatan nyata` |
| Pinjam tenda | Tanggal `2026-09-20`, ket. `UAT syukuran keluarga Budi` |
| Lapak | Nama `Warung UAT Melati`, kategori `Makanan & Minuman`, deskripsi `Nasi uduk dummy UAT`, WA `081299900001`, foto `lapak-dummy-uat.jpg` |
| Voting judul | `UAT: Cat pos ronda perlu dicat ulang?` |
| Voting opsi | `Ya, cat ulang` / `Belum perlu` |
| Ronda | Tanggal `2026-09-12`, petugas Budi UAT Santoso |
| Surat keperluan | `Domisili Tempat Tinggal` |
| Surat ket. | `UAT pengantar dummy, tidak dibawa ke kelurahan` |
| Surat pendidikan | `SLTA` · kawin `Kawin` · WNI |
| Tiket keluarga | `UAT: ejaan nama anak Andi perlu dicek, tanpa ubah NIK.` |
| Arisan (pengurus) | Nama `Siti UAT Rahmawati`, WA `081299900001`, status `Aktif`, setoran `50000` |
| Arisan transaksi | jenis `Setoran`, Rp `50000`, catatan `UAT setoran September` |
| Arisan (warga daftar) | Nama `Siti UAT Rahmawati`, WA `081299900001` |
| Jumantik | Rumah diperiksa `12` (target UI = 151), DBD **tidak**, jentik **tidak** |
| Rak bin | Nama `Kipas angin UAT`, kategori `Elektronik`, opsi `Hibah ke RT`, kondisi `Mati total, dummy UAT` |

## File lampiran yang disiapkan sebelum rekam

1. `kk-dummy-uat.jpg` — foto KK palsu / kertas bertuliskan "KK DUMMY UAT" (JPEG/PNG/WebP, < 5 MB)
2. `lapak-dummy-uat.jpg` — foto produk palsu untuk lapak
3. Dua profil Chrome: **UAT-Warga** (390 px) dan **UAT-Pengurus** (desktop)
