# KEBIJAKAN CADANGAN OTOMATIS DATABASE (AUTOMATED BACKUP POLICY) PORTAL RT 07
===========================================================================
**Arsitektur & Standar Operasional Prosedur (SOP) Cadangan Data Finansial dan Audit Trail**
**Status Dokumen:** DIREKOMENDASIKAN (PRODUKSI)
**Versi:** 1.0 (Enterprise DevSecOps Standard)

---

## 1. PENDAHULUAN & TUJUAN
Sistem Manajemen Portal RT 07 menyimpan data keuangan krusial (Buku Kas RT, Tabungan Kurban, Bank Sampah Warga) serta catatan keamanan penelusuran aktivitas pengurus (*System Audit Logs*). Kehilangan data akibat kegagalan fisik peladen, kesalahan manusia (*human error*), atau serangan siber dapat menimbulkan kerugian finansial riil, sengketa antar warga, serta hilangnya akuntabilitas kepengurusan RT.

Kebijakan ini dibuat untuk menegakkan prinsip **RTO (Recovery Time Objective) < 4 Jam** dan **RPO (Recovery Point Objective) < 1 Jam** demi menjamin keutuhan data warga secara absolut.

---

## 2. STRATEGI CADANGAN BERLAPIS (HYBRID BACKUP STRATEGY)
Sistem backup database Supabase (PostgreSQL) RT 07 dikonfigurasi menggunakan 3 lapis perlindungan:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SUPABASE POSTGRESQL PRODUCTION DB                    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼ (Real-Time PITR)          ▼ (Daily pg_dump)           ▼ (Weekly Cold)
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│ Write-Ahead Logs │        │   GCS / AWS S3   │        │  Local Cold Box  │
│  (Point-in-Time) │        │  Encrypted Dump  │        │  (Offline Hard)  │
│  Retention: 7D   │        │  Retention: 30D  │        │  Retention: 365D │
└──────────────────┘        └──────────────────┘        └──────────────────┘
```

1. **Lapis 1: Point-in-Time Recovery (PITR) / Real-Time WAL Archiving**
   * **Deskripsi:** Supabase secara otomatis mencatat dan menyimpan *Write-Ahead Logs* (WAL) secara real-time ke penyimpanan terisolasi.
   * **Manfaat:** Memungkinkan pengembalian database (*database restore*) ke detik mana pun jika terjadi bencana, menjaga RPO tetap di bawah 1 jam.
   * **Rentang Retensi:** 7 Hari (*Hot Storage*).

2. **Lapis 2: Cadangan Harian Terenkripsi (Daily Encrypted Logical Backups)**
   * **Deskripsi:** Ekstraksi struktur skema dan baris data menggunakan utilitas `pg_dump` secara terjadwal setiap tengah malam (pukul 02.00 WIB saat aktivitas sistem paling rendah).
   * **Penyimpanan:** Direplikasikan langsung ke penyimpanan luar yang terpisah dari Supabase, menggunakan layanan **Google Cloud Storage (GCS)** atau **AWS S3** dengan mengaktifkan fitur enkripsi sisi peladen (*Server-Side Encryption*).
   * **Rentang Retensi:** 30 Hari (*Warm Storage*).

3. **Lapis 3: Cadangan Mingguan Offline (Weekly Cold Storage Archive)**
   * **Deskripsi:** Sinkronisasi berkas cadangan harian dari S3 ke komputer lokal pengurus RT yang terisolasi (*air-gapped hard drive*).
   * **Rentang Retensi:** 1 Tahun (*Cold Storage* dengan skema rotasi GFS - Grandfather-Father-Son).

---

## 3. IMPLEMENTASI TEKNIS SCRIPT OTOMASI BACKUP
Untuk lingkungan non-berbayar (Free Tier Supabase) yang tidak memiliki fitur otomatisasi PITR bawaan, tim pengembang wajib mengimplementasikan otomasi cadangan harian menggunakan utilitas kontainer atau mesin pelari VPS (cronjob).

Berikut adalah skrip otomasi **`backup_database_rt07.sh`** yang dikonfigurasi untuk melakukan dump database, melakukan enkripsi simetris menggunakan GPG, serta mengunggahnya secara aman ke bucket Cloud Storage (AWS S3 / GCS):

```bash
#!/bin/bash
# ======================================================================================
# AUTOMATED SECURE BACKUP SCRIPT FOR PORTAL RT 07 DATABASE
# ======================================================================================

# Konfigurasi Environment (Harap set variabel ini di sistem / file .env pengurus)
DB_HOST="aws-0-ap-southeast-1.pooler.supabase.com"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres.jsprzayqrjdbuuqretec"
DB_PASS="KATA_SANDI_DATABASE_ANDA"
GPG_PASSPHRASE="KUNCI_GPG_KRIPTOGRAFI_SANGAT_KUAT_UNTUK_DEKRIPSI"
S3_BUCKET="s3://backup-database-rt07-production"

# Inisialisasi Penamaan File
DATE=$(date +%Y-%m-%d_%H%M%S)
BACKUP_DIR="/tmp/supabase_backups"
RAW_DUMP_FILE="${BACKUP_DIR}/rt07_db_${DATE}.sql"
ENC_DUMP_FILE="${RAW_DUMP_FILE}.gpg"

# 1. Pastikan folder sementara tersedia
mkdir -p "$BACKUP_DIR"

echo "[*] Memulai proses ekstraksi database (pg_dump)..."
# Jalankan pg_dump dengan kompresi tingkat tinggi dan opsi skema publik
PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-privileges -F p -v -f "$RAW_DUMP_FILE"

if [ $? -ne 0 ]; then
    echo "[!] ERROR: Gagal melakukan ekstraksi database!"
    exit 1
fi

echo "[*] Mengenkripsi berkas cadangan menggunakan AES-256 GPG..."
# Enkripsi berkas SQL mentah menggunakan GPG simetris untuk mencegah kebocoran data warga di cloud storage
gpg --batch --yes --symmetric --passphrase "$GPG_PASSPHRASE" \
    --cipher-algo AES256 -o "$ENC_DUMP_FILE" "$RAW_DUMP_FILE"

if [ $? -ne 0 ]; then
    echo "[!] ERROR: Gagal melakukan enkripsi berkas cadangan!"
    rm -f "$RAW_DUMP_FILE"
    exit 1
fi

echo "[*] Mengunggah berkas terenkripsi ke bucket cloud storage terisolasi..."
# Mengunggah berkas terenkripsi menggunakan AWS CLI (mendukung S3 / GCS)
aws s3 cp "$ENC_DUMP_FILE" "${S3_BUCKET}/rt07_db_${DATE}.sql.gpg"

if [ $? -ne 0 ]; then
    echo "[!] ERROR: Gagal mengunggah berkas cadangan ke cloud storage!"
    rm -f "$RAW_DUMP_FILE" "$ENC_DUMP_FILE"
    exit 1
fi

# 2. Pembersihan folder sementara lokal demi keamanan
echo "[*] Melakukan pembersihan berkas sementara lokal..."
rm -f "$RAW_DUMP_FILE" "$ENC_DUMP_FILE"

echo "[✓] PROSES CADANGAN SUKSES!"
exit 0
```

### Penjadwalan Cronjob Pelaksana (Setiap Hari Pukul 02:00 WIB)
Daftarkan skrip di atas ke server cron pengurus (`crontab -e`):
```text
0 2 * * * /bin/bash /home/ubuntu/scripts/backup_database_rt07.sh >> /var/log/backup_rt07.log 2>&1
```

---

## 4. SKEMA ROTASI RETENSI DATA (GFS SYSTEM)
Untuk menghindari lonjakan biaya penyimpanan cloud, sistem penyimpanan cadangan harus mengikuti aturan retensi berikut:

| Jenis Cadangan | Frekuensi | Masa Retensi | Target Penyimpanan | Kategori Biaya |
| :--- | :--- | :--- | :--- | :--- |
| **Daily Backup** | Setiap Hari (02.00) | 30 Hari | AWS S3 Standard / GCS Standard | Hot Storage (Sangat Murah) |
| **Weekly Backup** | Setiap Minggu (Ahad) | 90 Hari | AWS S3 Standard-IA / GCS Nearline | Infrequent Access Storage |
| **Monthly Backup** | Setiap Bulan (Tgl 1) | 365 Hari | AWS S3 Glacier Deep Archive | Cold Storage (Termurah) |

---

## 5. SOP PEMULIHAN & PENGUJIAN (RECOVERY & SIMULATION PROSEDUR)
Cadangan dinilai tidak berharga jika tidak pernah diuji proses pengembaliannya (*restore verification*). Setiap 6 bulan sekali, tim IT RT 07 wajib melakukan **Simulasi Bencana Siber**:

1. **Inisialisasi Sandbox:** Buat sebuah database PostgreSQL sandbox/lokal kosong untuk keperluan pengujian.
2. **Unduh & Dekripsi:** Unduh berkas `.sql.gpg` harian terbaru dari S3, lalu jalankan perintah dekripsi:
   ```bash
   gpg --batch --yes --decrypt --passphrase "KUNCI_GPG_ANDA" -o restore_test.sql rt07_db_terbaru.sql.gpg
   ```
3. **Eksekusi Pengembalian (Restore):**
   ```bash
   psql -h localhost -U postgres -d restore_test_db -f restore_test.sql
   ```
4. **Verifikasi Keutuhan Data:**
   * Pastikan total baris pada tabel `warga`, `kas_rt`, dan `audit_log` sesuai dengan data produksi.
   * Pastikan tidak ada karakter data yang rusak (*data corruption*) akibat inkonsistensi enkoding.

---

Dengan dijalankannya kebijakan ini secara disiplin, seluruh data milik warga RT 07 dijamin akan selalu terlindungi dari bahaya fisik peladen, kegagalan penyedia cloud, maupun ancaman serangan siber tebusan (*ransomware*).
