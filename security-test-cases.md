# SKENARIO PENGUJIAN KEAMANAN (SECURITY TEST CASES) PORTAL RT 07
**Dokumen Pengujian Penetrasi (Pentest) & QA Keamanan Aplikasi**
**Versi:** 1.0 (Stabil)
**Oleh:** Elite DevSecOps Engineer & Senior Web Application Auditor

---

## 1. PENDAHULUAN & RUANG LINGKUP
Dokumen ini disusun untuk memvalidasi efektivitas seluruh perbaikan arsitektur keamanan yang telah diimplementasikan berdasarkan **SOP Keamanan Portal RT 07** (`sop-keamanan-portal-rt07.md`). Skenario ini mencakup pengujian manual (*Manual Penetration Testing*) dan otomatis (*Automated API Testing*) untuk memastikan tidak ada celah keamanan sisa (*residual risk*) sebelum aplikasi dideploy ke lingkungan produksi.

---

## 2. MATRIKS SKENARIO PENGUJIAN MANUAL (QA KEAMANAN)

### Kategori A: Otentikasi & Otorisasi (Pilar 1: Security)

#### TC-SEC-01: Manipulasi Sesi via Client-Side Storage Bypass
* **Tujuan**: Memastikan sistem tidak lagi mempercayai data login admin atau warga yang diinjeksi manual di browser.
* **Prasyarat**: Pengguna berada di halaman login `/admin` atau `/login` tanpa memiliki akun yang valid.
* **Langkah Pengujian**:
  1. Buka browser dan akses Developer Tools (F12) -> tab **Application** -> **Local Storage**.
  2. Tambahkan entri baru secara manual:
     * Key: `admin_aktif`
     * Value: `{"id": "6732f109-xxxx-xxxx-xxxx", "nama": "Admin RT Palsu", "jabatan": "Ketua RT"}`
  3. Muat ulang halaman (`F5`) atau langsung arahkan URL browser ke `http://localhost:3000/admin/kas`.
* **Hasil yang Diharapkan (Sistem Aman)**:
  * Pengguna **ditolak aksesnya** dan secara paksa dialihkan kembali ke `/admin`.
  * Middleware Next.js server-side mendeteksi ketiadaan cookie HttpOnly `admin_session` dan memblokir request rendering.
* **Hasil Kerentanan Lama (Sistem Rentan)**:
  * Pengguna berhasil masuk ke dasbor admin tanpa otentikasi asli dan dapat memanipulasi data kas.

#### TC-SEC-02: Bypass Akses URL Sub-Modul Admin Secara Langsung
* **Tujuan**: Memverifikasi bahwa seluruh rute admin dilindungi oleh Server-Side Route Guards (Middleware).
* **Prasyarat**: Pengguna tidak sedang masuk sebagai admin (tidak ada cookie `admin_session`).
* **Langkah Pengujian**:
  1. Buka browser dalam mode Penyamaran (Incognito Mode).
  2. Akses secara langsung URL berikut secara bergantian:
     * `http://localhost:3000/admin/kas`
     * `http://localhost:3000/admin/inventaris`
     * `http://localhost:3000/admin/kurban`
     * `http://localhost:3000/admin/audit`
* **Hasil yang Diharapkan (Sistem Aman)**:
  * Semua request diblokir oleh Middleware Next.js sebelum memproses rendering halaman.
  * Browser dialihkan secara instan ke halaman login utama `/admin`.
* **Hasil Kerentanan Lama (Sistem Rentan)**:
  * Halaman-halaman sub-modul admin terbuka secara penuh tanpa ada form login, data transaksi ditarik dari database dan dirender di browser.

---

### Kategori B: Integritas Logika Bisnis & Transaksi (Pilar 2: Business Logic)

#### TC-BUS-01: Bypass Validasi Threshold Saldo Negatif Kurban
* **Tujuan**: Menguji apakah sistem menolak upaya penarikan tabungan kurban yang melebihi saldo aktual yang dimiliki warga.
* **Prasyarat**: Akun warga memiliki saldo tabungan kurban sebesar Rp 50.000.
* **Langkah Pengujian**:
  1. Masuk ke panel Admin Kurban (`/admin/kurban`).
  2. Pilih warga yang bersangkutan.
  3. Pilih jenis transaksi **Tarik / Batal**.
  4. Masukkan nominal sebesar **Rp 100.000** (melebihi saldo ketersediaan).
  5. Jika browser memblokir di UI, bypass proteksi tersebut dengan menembak langsung REST API Supabase `tabungan_kurban` menggunakan tool API Client (seperti Postman atau cURL) menggunakan Anon Key publik:
     ```bash
     curl -X POST "https://your-supabase-url.supabase.co/rest/v1/tabungan_kurban" \
       -H "apikey: YOUR_PUBLIC_ANON_KEY" \
       -H "Content-Type: application/json" \
       -d '{"warga_id": "ID_WARGA", "jenis_transaksi": "Tarik", "nominal": 100000}'
     ```
* **Hasil yang Diharapkan (Sistem Aman)**:
  * Operasi cURL ditolak secara absolut oleh database PostgreSQL dengan pesan error pelanggaran constraint: `chk_kurban_nominal_positif` atau kegagalan logika RPC. Saldo tidak terdebet.
* **Hasil Kerentanan Lama (Sistem Rentan)**:
  * Operasi cURL berhasil, baris mutasi ditarik tercatat di database, dan saldo kurban warga bernilai negatif (`-Rp 50.000`).

#### TC-BUS-02: Kegagalan Parsial Transaksi Auto-Debet Bank Sampah (Uji Atomisitas)
* **Tujuan**: Memastikan tidak ada inkonsistensi data saldo (data corruption) saat proses auto-debet bank sampah untuk tabungan kurban gagal di tengah jalan.
* **Prasyarat**: Akun warga memiliki saldo Bank Sampah Rp 200.000 dan saldo Kurban Rp 0.
* **Langkah Pengujian**:
  1. Lakukan transaksi Setor Kurban dengan nominal Rp 100.000 menggunakan metode **Potong Saldo Sampah**.
  2. Simulasikan kegagalan jaringan/server mati tepat setelah penulisan mutasi kurban berhasil sebelum pemotongan saldo sampah ditulis (pada skema lama, hal ini dilakukan via dua panggilan insert client-side terpisah).
  3. Pada skema baru, uji dengan memanggil RPC `eksekusi_autodebet_kurban` namun dengan parameter nominal yang sengaja dilebihkan (misal Rp 250.000).
* **Hasil yang Diharapkan (Sistem Aman)**:
  * Seluruh proses dibatalkan secara mutlak (rollback). Tidak ada data tabungan kurban baru yang ditulis, dan saldo bank sampah warga tetap utuh Rp 200.000.
* **Hasil Kerentanan Lama (Sistem Rentan)**:
  * Tabungan kurban bertambah Rp 100.000 namun saldo bank sampah warga tidak berkurang sama sekali karena koneksi/eksekusi insert kedua gagal ditulis.

---

### Kategori C: Privasi & Kepatuhan Data (Pilar 5: Compliance)

#### TC-COMP-01: Ekstraksi Data NIK Warga Secara Massal via REST API
* **Tujuan**: Memastikan penyerang luar tidak dapat mencuri data NIK warga secara massal melalui REST API Supabase.
* **Prasyarat**: Penyerang mengetahui endpoint REST Supabase dan memiliki Anon Key publik.
* **Langkah Pengujian**:
  1. Jalankan perintah cURL untuk memanen seluruh data kependudukan warga secara langsung:
     ```bash
     curl -X GET "https://your-supabase-url.supabase.co/rest/v1/warga" \
       -H "apikey: YOUR_PUBLIC_ANON_KEY"
     ```
* **Hasil yang Diharapkan (Sistem Aman)**:
  * API mengembalikan respon kosong atau error otentikasi karena aturan **Row Level Security (RLS)** melarang akses anonim tanpa token JWT pengguna yang terotentikasi.
  * Jika diakses oleh warga yang sah melalui view `v_warga_masked`, kolom NIK mengembalikan format sensor aman: `327501XXXXXX89`.
* **Hasil Kerentanan Lama (Sistem Rentan)**:
  * API mengembalikan JSON mentah berisi ribuan data kependudukan warga RT lengkap dengan NIK plaintext dan nomor kontak WhatsApp secara telanjang.

---

## 3. SKENARIO PENGUJIAN OTOMATIS (AUTOMATED SECURITY SCRIPT)
Kami telah melampirkan sebuah skrip otomatisasi pengujian penetrasi berbasis **Python 3** bernama **`security_test_script.py`** yang dapat dijalankan oleh tim QA Anda. Skrip ini secara otomatis memprogram uji cerminan eksploitasi untuk mematikan celah RLS, kebocoran PII, dan bypass otentikasi pada endpoint Supabase Anda.

---

## 4. JADWAL & FREKUENSI PENGUJIAN KEAMANAN
Untuk menjaga kepatuhan dan integritas aplikasi secara berkelanjutan, pengujian ini wajib dijalankan pada kondisi:
1. **Setiap Rilis Baru (Pre-Deployment)**: Seluruh test cases wajib bernilai **PASS (Lolos)** sebelum kode dimerge ke branch `main`.
2. **Audit Periodik Semesteran**: Evaluasi kepatuhan UU PDP dan penetrasi database Supabase minimal setiap 6 bulan sekali.
3. **Setiap Perubahan Skema Database**: Memastikan seluruh triggers, views, dan RLS policies tidak mengalami deviasi fungsi.
