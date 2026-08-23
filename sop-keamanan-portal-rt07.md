# STANDAR OPERASIONAL PROSEDUR (SOP) & SPESIFIKASI TEKNIS
## ARSITEKTUR KEAMANAN DATA PORTAL RT 07 INTEGRASI
**Dokumen Referensi: SOP-SEC-2026-RT07**  
**Klasifikasi: INTERNAL / SANGAT RAHASIA**  
**Versi: 1.0 (Enterprise-Grade Security Core)**  
**Tanggal Efektif: 23 Agustus 2026**

---

### **1. PENDAHULUAN & TUJUAN**

Dokumen Standar Operasional Prosedur (SOP) ini disusun sebagai pedoman teknis mutlak bagi pengembangan, pemeliharaan, dan audit sistem aplikasi **Portal RT 07 Terintegrasi**. Tujuan utama dari SOP ini adalah mengeliminasi kerentanan keamanan bawaan (client-side dependency) dan menegakkan arsitektur keamanan berlapis (*Defense-in-Depth*) untuk melindungi data kependudukan warga serta seluruh transaksi keuangan RT 07.

Setiap pengembang (developer) yang ditunjuk wajib mematuhi arsitektur yang digariskan dalam dokumen ini demi memenuhi ketentuan undang-undang pelindungan data pribadi serta menjaga integritas finansial komunitas.

---

### **2. DIAGRAM ALUR ARSITEKTUR KEAMANAN (PORTAL & ADMIN)**

Berikut adalah visualisasi alur otentikasi, otorisasi, dan transaksi atomik yang menggantikan mekanisme *client-side* murni yang tidak aman:

```
+-----------------------------------------------------------------------------------+
|                              ARSITEKTUR CLIENT-SIDE (BROWSER)                     |
|  - Menyimpan State Profil Non-Sensitif                                             |
|  - Cookie Handler (admin_session & warga_session) via HttpOnly                     |
|  - React Hooks (useAdminAuth & useWargaAuth) untuk Sinkronisasi State & UI Guards |
+-----------------------------------------------------------------------------------+
                                   │               ▲
          POST /api/admin/login    │               │  HTTP Status (200 OK) + Set-Cookie
          POST /api/portal/login   │               │  JWT Token (HttpOnly, Secure, SameSite)
                                   ▼               │
+-----------------------------------------------------------------------------------+
|                         SERVER LAYER (NEXT.JS ROUTE HANDLERS)                    |
|  - Middleware Server-Side: Intercept /admin/* & /portal/*                         |
|  - Verifikasi Tanda Tangan JWT via JWT_SECRET (Algoritma HS256)                   |
|  - Menjaga Endpoint API dari Akses Tanpa Otorisasi                                |
+-----------------------------------------------------------------------------------+
                                   │               ▲
          Eksekusi RPC Query       │               │  Konfirmasi Status Valid
          & Verifikasi Kriptografi │               │  & Data Pengurus / Warga
                                   ▼               │
+-----------------------------------------------------------------------------------+
|                        DATABASE LAYER (SUPABASE POSTGRESQL)                       |
|  - Enkripsi Kredensial: Bcrypt Hashing (Salt 10) via pgcrypto                     |
|  - Row Level Security (RLS) & Policies: Isolasi data antar warga                  |
|  - Transaksi Atomik: eksekusi_autodebet_kurban() via pgSQL (BEGIN/COMMIT)         |
|  - Immutable Logs: Audit Log Trigger (Block UPDATE/DELETE secara absolut)         |
+-----------------------------------------------------------------------------------+
```

---

### **3. SPESIFIKASI KRIPTOGRAFI & OTENTIKASI SECARA AMAN**

Setiap mekanisme otentikasi di dalam Portal RT 07 wajib mematuhi standar enkripsi satu arah (hashing) dan penyimpanan sesi yang terenkapsulasi secara aman di sisi server.

#### **A. Kebijakan Kredensial Pengurus & Warga**
1. **Hashing Bcrypt (Salt Factor 10)**: Password pengurus RT dan warga tidak boleh disimpan dalam bentuk teks biasa (*plaintext*). Sistem wajib menggunakan modul ekstensi `pgcrypto` PostgreSQL untuk membungkus password menggunakan algoritma Blowfish (`bf`) dengan salt factor 10 saat data dimasukkan atau diubah di tabel database.
2. **Server-Side Verification**: Verifikasi password dilakukan di dalam mesin PostgreSQL menggunakan fungsi RPC `verifikasi_login_admin` dan `verifikasi_login_warga` melalui pencocokan kriptografis `crypt(input_password, stored_hash)`.

#### **B. Pengamanan Sesi Berbasis Token**
1. **JSON Web Token (JWT)**: Sesi pengguna ditandatangani di sisi server Next.js Route Handler menggunakan token JWT terenkripsi dengan masa kedaluwarsa maksimal **2 jam (7200 detik)**.
2. **HttpOnly Cookie**: Token JWT dilarang keras disimpan di dalam `localStorage` browser. Token wajib dikirimkan melalui HTTP header `Set-Cookie` dengan opsi keamanan maksimal:
   * `httpOnly: true` (Mencegah pencurian token via serangan scripting/XSS).
   * `secure: true` (Memastikan token hanya ditransmisikan melalui protokol terenkripsi HTTPS).
   * `sameSite: 'strict'` (Melindungi sesi dari serangan pembajakan request/CSRF).

---

### **4. REGULASI ROW LEVEL SECURITY (RLS) & PROTEKSI DATA PII**

Sesuai dengan **Undang-Undang Pelindungan Data Pribadi (UU PDP)**, seluruh informasi pribadi warga seperti NIK (Nomor Induk Kependudukan) dan Kontak WhatsApp wajib dilindungi dari eksposur publik atau akses lintas-pengguna yang tidak sah.

#### **A. Aturan Isolasi Data (Row Level Security)**
Database Supabase wajib mengaktifkan fitur Row Level Security (RLS) secara absolut di seluruh tabel transaksi dan data kependudukan. Aturan kebijakan (policies) yang diterapkan meliputi:

* **Tabel `warga`**:
  * Pengurus RT (aktor yang terotentikasi dalam grup pengurus) memiliki izin penuh (`ALL`) untuk membaca dan menyetujui pendaftaran.
  * Warga terdaftar hanya diizinkan melakukan operasi `SELECT` pada baris data mereka sendiri (`id = auth.uid()`). Pengambilan data massal (bulk retrieval) oleh warga wajib diblokir secara permanen di tingkat database.

* **Tabel `transaksi_sampah` & `tabungan_kurban`**:
  * Pembacaan data mutasi dibatasi secara ketat berdasarkan pencocokan ID warga yang aktif (`warga_id = auth.uid()`). Hal ini mencegah warga mengintip kondisi keuangan atau saldo sampah milik warga lain.

#### **B. Teknik Masking Data Pribadi**
Untuk mencegah kebocoran informasi kependudukan sensitif pada lalu lintas jaringan browser:
1. Nomor NIK warga yang ditampilkan pada antarmuka admin wajib disamarkan (masked) menggunakan fungsi `mask_nik()`.
2. Format penampilan NIK wajib menyembunyikan 6 digit tengah (contoh: `327501XXXXXX89`) untuk meminimalkan risiko pencurian identitas sosial.

---

### **5. PROSEDUR ATOMISITAS TRANSAKSI KEUANGAN**

Setiap fitur yang melakukan mutasi saldo atau pemotongan dana antar-tabel wajib tunduk pada prinsip ACID (Atomicity, Consistency, Isolation, Durability) PostgreSQL melalui transaksi tunggal sisi server.

1. **Anti-Partial Updates**: Dilarang keras melakukan perintah penulisan terpisah dari sisi browser klien untuk transaksi terintegrasi (seperti autodebet saldo sampah untuk setoran kurban).
2. **Database Remote Procedure Call (RPC)**: Pengurangan saldo bank sampah dan penambahan saldo tabungan kurban wajib disatukan di dalam satu fungsi database PostgreSQL `eksekusi_autodebet_kurban()`.
3. **Mekanisme Auto-Rollback**: Apabila salah satu langkah penulisan mutasi mengalami kegagalan (misal: saldo tidak mencukupi atau gangguan server), database engine wajib membatalkan (*rollback*) seluruh rangkaian transaksi secara otomatis sehingga saldo kedua akun warga tetap konsisten dan tidak mengalami korupsi pencatatan.

---

### **6. KEBIJAKAN IMMUTABLE AUDIT TRAIL (LOG AKTIVITAS KEKAL)**

Log audit (`audit_log`) merupakan instrumen pertanggungjawaban hukum mutlak yang mencatat pergerakan instruksi pengurus RT di sistem.

1. **Automated Trigger-Based Injection**: Catatan log aktivitas tidak boleh ditulis secara manual oleh browser klien. Setiap operasi modifikasi (`INSERT`, `UPDATE`, `DELETE`) pada tabel warga, kas RT, dan inventaris secara otomatis memicu trigger `log_aktivitas_otomatis()` untuk mencatatkan riwayat ke tabel `audit_log`.
2. **Autentikasi Otomatis Aktor**: Trigger secara otomatis menangkap email atau ID pengurus yang terotentikasi dari JWT klaim Supabase (`current_setting('request.jwt.claims')`), mencegah manipulasi identitas aktor.
3. **Immutable Protection**: Tabel `audit_log` wajib dilengkapi dengan trigger proteksi tingkat tinggi yang **memblokir secara mutlak operasi `UPDATE` dan `DELETE`**. Log audit di database RT 07 hanya boleh bertambah (*append-only*) dan dilarang keras dapat dimodifikasi atau dihapus oleh siapa pun, termasuk oleh akun Administrator pengurus RT.

---

### **7. PROTOKOL PENANGANAN INSIDEN KEAMANAN (INCIDENT RESPONSE)**

Jika terdeteksi adanya anomali data, akses ilegal ke dasbor admin, atau ketidaksesuaian saldo finansial warga:

1. **Lockdown Sesi**: Administrator pengurus RT wajib segera memicu pencabutan semua token JWT aktif di Supabase Auth untuk memaksa pengosongan sesi seluruh pengguna.
2. **Verifikasi Jalur Log Audit**: Tim auditor harus memeriksa tabel `audit_log` untuk mengidentifikasi ID aktor pengurus, alamat IP asal request, timestamp presisi, serta detail muatan modifikasi data yang terekam pada trigger immutable.
3. **Rollback Sesi Database**: Jika terjadi kesalahan mutasi akibat manipulasi bypass klien pra-migrasi, lakukan penyesuaian saldo warga dengan merujuk pada histori pencatatan log audit terakhir yang sah.

---

### **8. KEPATUHAN & PERSURATAN DEVELOPER**

Setiap rilis pembaruan perangkat lunak Portal RT 07 wajib melalui pemeriksaan statis (*Static Application Security Testing*) untuk memastikan:
* Tidak ada kata kunci rahasia (*secret key*) yang bocor di kode sumber.
* Semua deklarasi tipe data `any` telah dieliminasi dan digantikan dengan integrasi tipe skema database TypeScript (`types/supabase.ts`) demi mencegah crash runtime yang merugikan operasional warga RT 07.

---
**Penyusun Dokumen:**  
*Gemini Notebook Security Auditor & Principal Architect*
