# Lampiran negatif UAT — jangan jadi isi tutorial

Uji ini **setelah** atau **di sela** episode, kamera boleh mati. Masukkan ke video utama hanya sebagai tips 10 detik. Tujuannya mematahkan alur bahagia, bukan mengajar warga meniru serangan.

Dummy: [UAT_KARTU_DUMMY.md](./UAT_KARTU_DUMMY.md)

| ID | Peran | Langkah | Hasil diharapkan | Hasil | Catatan |
|---|---|---|---|---|---|
| NEG-01 | Tamu | `/register` tanpa `?rt=` atau `?rt=kode-salah` | Halaman "Pendaftaran belum bisa dibuka". Tidak ada insert | | |
| NEG-02 | Warga | Daftar NIK `3174010101858891` (KK-A) kedua kali | Ditolak duplikat, bukan dua akun | | |
| NEG-03 | Warga | NIK 15 digit / huruf | Input menahan non-angka; submit gagal HTML5 | | |
| NEG-04 | Warga | NIK `1234567890123456` atau 16 digit sama (`000...0`) | Ditolak server jika lolos UI | | |
| NEG-05 | Warga | PIN 5 digit | Tidak submit | | |
| NEG-06 | Warga | Login KK-A PIN `000000` | Alert ditolak, tidak masuk portal | | |
| NEG-07 | Warga | Login KK-C (Menunggu) | Pesan antrean pengurus, HTTP 403 | | |
| NEG-08 | Warga | Login sebelum verifikasi KK-A (ulangi di akun baru jika perlu) | Ditolak Menunggu | | |
| NEG-09 | Warga A | Carik: laporkan NIK tidak sesuai | Akun dikunci/sesi putus; **mahal dibersihkan**. Hanya jika Anda siap setujui ulang. Jangan di KK-A utama. | | |
| NEG-10 | Warga B | Setelah kunci, ketik URL `/portal/sampah` | Redirect `/portal/sensus` | | |
| NEG-11 | Pengurus | Iuran wajib Rp 1000 | Alert minimum Rp 5.000, tidak tersimpan | | |
| NEG-12 | Pengurus | Tarik sampah > saldo Budi | Alert saldo tidak cukup | | |
| NEG-13 | Pengurus | Tarik kurban > saldo | Alert tidak cukup | | |
| NEG-14 | Pengurus | Auto-debet kurban > saldo sampah | Ditolak | | |
| NEG-15 | Warga A | Voting kedua kali (sesi masih Aktif) | Unique constraint / "sudah memilih". Bukan dua baris | | |
| NEG-16 | Warga A | Pinjam tenda tanggal yang sama setelah ada booking Disetujui | UI bentrok merah, submit ditahan | | |
| NEG-17 | Warga A | Lapak ke-3 | Alert kuota 2 | | |
| NEG-18 | Warga A | Lapak tanpa foto | Alert wajib foto | | |
| NEG-19 | Warga A | Tiket keluarga kedua saat masih Menunggu | Form ditahan | | |
| NEG-20 | Pengurus | `/admin/lapor` set tiket keluarga ke Selesai lewat dropdown biasa | Pesan: hanya lewat Izinkan Revisi | | |
| NEG-21 | Pengurus | Tolak revisi + alasan `UAT tolak: data sudah sesuai KK` | Tiket Ditolak; Carik KK-A **jangan** diuji ini jika sudah terbuka — pakai tiket baru jika ada | | |
| NEG-22 | Pengurus | Ronda tanggal sama + warga sama (jika diizinkan sistem) | Duplikat ditolak atau dua jadwal — catat perilaku nyata | | |
| NEG-23 | Warga A | Ronda **Izin Berhalangan** tanpa alasan (cancel prompt) | Tidak berubah status | | |
| NEG-24 | Pengurus | Idle 10 menit di `/admin` tanpa mouse/keyboard | Overlay terkunci, sesi hancur, kembali login. **Jangan** di tengah episode video | | |
| NEG-25 | Pengurus | Username benar, sandi salah | Akses ditolak | | |
| NEG-26 | Pengurus | Lupa sandi email acak `uat-tidak-ada@example.com` | Pesan publik **sama** dengan email sah (anti enumerasi) | | |
| NEG-27 | Warga | Buka `/admin` | Form login pengurus, bukan dasbor warga | | |
| NEG-28 | Pengurus | Buka `/portal` | Login warga, bukan Pusat Komando | | |
| NEG-29 | Pengurus | Insert arisan status `Lunas` atau `Menunggu` | Server menolak (`Aktif` / `Tidak Aktif` saja). Temuan jika UI menawarkan opsi itu | | |
| NEG-30 | Pengurus | Form balita/lansia sebagai role RT | Disabled / banner legacy. Pass jika tidak tersimpan | | |
| NEG-31 | Warga A | `/portal/ibu-ibu/balita` | 404 (`notFound`). Pass | | |
| NEG-32 | Warga A | Reset PIN di Buku Induk ke `123456`, login | Wajib ganti PIN baru 6 digit ≠ 123456, baru masuk | | |

## Setelah lampiran

- Kembalikan PIN KK-A ke `246810` atau PIN baru yang Anda catat.
- Jangan biarkan voting UAT **Aktif** di produksi.
- Jangan biarkan sesi admin terbuka di komputer yang direkam.
