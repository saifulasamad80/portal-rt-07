# Dokumen Prioritas Tiket Incident dan Problem Berbasis ITIL

Tanggal dokumen: 7 September 2026

## 1. Tujuan

Dokumen ini menetapkan urutan prioritas tiket Incident dan Problem agar penanganan layanan TI berjalan konsisten, terukur, dan selaras dengan praktik ITIL.

Prioritas digunakan untuk menentukan tiket mana yang harus ditangani lebih dahulu ketika kapasitas tim terbatas. Prioritas tidak hanya ditentukan oleh tingkat teknis kerusakan, tetapi oleh kombinasi dampak bisnis, urgensi waktu, risiko, dan ketersediaan workaround.

## 2. Prinsip ITIL yang Digunakan

Dalam ITIL, Incident Management berfokus pada pemulihan layanan secepat mungkin agar dampak terhadap pengguna dan bisnis berkurang.

Problem Management berfokus pada identifikasi penyebab aktual atau potensial dari satu atau lebih incident, pengelolaan workaround, known error, dan tindakan permanen untuk mencegah kejadian berulang.

Prioritas tiket ditentukan terutama dari dua faktor:

| Faktor | Penjelasan |
| --- | --- |
| Impact | Besarnya dampak terhadap layanan, pengguna, proses bisnis, keamanan, kepatuhan, atau reputasi. |
| Urgency | Seberapa cepat tiket harus ditangani sebelum dampak menjadi signifikan atau memburuk. |

Untuk tiket Problem, urgency juga mempertimbangkan kemungkinan incident berulang, tren incident, risiko eskalasi, dan ada atau tidaknya workaround.

## 3. Skala Impact

| Kode | Tingkat | Kriteria |
| --- | --- | --- |
| I1 | Sangat Tinggi | Layanan utama berhenti total, banyak pengguna terdampak, risiko keamanan/kepatuhan serius, atau proses bisnis kritikal tidak dapat berjalan. |
| I2 | Tinggi | Fungsi penting terganggu, sebagian besar pengguna terdampak, operasional berjalan dengan hambatan besar, atau ada risiko kehilangan data terbatas. |
| I3 | Sedang | Sebagian pengguna atau satu modul terdampak, layanan masih berjalan dengan keterbatasan, atau tersedia alternatif sementara. |
| I4 | Rendah | Dampak lokal pada satu pengguna/fungsi kecil, tidak mengganggu proses utama, atau hanya isu kosmetik minor. |

## 4. Skala Urgency

| Kode | Tingkat | Kriteria Incident | Kriteria Problem |
| --- | --- | --- | --- |
| U1 | Mendesak | Harus dipulihkan segera karena layanan kritikal berhenti atau dampak sedang meluas. | Kemungkinan berulang sangat tinggi, tidak ada workaround, atau risiko memicu incident besar dalam waktu dekat. |
| U2 | Tinggi | Perlu ditangani cepat karena menghambat operasional penting. | Incident berulang sudah terjadi, workaround lemah, atau risiko memburuk cukup tinggi. |
| U3 | Normal | Dapat dijadwalkan dalam antrean kerja reguler. | Akar masalah perlu dianalisis, tetapi ada workaround memadai dan risiko jangka pendek terkendali. |
| U4 | Rendah | Dapat menunggu tanpa dampak bisnis berarti. | Risiko rendah, dampak kecil, atau analisis dilakukan sebagai peningkatan berkelanjutan. |

## 5. Urutan Prioritas Tiket Incident

Incident harus diprioritaskan berdasarkan kebutuhan pemulihan layanan. Tujuan utamanya adalah mengurangi gangguan pengguna, bukan langsung mencari akar penyebab permanen.

| Prioritas | Nama | Urutan Penanganan | Deskripsi | Target Respons Awal | Target Pemulihan |
| --- | --- | --- | --- | --- | --- |
| P1 | Critical Incident | 1 | Layanan kritikal berhenti total, dampak luas, risiko keamanan tinggi, atau operasional utama lumpuh. | 15 menit | 4 jam atau sesuai SLA kritikal |
| P2 | High Incident | 2 | Fungsi penting terganggu, banyak pengguna terdampak, tetapi layanan tidak sepenuhnya berhenti atau ada workaround terbatas. | 30 menit | 8 jam kerja |
| P3 | Medium Incident | 3 | Gangguan terbatas pada modul, unit, atau kelompok pengguna tertentu dan tersedia workaround. | 4 jam kerja | 2 hari kerja |
| P4 | Low Incident | 4 | Dampak kecil, lokal, tidak menghambat layanan utama. | 1 hari kerja | 5 hari kerja |
| P5 | Service Defect Minor | 5 | Isu kosmetik, typo, permintaan perapian minor, atau gangguan sangat rendah tanpa dampak operasional. | 2 hari kerja | Dijadwalkan dalam backlog |

### Matriks Prioritas Incident

| Impact / Urgency | U1 Mendesak | U2 Tinggi | U3 Normal | U4 Rendah |
| --- | --- | --- | --- | --- |
| I1 Sangat Tinggi | P1 | P1 | P2 | P3 |
| I2 Tinggi | P1 | P2 | P3 | P3 |
| I3 Sedang | P2 | P3 | P3 | P4 |
| I4 Rendah | P3 | P4 | P4 | P5 |

### Contoh Incident

| Prioritas | Contoh |
| --- | --- |
| P1 | Portal tidak dapat diakses oleh seluruh warga atau pengurus. |
| P2 | Login admin gagal untuk sebagian besar pengurus, tetapi warga masih dapat mengakses portal publik. |
| P3 | Modul laporan berjalan lambat untuk beberapa pengguna dan masih bisa diakses. |
| P4 | Satu akun pengguna mengalami error profil, sementara pengguna lain normal. |
| P5 | Tampilan tombol tidak rapi atau teks bantuan kurang jelas tanpa menghambat proses. |

## 6. Urutan Prioritas Tiket Problem

Problem diprioritaskan berdasarkan risiko kejadian berulang, dampak potensial terhadap layanan, dan kebutuhan tindakan korektif permanen. Problem tidak selalu lebih mendesak dari Incident, tetapi Problem yang berpotensi menimbulkan Incident besar harus dinaikkan prioritasnya.

| Prioritas | Nama | Urutan Penanganan | Deskripsi | Target Review Awal | Target RCA / Rencana Aksi |
| --- | --- | --- | --- | --- | --- |
| PR1 | Critical Problem | 1 | Akar atau potensi akar masalah dari incident kritikal, berulang, tanpa workaround, atau berisiko tinggi terhadap keamanan/kepatuhan. | 1 hari kerja | 3 hari kerja |
| PR2 | High Problem | 2 | Masalah berulang dengan dampak besar, workaround ada tetapi tidak stabil atau mahal secara operasional. | 2 hari kerja | 5 hari kerja |
| PR3 | Medium Problem | 3 | Masalah berulang atau tren gangguan dengan dampak sedang, workaround tersedia dan risiko terkendali. | 5 hari kerja | 10 hari kerja |
| PR4 | Low Problem | 4 | Masalah berdampak kecil, jarang terjadi, atau analisis dilakukan untuk peningkatan layanan. | 10 hari kerja | Dijadwalkan dalam backlog perbaikan |

### Matriks Prioritas Problem

| Impact / Urgency | U1 Mendesak | U2 Tinggi | U3 Normal | U4 Rendah |
| --- | --- | --- | --- | --- |
| I1 Sangat Tinggi | PR1 | PR1 | PR2 | PR3 |
| I2 Tinggi | PR1 | PR2 | PR2 | PR3 |
| I3 Sedang | PR2 | PR3 | PR3 | PR4 |
| I4 Rendah | PR3 | PR4 | PR4 | PR4 |

### Contoh Problem

| Prioritas | Contoh |
| --- | --- |
| PR1 | Incident P1 berulang karena kegagalan autentikasi, belum ada workaround yang aman. |
| PR2 | Performa database sering turun saat jam sibuk dan menyebabkan beberapa incident P2/P3. |
| PR3 | Error validasi form muncul berulang pada kondisi data tertentu, tetapi ada langkah koreksi manual. |
| PR4 | Pola keluhan kecil terkait tampilan yang tidak menghambat operasional. |

## 7. Aturan Eskalasi Prioritas

Prioritas tiket harus dinaikkan jika salah satu kondisi berikut terjadi:

| Kondisi | Aksi |
| --- | --- |
| Dampak meluas ke lebih banyak pengguna atau layanan | Naikkan Impact, hitung ulang prioritas. |
| Workaround tidak lagi efektif | Naikkan Urgency. |
| Risiko keamanan, privasi, atau kepatuhan ditemukan | Minimal P2 untuk Incident atau PR2 untuk Problem; naikkan ke P1/PR1 bila dampaknya kritikal. |
| Incident berulang dengan pola yang sama | Buat atau tautkan ke tiket Problem. |
| Incident P1 sudah pulih tetapi akar masalah belum jelas | Wajib buat tiket Problem PR1 atau PR2. |
| Tiket melewati SLA tanpa progres memadai | Eskalasi ke owner layanan atau manajer operasional. |

## 8. Hubungan Incident dan Problem

| Situasi | Tindakan |
| --- | --- |
| Gangguan layanan sedang terjadi | Buat tiket Incident dan fokus pada pemulihan. |
| Incident selesai tetapi akar penyebab belum diketahui | Buat tiket Problem untuk RCA. |
| Incident yang sama terjadi berulang | Buat atau perbarui tiket Problem terkait. |
| Problem memiliki workaround | Dokumentasikan workaround dan tautkan ke knowledge base. |
| Problem selesai permanen | Tutup setelah fix tervalidasi dan knowledge base diperbarui. |

## 9. Informasi Minimum pada Tiket

### Incident

| Field | Wajib | Keterangan |
| --- | --- | --- |
| Judul | Ya | Ringkas dan spesifik. |
| Layanan terdampak | Ya | Modul, aplikasi, atau proses yang terganggu. |
| Impact | Ya | Sesuai skala I1 sampai I4. |
| Urgency | Ya | Sesuai skala U1 sampai U4. |
| Prioritas | Ya | Dihitung dari matriks Incident. |
| Gejala | Ya | Apa yang dialami pengguna. |
| Waktu mulai | Ya | Waktu gangguan pertama kali diketahui. |
| Workaround | Jika ada | Cara sementara agar layanan tetap berjalan. |
| Resolusi | Saat penutupan | Tindakan yang memulihkan layanan. |

### Problem

| Field | Wajib | Keterangan |
| --- | --- | --- |
| Judul | Ya | Menggambarkan pola atau akar masalah yang diduga. |
| Incident terkait | Ya | Satu atau lebih tiket Incident yang relevan. |
| Impact potensial | Ya | Dampak bila masalah terjadi kembali. |
| Urgency | Ya | Berdasarkan risiko berulang dan kebutuhan tindakan korektif. |
| Prioritas | Ya | Dihitung dari matriks Problem. |
| RCA | Saat tersedia | Root Cause Analysis. |
| Workaround | Jika ada | Solusi sementara yang terdokumentasi. |
| Known error | Jika ada | Masalah yang sudah dianalisis tetapi belum diperbaiki permanen. |
| Rencana aksi | Ya | Fix permanen, mitigasi, atau keputusan risiko. |

## 10. Alur Singkat Penanganan

### Incident

1. Identifikasi gangguan.
2. Catat tiket Incident.
3. Tentukan Impact dan Urgency.
4. Hitung prioritas.
5. Lakukan eskalasi sesuai prioritas.
6. Pulihkan layanan.
7. Dokumentasikan resolusi dan workaround.
8. Buat tiket Problem jika incident berulang, kritikal, atau akar penyebab belum jelas.

### Problem

1. Identifikasi pola incident, risiko potensial, atau akar masalah yang belum diketahui.
2. Catat tiket Problem.
3. Tautkan incident terkait.
4. Tentukan Impact potensial dan Urgency.
5. Lakukan RCA.
6. Dokumentasikan workaround atau known error.
7. Susun rencana aksi permanen.
8. Validasi perbaikan.
9. Tutup Problem setelah risiko terkendali dan dokumentasi diperbarui.

## 11. Catatan Implementasi

Target waktu pada dokumen ini adalah baseline operasional dan perlu disesuaikan dengan SLA, kapasitas tim, jam layanan, dan tingkat kritikalitas layanan organisasi.

ITIL tidak mewajibkan satu format angka prioritas yang universal. Organisasi dapat menggunakan P1 sampai P5 atau Critical sampai Low selama definisi Impact, Urgency, prioritas, eskalasi, dan target layanan diterapkan konsisten.

## 12. Referensi

- PeopleCert, ITIL 4 Practitioner: Incident Management: https://www.peoplecert.org/browse-certifications/it-governance-and-service-management/ITIL-1/itil4-practices-incident-management-3684
- PeopleCert, ITIL 4 Practitioner: Problem Management: https://www.peoplecert.org/browse-certifications/it-governance-and-service-management/ITIL-1/itil4-practices-problem-management-3688
- PeopleCert, ITIL 4 Management Practices 2023: https://www.peoplecert.org/jp/news-and-announcements/itil-4-management-practices-2023/
- ServiceNow, Data lookup for prioritizing problems: https://www.servicenow.com/docs/r/it-service-management/problem-management/prioritise-problems.html
