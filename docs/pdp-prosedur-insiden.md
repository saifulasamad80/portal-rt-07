# Prosedur pemberitahuan insiden data (Pasal 46)

Berlaku sejak go-live 12 September 2026. Target: pemberitahuan ke Menteri dan subjek data dalam 3×24 jam setelah insiden diketahui.

## 1. Apa yang dihitung insiden

Kebocoran, akses tidak sah, kehilangan, atau perubahan data pribadi warga (NIK, KK, WhatsApp, dokumen, kesehatan, keuangan).

## 2. Siapa yang bertindak

- Pengurus RT: kontak pertama subjek data di wilayahnya.
- Operator platform: menahan sistem, memutar log, memutus integrasi (OneSignal/Vercel) bila perlu.

## 3. Langkah

1. Catat waktu diketahui, lingkup (berapa KK, jenis data), dan saluran (storage, PDF, WA, push).
2. Kunci akses yang bocor (cabut sesi, rotasi kunci, matikan ekspor).
3. Dalam 3×24 jam: beritahu subjek yang terdampak (pengumuman portal + WhatsApp pengurus) dan siapkan laporan ke Menteri sesuai format lembaga pengawas.
4. Jangan menulis NIK utuh di pengumuman publik. Pakai jumlah KK dan jenis data.
5. Setelah penahanan: tinjau DPIA, catat di `audit_log` tanpa NIK utuh.

## 4. Bukti

Simpan salinan laporan, waktu notifikasi, dan keputusan teknis di repositori internal operator. Jangan unggah NIK ke tiket publik.
