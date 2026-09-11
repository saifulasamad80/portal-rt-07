# Daftar pemroses dan transfer (Pasal 51–56)

Ini instruksi tertulis ke pemroses. Bukan pengganti DPA bertanda tangan. Tanda tangan vendor harus menyusul setelah go-live.

| Pemroses | Peran | Wilayah yang diketahui | Data yang diterima | Dasar |
| --- | --- | --- | --- | --- |
| Supabase | Basis data, storage, RLS | Singapore (`ap-southeast-1` pada proyek Database-RT-07) | Buku induk, dokumen KK, log | Klausul pemroses + notice di Kebijakan Privasi |
| Vercel | Hosting aplikasi Next.js | Bisa di luar Indonesia (CDN/edge) | Request HTTP, cookie sesi terenkripsi | Notice risiko lintas negara |
| OneSignal | Push notification | Amerika Serikat | Alias akun, token perangkat, isi notifikasi — bukan NIK | Consent terpisah saat warga menekan izinkan notifikasi |

Instruksi pemroses: proses hanya untuk portal RT ini; jangan jual data; sub-pemroses wajib setara; hapus atau kembalikan data setelah kontrak selesai; bantu hak subjek dan insiden 3×24 jam.

Cadangan: jadwal harian/mingguan/tahunan. Setelah hapus sah di sistem operasional, cadangan tidak boleh dipakai untuk menghidupkan data kecuali kewajiban hukum. Permintaan hapus di cadangan diajukan operator hosting.
