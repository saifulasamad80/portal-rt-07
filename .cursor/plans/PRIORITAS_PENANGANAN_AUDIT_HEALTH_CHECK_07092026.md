# Skala Prioritas Penanganan Temuan Audit Health Check

Tanggal dokumen: 7 September 2026

## 1. Tujuan

Dokumen ini menurunkan temuan pada `AUDIT_HEALTH_CHECK_07092026.md` menjadi urutan penanganan berbasis ITIL.

Aturan utamanya:

- **Incident Ticket** dipakai bila ada gangguan layanan, kebocoran data yang aktif, atau risiko keamanan yang sudah dapat dieksploitasi saat ini.
- **Problem Ticket** dipakai untuk akar masalah, kelemahan kontrol, atau defect yang harus ditutup permanen agar incident tidak berulang.
- Satu temuan dapat menghasilkan **dua tiket**: satu incident untuk containment cepat, satu problem untuk RCA dan perbaikan permanen.

## 2. Prinsip Klasifikasi

### Incident

Incident dibuka bila salah satu kondisi ini terpenuhi:

- data dapat diakses lintas tenant secara aktif
- otorisasi bisa dilewati
- layanan utama terganggu
- ada risiko destruktif yang sudah terbuka di jalur produksi
- hasil audit menunjukkan exposure yang sudah live, bukan hanya potensi

### Problem

Problem dibuka bila salah satu kondisi ini terpenuhi:

- temuan adalah akar dari beberapa incident
- temuan bersifat arsitektural atau kontrol lemah
- temuan belum menimbulkan incident, tetapi berpotensi tinggi
- dibutuhkan RCA, known error, atau tindakan permanen

## 3. Skala Prioritas

### Incident

| Prioritas | Makna | Target |
| --- | --- | --- |
| P1 | Kritikal | Containment hari yang sama, escalasi segera |
| P2 | Tinggi | Ditangani sesegera mungkin pada jam kerja berjalan |
| P3 | Sedang | Dijadwalkan dalam antrian sprint / backlog aktif |
| P4 | Rendah | Perbaikan minor, tidak mengganggu layanan utama |

### Problem

| Prioritas | Makna | Target |
| --- | --- | --- |
| PR1 | Kritikal | RCA dan rencana perbaikan segera |
| PR2 | Tinggi | Ditangani cepat karena berisiko menjadi incident |
| PR3 | Sedang | Masuk backlog perbaikan terjadwal |
| PR4 | Rendah | Peningkatan teknis / housekeeping |

## 4. Urutan Penanganan Utama

Urutan berikut disusun dari risiko paling besar ke paling kecil.

### 4.1 P1 / PR1

Kelompok ini memuat temuan dengan prioritas tertinggi pada salah satu tiketnya. Jika Incident belum P1 tetapi Problem sudah PR1, tetap masuk kelompok ini karena butuh RCA dan kontrol permanen secepatnya.

| ID Audit | Temuan | Tiket Incident | Tiket Problem | Alasan Prioritas |
| --- | --- | --- | --- | --- |
| H1 | Etalase publik tidak mengikat tenant | P1 | PR1 | Kebocoran lintas RT aktif melalui Data API |
| H4 | Storage `dokumen_warga` mengizinkan unggah anonim | P1 | PR1 | Permukaan identitas dan objek berbahaya terbuka |
| M7 | Grant berlebih termasuk TRUNCATE pada tabel sensitif | P1 bila ada jalur SQL role, selain itu PR1 | PR1 | Risiko destruktif sangat tinggi |
| H2 | Policy warisan permissive lebih longgar dari policy baru | P2 bila exposure aktif, selain itu PR1 | PR1 | Kontrol RLS tidak konsisten dan rawan bypass |
| H3 | `warga` bisa update semua kolom baris sendiri | P2 bila ada jalur update dari aplikasi, selain itu PR1 | PR1 | Risiko integritas akun dan PIN |
| H5 | RPC `register_warga_baru` memilih RT dengan `LIMIT 1` | P2 bila RPC aktif dipakai, selain itu PR1 | PR1 | Salah tenant sangat berbahaya jika jalur ini hidup |
| M4 | Landing publik memakai `service_role` dengan disiplin filter yang rapuh | P2 | PR1 | Satu query tanpa filter dapat membocorkan lintas tenant |

### 4.2 P2 / PR2

| ID Audit | Temuan | Tiket Incident | Tiket Problem | Alasan Prioritas |
| --- | --- | --- | --- | --- |
| H6 | Tabel operasional tanpa `rt_id` dan policy pengurus mencakup seluruh baris | P2 | PR2 | Risiko silang-RT saat modul itu mulai terisi |
| M5 | Cron notifikasi global tanpa filter `rt_id` | P2 | PR2 | Dampak operasional lintas tenant bila job berjalan |
| M12 | `hash_password_pengurus` punya `search_path` mutable | P2 bila fungsi dapat dipanggil dalam jalur aktif, selain itu PR2 | PR2 | Risiko hijack fungsi pada kondisi tertentu |
| M9 | Helper RLS `SECURITY DEFINER` callable lewat RPC | P3 | PR2 | Bukan kebocoran langsung, tetapi sensitif bila secret bocor |

### 4.3 P3 / PR3

| ID Audit | Temuan | Tiket Incident | Tiket Problem | Alasan Prioritas |
| --- | --- | --- | --- | --- |
| M1 | Warga tidak punya policy SELECT pada `suara_voting` | P3 | PR3 | Dampak UX, bukan kebocoran data langsung |
| M2 | `kas_rt` SELECT warga mencakup seluruh transaksi RT | P3 | PR3 | Privasi intra-RT, masih ada filter aplikasi |
| M3 | `aksiIzinkanRevisi` tidak atomik | P3 | PR3 | Menimbulkan inkonsistensi status dan kerja manual |
| M6 | Nilai numeric dari PostgREST rawan string/null | P3 | PR3 | Risiko salah hitung dan error tampilan |
| M8 | View `security_invoker` + grant SELECT anon | P3 | PR3 | Umumnya tertahan RLS, tetapi desain agregasi perlu dirapikan |
| M10 | Query webmaster tidak selalu memfilter tenant di aplikasi | P3 | PR3 | Sesuai peran, tetapi rawan salah baca operator |
| H7 | Overload lama `proses_autodebet_kurban` tanpa `rt_id` | P3 | PR2 | Risiko teknis ada, tetapi jalur aktifnya terbatas |

### 4.4 P4 / PR4

| ID Audit | Temuan | Tiket Incident | Tiket Problem | Alasan Prioritas |
| --- | --- | --- | --- | --- |
| M11 | Temuan performa RLS, index, dan duplicate index | Tidak dibuka | PR4 | Peningkatan kapasitas dan efisiensi |
| L1 | File login portal usang di root repo | Tidak dibuka | PR4 | Debt historis, tidak wired ke App Router |
| L2 | `lib/supabase.ts` klien anon browser | Tidak dibuka | PR4 | Risiko muncul hanya jika dipakai ulang |
| L3 | `as any` pada jsPDF | Tidak dibuka | PR4 | Kerapian kode, bukan risiko layanan |
| L4 | Backup 07-09-2026 tertinggal di `public` | Tidak dibuka | PR4 | Housekeeping dan pengurangan noise data |

## 5. Rekomendasi Ticketing per Temuan

### Wajib incident + problem

- **H1** -> Incident P1 + Problem PR1
- **H4** -> Incident P1 + Problem PR1
- **M7** -> Incident P1 bila jalur SQL role ada, jika tidak Problem PR1

### Problem utama, incident bila exposure benar-benar aktif

- **H2** -> Problem PR1
- **H3** -> Problem PR1
- **H5** -> Problem PR1
- **M4** -> Problem PR1
- **H6** -> Problem PR2
- **M5** -> Problem PR2
- **M12** -> Problem PR2
- **H7** -> Problem PR2

### Problem operasional / kualitas layanan

- **M1** -> Problem PR3
- **M2** -> Problem PR3
- **M3** -> Problem PR3
- **M6** -> Problem PR3
- **M8** -> Problem PR3
- **M9** -> Problem PR2
- **M10** -> Problem PR3
- **M11** -> Problem PR4
- **L1-L4** -> Problem PR4

## 6. Aturan Eskalasi

Prioritas harus dinaikkan jika salah satu kondisi berikut muncul:

| Kondisi | Aksi |
| --- | --- |
| Data lintas tenant benar-benar dapat dibaca dari API atau UI | Naikkan ke Incident P1 dan Problem PR1 |
| Ada bukti mutasi data lintas tenant | Naikkan ke Incident P1 |
| Jalur publik memakai `service_role` atau `anon` tanpa filter tenant | Minimal Problem PR1 |
| Temuan melibatkan identitas, dokumen, atau akun warga | Minimal Problem PR1 |
| Temuan memengaruhi banyak modul sekaligus | Naikkan satu tingkat prioritas |
| Workaround tidak tersedia | Naikkan urgency dan buka Problem |

## 7. Alur Penanganan

### Incident

1. Validasi dampak aktif.
2. Buat tiket Incident.
3. Isolasi exposure atau gangguan.
4. Pulihkan layanan paling cepat.
5. Dokumentasikan containment dan pemulihan.
6. Jika akar masalah belum tertutup, buka atau tautkan Problem.

### Problem

1. Kumpulkan bukti dari audit dan incident terkait.
2. Buat tiket Problem.
3. Identifikasi akar masalah dan known error.
4. Susun rencana perbaikan permanen.
5. Validasi fix.
6. Tutup Problem setelah kontrol dan dokumentasi diperbarui.

## 8. Ringkasan Operasional

Jika tim hanya bisa mengerjakan beberapa tiket lebih dulu, urutan praktisnya adalah:

1. H1
2. H4
3. M7
4. M4
5. H2, H3, H5
6. H6, M5, M12, H7
7. M1, M2, M3, M6, M8, M9, M10
8. M11, L1, L2, L3, L4

## 9. Catatan

Dokumen ini tidak mengubah isi audit. Temuan tetap harus diverifikasi ulang saat ticket dibuka, karena status live bisa berubah setelah dokumen audit dibuat.
