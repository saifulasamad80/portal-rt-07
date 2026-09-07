# AUDIT HEALTH CHECK — 07 September 2026

**Sifat laporan:** pasif, report-only. Tidak ada mutasi kode, migrasi, atau CAB.  
**Objek:** proyek `Database-RT-07` (`jsprzayqrjdbuuqretec`) + repo `aplikasi-rt`.  
**Metode:** grep/baca Server Action & klien data; `list_tables`; advisor keamanan/kinerja Supabase; `SELECT` ke `pg_policies`, `pg_class`, grants, definisi fungsi, storage policies.  
**Fakta konteks:** `master_rt` live = **1 baris**. Isolasi antar-RT belum teruji oleh data produksi kedua. Beberapa temuan di bawah adalah **bom waktu arsitektur**: aman selama tenant tunggal, pecah saat RT kedua hidup.

Aplikasi stabil bukan berarti boundary tenant sudah rapat. Lapisan aplikasi (filter `.eq('rt_id', …)` + JWT sesi) lebih ketat daripada RLS live. RLS adalah yang akan dilawan penyerang yang memegang `NEXT_PUBLIC_SUPABASE_ANON_KEY` (kunci ini memang publik).

---

## HIGH RISK (Kritis)

Cacat yang bisa membocorkan data antar tenant, merusak integritas, atau membuka permukaan serangan tanpa sesi aplikasi.

### H1 — Etalase publik tidak mengikat tenant (kebocoran antar-RT via Data API)

**Tabel live:** `galeri_kegiatan`, `dokumen_publik_rt`, `kontak_darurat_rt`  
**Policy live:** `Publik baca galeri terbit` / `Publik baca dokumen terbit` / `Publik baca kontak darurat aktif`  
**USING:** `(dipublikasikan = true AND rt_id IS NOT NULL)` — **tanpa** `rt_id = tenant X`.  
**Role:** `{anon, authenticated}`  
**Sumber migrasi:** `tenant-rt-id-rls-etalase.sql` baris 232–248.

Landing app memfilter `PUBLIC_RT_ID` (`app/page.tsx` baris 217, 226–228). Data API tidak. Siapa pun dengan anon key dapat `GET /rest/v1/galeri_kegiatan?dipublikasikan=eq.true` dan menarik **semua** etalase semua RT.

Saat ini hanya 1 `master_rt`, jadi belum ada korban lintas-RT. Policy ini **pasti bocor** begitu RT kedua mempublikasikan galeri/dokumen/kontak.

`master_rt` policy `Publik bisa melihat daftar RT untuk pendaftaran` (`USING true`, role `{public}`) membeberkan katalog tenant. Disengaja untuk daftar, tetapi memperkuat enumerasi tenant untuk H1.

---

### H2 — Policy warisan permissive lebih longgar daripada policy pengganti (OR, bukan AND)

Postgres mengevaluasi beberapa policy **PERMISSIVE** sebagai OR. Policy baru yang ketat **tidak meniadakan** policy lama yang longgar.

| Tabel | Policy live yang longgar | Qual | Masalah |
|---|---|---|---|
| `warga` | `Webmaster akses tanpa batas` | `(auth.jwt() ->> 'app_role') = 'webmaster'` | FOR ALL tanpa `rt_id`. Klaim JWT, bukan baris `pengurus_rt`. |
| `warga` | `Warga hanya bisa melihat profil sendiri` | `id = (auth.jwt() ->> 'sub')::uuid` | SELECT tanpa `rt_id`. |
| `warga` | `Pengurus hanya mengelola warga se-RT` | `rt_id = jwt.rt_id AND app_role = 'rt'` | Webmaster klaim terpisah; duplikat policy baru `Admin kelola warga di RT-nya sendiri`. |
| `anggota_keluarga` | `Webmaster akses anggota keluarga tanpa batas` | `app_role = 'webmaster'` | FOR ALL tanpa tenant. |
| `anggota_keluarga` | `Warga kelola anggota keluarga sendiri` | `warga_id = (jwt.sub)::uuid` | FOR ALL **tanpa `rt_id`**. |
| `anggota_keluarga` | `Pengurus kelola anggota keluarga se-RT` | jwt `app_role = 'rt'` | Duplikat; tidak di-DROP oleh migrasi terbaru. |

Policy pengganti yang ketat ada (`Warga kelola anggota rumah tangga sendiri` memakai `warga_id = auth.uid() AND rt_id = dapatkan_rt_id_saya()`, `tenant-rt-id-rls-etalase.sql` baris 199–210 untuk sensus analog). Nama policy lama **tidak** muncul di `DROP POLICY` migrasi JWT/etalase, jadi tetap hidup.

Dampak `anggota_keluarga` / `Warga kelola anggota keluarga sendiri`: warga terautentikasi (JWT Supabase `role=authenticated` yang dicetak di `lib/supabase-server.ts` baris 54–65) lolos WITH CHECK hanya dengan `warga_id = sub`. Tidak ada trigger `kunci_rt_id_dari_warga` pada `anggota_keluarga` (`tenant-rt-id-kontrak-wajib.sql` baris 236–299 — daftar trigger tidak memuat tabel ini). Insert dengan `rt_id` milik RT lain secara teori meracuni buku induk RT itu, dan pengurus RT korban akan melihatnya lewat `klaim_baca_tenant`.

Jalur eksploitasi hari ini: JWT Supabase **tidak** dikirim ke browser (hanya server). Ini tetap bom waktu: satu klien yang memakai `buatKlienTerautentikasi` di browser, atau bocornya `SUPABASE_JWT_SECRET`, membuat policy warisan langsung dipakai.

---

### H3 — `warga` FOR UPDATE tanpa pembatasan kolom

**Policy live:** `Warga hanya bisa memperbarui profil sendiri`  
**USING/WITH CHECK:** `id = auth.uid() AND rt_id = dapatkan_rt_id_saya()`  
**Sumber:** `rls-authenticated-data-layer-migration.sql` baris 112–118; diulang di `rls-jwt-rt-id-claims-migration.sql` (policy UPDATE yang sama).

RLS mengizinkan UPDATE **semua kolom** baris sendiri: `status_verifikasi`, `pin`, `status_aktif`, `session_version`, `rt_id` (rt_id tidak bisa diganti karena WITH CHECK, kolom lain bisa). Tidak ada `REVOKE UPDATE (kolom_sensitif)`.

Tidak ada Server Action portal yang meng-update biodata warga sendiri (keluarga read-only, tiket lewat `laporan_warga`). Boundary hari ini adalah **ketiadaan UI**, bukan database. Satu `.update(payloadDariKlien)` di masa depan = warga bisa mensetujui akun sendiri atau menimpa PIN.

---

### H4 — Storage `dokumen_warga`: unggah anonim ke bucket KTP/KK

**Live `storage.buckets`:** `dokumen_warga` (`public = false`), `lapak_warga` (`public = true`).  
**Policy storage live:**

| Nama | cmd | roles | syarat |
|---|---|---|---|
| `Izinkan unggah dokumen Anon` | INSERT | `{public}` | `bucket_id = 'dokumen_warga'` |
| `Izinkan Admin lihat dokumen` | SELECT | `{authenticated}` | `bucket_id = 'dokumen_warga'` (seluruh bucket, tanpa prefix/path/tenant) |

Tidak ada file SQL di repo yang mendefinisikan kedua policy ini (hanya komentar di `portal-publik-etalase.sql` baris 42). Policy hidup hanya di proyek remote.

Dampak:

1. Siapa pun dengan anon key dapat mengunggah berkas ke bucket identitas (isi sampah, kuota, objek berbahaya). Path tidak terikat `rt_id`.
2. Role `authenticated` (JWT yang sama dengan klien data server) dapat **SELECT seluruh objek** bucket, bukan hanya path milik RT-nya. `app/api/admin/dokumen/route.ts` baris 16–35 mengikat path ke baris `warga` + tenant; policy storage **tidak**. Jika JWT itu pernah dipakai langsung ke Storage API, KTP/KK lintas-RT tinggal menebak/men-list path.

Pendaftaran resmi memakai service role di `app/register/actions.ts` baris 7, 16 (`BUCKET_DOKUMEN = "dokumen_warga"`). Policy INSERT public **tidak diperlukan** untuk alur itu.

---

### H5 — RPC `register_warga_baru` dieksekusi `anon`, tenant diisi `LIMIT 1`

**Live:** `public.register_warga_baru(jsonb, jsonb)`  
**EXECUTE:** `anon`, `authenticated`, `service_role`  
**SECURITY DEFINER:** tidak (invoker)  
**Badan (kutipan live):** `SELECT rt_id INTO v_rt_id FROM pengurus_rt WHERE rt_id IS NOT NULL LIMIT 1;` lalu INSERT ke `warga` + `anggota_keluarga` **tanpa `rt_id` pada anggota**.

Alur pendaftaran produksi adalah `app/register/actions.ts` (service role + `REGISTRATION_RT_ID`), **bukan** RPC ini. RPC tetap tersaji di `/rest/v1/rpc/register_warga_baru`.

Hari ini INSERT `warga` sebagai `anon` gagal karena tidak ada policy INSERT anon pada `warga` (hanya `authenticated`). Bom waktu: mengubah fungsi menjadi `SECURITY DEFINER`, atau menambah policy INSERT, langsung menulis warga ke **RT acak pertama** di `pengurus_rt` — pola yang sudah ditolak di `tenant-rt-id-kontrak-wajib.sql`.

---

### H6 — Tabel operasional tanpa `rt_id`, policy pengurus = seluruh baris

Live, kolom `rt_id` **tidak ada** pada:

- `laporan_posyandu`
- `pemilihan_rt`
- `kandidat_rt`
- `partisipasi_pemilihan`
- `suara_pemilihan`
- `notifikasi_riwayat`

Policy live:

- `laporan_posyandu` / `Pengurus baca laporan posyandu`: `USING (adalah_pengurus())` — **setiap** pengurus RT membaca semua laporan posyandu. Sumber: `tenant-rt-id-rls-etalase.sql` baris 250–255.
- `pemilihan_rt` / `Pengurus baca sesi pemilihan`: sama, baris 257–261.
- `kandidat_rt` / `Pengurus baca katalog kandidat`: sama, baris 263–267.
- `partisipasi_pemilihan` / `Warga melihat partisipasi sendiri`: `warga_id = auth.uid()` tanpa tenant.
- `suara_pemilihan` / `Blokir SELECT langsung suara pemilihan`: `USING false` (SELECT diblokir — baik).

Jumlah baris live `laporan_posyandu` / `pemilihan_rt` / `kandidat_rt` = 0. Modul e-voting/posyandu lama **belum** terisi, tetapi policy sudah mengizinkan silang-RT. `posyandu_balita` / `posyandu_lansia` / `kunjungan_*` hanya punya policy **RESTRICTIVE** `USING false` (fail-closed); akses app lewat service role + `LEGACY_POSYANDU_RT_ID` di `app/admin/ibu-ibu/page.tsx` baris 17–45. Itu lebih aman daripada `laporan_posyandu`.

`notifikasi_riwayat`: RLS nyala, **nol policy** (advisor `rls_enabled_no_policy`). INSERT dari `lib/notifikasi-push.ts` baris 155 memakai service role (bypass RLS). REST anon/authenticated gagal SELECT — fail-closed. GRANT ALL ke `anon` tetap ada (lihat M7).

---

### H7 — Overload `proses_autodebet_kurban` lama tanpa `rt_id` masih hidup

Live ada **dua** fungsi `SECURITY DEFINER`:

1. `proses_autodebet_kurban(uuid, integer, text, date, text)` — **tanpa** `SET search_path`, INSERT `transaksi_sampah` / `transaksi_kurban` / `audit_log` **tanpa kolom `rt_id`**, saldo dihitung tanpa filter tenant. Advisor: `function_search_path_mutable`.
2. `proses_autodebet_kurban(uuid, numeric, text, date, text)` — versi kontrak di `tenant-rt-id-kontrak-wajib.sql` baris 479–574, `search_path` terkunci, `rt_id` dari induk warga.

Keduanya `EXECUTE` hanya `service_role` (bukan anon/authenticated). Overload `integer` jika terpanggil: trigger `trg_kunci_rt_transaksi_sampah` akan menolak INSERT tanpa `rt_id` **atau** mengisi dari warga — perilaku tergantung urutan. Fungsi lama adalah bom search_path + duplikat RPC. Jangan dianggap sudah diganti; Postgres men-dispatch berdasar tipe argumen.

---

## MEDIUM RISK (Menengah)

Bug UI/logika, query lambat, grant berlebih yang belum langsung tereksploitasi lewat PostgREST, atau celah yang tertahan oleh lapisan lain.

### M1 — Warga tidak punya policy SELECT pada `suara_voting`

Policy live: INSERT `Warga pilih suara sendiri`; SELECT hanya `Pengurus baca suara RT sendiri`.

`app/portal/(terkunci)/voting/page.tsx` baris 26–33 men-SELECT suara sendiri. Query itu kosong untuk role warga. UI bisa menampilkan “belum memilih” padahal baris sudah ada.

Double-vote tertahan unique index live `suara_voting_voting_id_warga_id_key` + handler `23505` di baris 64. Integritas suara aman; UX dan deteksi “sudah memilih” rapuh. Baris 54 cek `validasi` sebelum insert juga butuh SELECT — selalu null, mengandalkan unique constraint.

---

### M2 — `kas_rt` SELECT warga = seluruh transaksi RT

Policy live `Warga lihat data kas di RT-nya sendiri`: `rt_id = dapatkan_rt_id_saya()` tanpa `warga_id = auth.uid()`.

Portal memfilter `.eq("warga_id", …)` di `app/portal/(terkunci)/keuangan/page.tsx` baris 12–16. RLS mengizinkan warga membaca iuran/pengeluaran warga lain se-RT jika kueri lupa filter. Privasi keuangan intra-RT, bukan lintas-RT.

---

### M3 — `aksiIzinkanRevisi` tidak atomik

`app/admin/lapor/page.tsx` baris 145–190: UPDATE `sensus_kesejahteraan.status_validasi = 'Menunggu'` dulu, baru tutup tiket. Jika tutup tiket gagal, pesan di baris 189: cap sudah terbuka, tiket masih terbuka. Warga bisa mengoreksi Carik tanpa tiket tertutup. Bukan kebocoran tenant, tetapi inkonsistensi status yang mahal dibersihkan manual.

---

### M4 — Landing publik memakai `service_role`

`app/page.tsx` baris 200: `getSupabaseAdminClient()`. Filter `PUBLIC_RT_ID` ada di hampir semua kueri (217–229). Pengecualian: rekap suara baris 259 `suara_voting.select("pilihan").eq("voting_id", votingTerbaru.id)` **tanpa** `.eq("rt_id", PUBLIC_RT_ID)`. `votingTerbaru` sudah diikat tenant (baris 218), jadi selama `voting_id` unik global ini aman. Service role meniadakan RLS: satu kueri tanpa filter = dump lintas tenant. Blast radius besar, mitigasi hanya disiplin kode.

---

### M5 — Cron notifikasi service_role tanpa filter `rt_id`

`app/api/cron/notifikasi/route.ts` baris 27, 40–47, 77–80: SELECT seluruh `warga` Disetujui dan seluruh `jadwal_ronda` pada tanggal, tanpa tenant. Disengaja untuk job global. `otorisasiCron` baris 18–23: tanpa `CRON_SECRET` di non-production = terbuka. Produksi tanpa secret = ditolak. Push body baris 67 mengunci teks “RT 07” untuk semua tenant.

---

### M6 — `nominal_warga` / `nominal` PostgREST: null dan string

`app/portal/(terkunci)/sampah/page.tsx` baris 24–26: `sum + t.nominal_warga` tanpa `Number` / null-coalesce. `numeric` Postgres sering datang sebagai string; `null` menghasilkan `NaN` di saldo.

`app/portal/(terkunci)/keuangan/page.tsx` baris 118: `t.nominal.toLocaleString('id-ID')`. Jika `nominal` null → TypeError. Baris 21 memakai `Number(t.nominal) || 0` tetapi render tidak.

`app/admin/sampah/page.tsx` baris 140–142: `saldoAktual += r.nominal_warga` pola sama; saldo tarik bisa `NaN` dan lolos perbandingan.

---

### M7 — GRANT berlebih ke `anon` (termasuk TRUNCATE) pada tabel sensitif

`information_schema.role_table_grants` live: `anon` punya INSERT/UPDATE/DELETE/**TRUNCATE** pada antara lain `pengurus_rt`, `master_rt`, `warga_backup_070926`, `transaksi_sampah_backup_070926`, `kandidat_rt`, `pemilihan_rt`, `laporan_posyandu`, `notifikasi_riwayat`, plus TRUNCATE pada etalase.

RLS menahan DML REST (tidak ada policy tulis anon). **TRUNCATE tidak tunduk RLS.** PostgREST tidak mengekspos TRUNCATE, jadi Data API tidak bisa mengosongkan tabel lewat HTTP. Grant ini berbahaya jika ada koneksi SQL sebagai `anon` (pooler, replica, salah role). Backup `warga_backup_070926` berisi **685** baris PII, RLS tanpa policy (fail-closed REST) + GRANT ALL anon.

Advisor: `rls_enabled_no_policy` pada `notifikasi_riwayat`, `transaksi_sampah_backup_070926`, `warga_backup_070926`.

---

### M8 — View `security_invoker` + GRANT SELECT anon

Live, `reloptions = security_invoker=true` (benar, tidak bypass RLS induk):

- `v_warga_masked` — kolom `no_whatsapp`, `detail_alamat`, NIK mask
- `v_rekap_kas_rt` — agregat kas **tanpa** `GROUP BY rt_id` (definisi: SUM seluruh `kas_rt`)
- `v_saldo_sampah_warga`, `v_saldo_kurban_warga`, `v_rekapitulasi_suara_pemilu`

GRANT SELECT/INSERT/DELETE/TRUNCATE ke `anon`. Sebagai invoker, anon tidak lolos RLS `warga`/`kas_rt` (tidak ada policy anon) → hasil kosong. `v_rekap_kas_rt` tetap salah desain multi-tenant: pengurus/warga terautentikasi yang lolos RLS `kas_rt` se-RT akan melihat agregat **hanya baris yang RLS izinkan**, tetapi definisi view tidak punya `rt_id` di output. Webmaster yang `klaim_baca_tenant` semua RT mendapat **satu angka campur semua tenant**.

---

### M9 — Helper RLS `SECURITY DEFINER` callable lewat RPC

Advisor `authenticated_security_definer_function_executable`: `adalah_pengurus()`, `adalah_webmaster()`, `dapatkan_rt_id_saya()`, `klaim_baca_tenant(uuid)`, `klaim_tulis_tenant(uuid)` — EXECUTE `authenticated`. Perlu untuk policy, tetapi juga `/rest/v1/rpc/adalah_webmaster`. Mengungkap klaim, bukan data baris. `adalah_pengurus()` / `adalah_webmaster()` percaya `app_role` di JWT dulu, baru lookup tabel (`rls-jwt-rt-id-claims-migration.sql` baris 65–90). JWT dicetak server (`lib/supabase-server.ts` 54–59) dari sesi yang di-revalidasi DB. Jika `SUPABASE_JWT_SECRET` bocor, `app_role=webmaster` cukup.

---

### M10 — Relasi nested / webmaster tanpa filter aplikasi

Beberapa halaman webmaster **sengaja** tidak `.eq('rt_id')` (mengandalkan RLS `klaim_baca_tenant` yang untuk webmaster = semua tenant non-null):

- `app/admin/voting/page.tsx` baris 18–23
- `app/admin/inventaris/page.tsx` baris 14–18
- `app/admin/sampah/page.tsx` baris 83–92 (limit 500 global)
- `app/admin/warga/page.tsx` baris 55–57

Ini sesuai peran webmaster, bukan bug otorisasi warga. Risiko: UI webmaster mencampur tenant tanpa label `rt_id` di beberapa select (inventaris `select("*")` punya kolom; voting statistik mencampur `suara_voting` global). Operator manusia bisa salah RT. Bukan IDOR warga.

---

### M11 — Performa RLS (advisor)

- `auth_rls_initplan` pada policy warisan `warga` / `anggota_keluarga` / `jadwal_ronda` / `suara_voting` / `lapak_warga` / `laporan_warga` / `peminjaman_inventaris` / `limbah_ekonomis` / `partisipasi_pemilihan` — `auth.jwt()` diulang per baris.
- `multiple_permissive_policies` hampir di semua tabel operasional (akibat H2 + policy ganda warga/pengurus).
- FK `rt_id` / `warga_id` tanpa covering index (puluhan tabel).
- Duplicate index `sensus_kesejahteraan`: `unique_warga_sensus` dan `uq_sensus_kesejahteraan_warga`.

Bukan kebocoran; akan terasa saat RT kedua + ribuan baris.

---

### M12 — `hash_password_pengurus` search_path mutable

Advisor WARN. Definisi live memakai `extensions.crypt` tanpa `SET search_path`. Trigger pada `pengurus_rt`. Objek `search_path` penyerang (jika bisa membuat objek di path) bisa membajak hash. `anon`/`authenticated` **tidak** punya EXECUTE fungsi ini. Risiko residual.

---

## LOW RISK / TECH DEBT

### L1 — File login portal usang di root repo

`portal-login-route.ts` baris 7–12, 61–71: service role + fallback JWT `"kunci-rahasia-portal-warga-rt07-super-ketat"` + RPC `verifikasi_login_warga`. Bukan App Router (`app/api/...`). Tidak di-wire. Menyalin file ini ke route hidup = sesi lemah dan secret hardcoded.

### L2 — `lib/supabase.ts`

Klien anon browser. **Tidak ada import** di `*.ts`/`*.tsx`. Masih ada di pohon; satu import di Client Component mengembalikan pola “browser bicara ke PostgREST” yang H1–H4 butuhkan.

### L3 — `as any` jsPDF

`app/admin/warga/WargaAdminClient.tsx` baris 177, `AuditClient.tsx` 64, `KasAdminClient.tsx` 97: `(doc as any).lastAutoTable`. Bukan keamanan.

### L4 — Backup 07-09-2026 tertinggal di `public`

`warga_backup_070926` (685 baris, tanpa PK), `transaksi_sampah_backup_070926` (2 baris, tanpa PK). PII duplikat. RLS tanpa policy. Harus keluar dari schema terpapar API.

### L5 — Overload dan fungsi mati

`verifikasi_login_admin` live `SECURITY DEFINER` tanpa `search_path`; EXECUTE hanya service_role. Login produksi di `app/api/admin/login/route.ts` tidak wajib memakai RPC ini. `register_warga_baru` (H5) tidak dipanggil aplikasi.

### L6 — Pesan/salinan mengunci “RT 07”

Cron (`app/api/cron/notifikasi/route.ts` 67), email reset (`app/admin/lupa-sandi/page.tsx` 96–102). Multi-tenant copy-paste.

### L7 — Index tidak terpakai (advisor INFO)

`idx_transaksi_sampah_rt_warga`, `idx_transaksi_kurban_rt_warga`, `idx_sensus_rt_warga`, `idx_push_langganan_rt`, dll. Kontrak tenant sudah membuat index; query app belum memanfaatkannya konsisten, atau statistik masih dingin.

### L8 — `importWargaMassal` PIN default `123456`

`app/admin/warga/page.tsx` baris 168. Hash bcrypt, tetapi PIN lemah seragam. Bukan IDOR; akun impor mudah ditebak jika NIK bocor.

---

## Yang diperiksa dan **tidak** diangkat sebagai HIGH

Server Action mutasi yang dibaca (`warga`, `kas`, `sampah`, `kurban`, `ronda`, `inventaris`, `lapak`, `voting`, `lapor`, `pengumuman`, `ibu-ibu`, `keluarga`, `sensus`) memanggil `wajibOtentikasiAdmin` / `wajibOtentikasiWarga` / `otentikasiAdminAktif` lalu `.eq('rt_id', sesi.rtId)` atau `otorisasiWargaUntukAdmin` / `adminBolehMengaksesRt`. Contoh rapat: `app/portal/(terkunci)/ronda/page.tsx` 34–39; `app/portal/(terkunci)/lapak/page.tsx` 125–131, 167–176; `app/admin/kas/page.tsx` 67–77; `lib/verifikasi-carik-admin.ts` 136–145, 197–204.

`posyandu_balita` / `kunjungan_*` fail-closed di RLS; modul kunjungan hanya webmaster + env `LEGACY_POSYANDU_RT_ID` (`app/admin/ibu-ibu/page.tsx` 17–32, 74–80).

Tidak ada temuan “warga biasa mengedit biodata warga lain” di Server Action portal. Celah setara ada di **RLS** (H2, H3), bukan di handler Next yang ada sekarang.

---

## Matriks ringkas

| ID | Tema | Objek | Eksploitasi hari ini (1 RT) | Pecah saat RT ke-2 |
|---|---|---|---|---|
| H1 | Tenant leak Data API | etalase 3 tabel | Enumerasi etalase tenant tunggal | Ya, lintas-RT |
| H2 | Policy OR warisan | `warga`, `anggota_keluarga` | Butuh JWT Supabase authenticated | Ya |
| H3 | UPDATE kolom bebas | `warga` | Butuh JWT + klien update | Privilege escalation |
| H4 | Storage | `dokumen_warga` | Unggah anonim **sekarang** | SELECT bucket jika JWT bocor |
| H5 | RPC mati + LIMIT 1 | `register_warga_baru` | INSERT gagal RLS | Ya jika DEFINER/grant berubah |
| H6 | Tanpa `rt_id` | posyandu/pemilu | 0 baris | Ya |
| H7 | RPC duplikat | `proses_autodebet_kurban(int)` | Hanya service_role | Data tanpa tenant / search_path |
| M1 | SELECT suara | `suara_voting` | UI salah | Tetap |
| M2 | Kas se-RT | `kas_rt` | Tertahan filter app | Privasi intra-RT |
| M4 | service_role landing | `app/page.tsx:200` | Tertahan filter | Satu kueri = dump |
| M7 | GRANT TRUNCATE anon | backup + pengurus | Bukan lewat PostgREST | Jika role SQL salah |

---

## Catatan auditor (bukan rencana perbaikan)

Sesi ini tidak mengubah database atau kode. Temuan H1, H2, H4, H5 adalah yang paling mahal untuk ditunda: H4 sudah hidup di internet; H1/H2/H5 meledak pada tenant kedua atau pada perubahan grant/JWT yang tampak “kecil”.

**Kelemahan audit ini sendiri:** tidak menembak HTTP anon ke REST/Storage (hanya baca katalog policy); tidak membuktikan INSERT `anggota_keluarga` lintas-RT dengan JWT hasil `buatKlienTerautentikasi`; tidak mengaudit isi bucket `dokumen_warga`; tidak membaca `storage.objects` ACLs di luar `pg_policies`. Jumlah `master_rt = 1` membuat kebocoran lintas-RT belum teramati di data, hanya di predikat policy.
