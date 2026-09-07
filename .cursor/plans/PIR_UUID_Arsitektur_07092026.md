# PIR — Kontrak Vanity UUID `rt_id` (07 Sep 2026)

**Proyek live:** Supabase `jsprzayqrjdbuuqretec` (Database-RT-07).  
**Aturan dokumen ini:** hanya fakta dari log eksekusi agen pada sesi chat ini. Bukan tebakan, bukan “seharusnya sudah jalan”.

**Batas bukti:**

- Transkrip JSONL sesi (`d880b6d0-3bdd-42f9-9601-1d0a4aef750d.jsonl`) **tidak menyimpan hasil tool MCP**. String `apply_migration` tidak muncul di payload asisten yang tersisa kecuali saat PIR ini memindai file itu.
- Bagian Fase 0 (backfill) dan sebagian besar Fase 1 (NOT NULL/trigger) terjadi **sebelum ringkasan percakapan**. Payload migrasi itu **tidak ada di log yang bisa saya kutip presisi di sini**. Saya **tidak** menuliskan nama migrasi, SQL UPDATE, atau disable-trigger yang tidak saya lihat berhasil di tool result.
- Yang bisa dikutip presisi: migrasi RLS + SELECT verifikasi + suntingan file yang saya kirim di kelanjutan sesi (setelah resume).

---

## 1. DATABASE TRANSACTIONS

Target MCP: `plugin-supabase-supabase` / `apply_migration` dan `execute_sql`. Semua ke `project_id = jsprzayqrjdbuuqretec`.

### 1.1 DDL yang saya eksekusi di kelanjutan sesi (log tool)

| Nama migrasi MCP | Isi yang dikirim | Hasil log |
|---|---|---|
| `tenant_rls_policies_ledger` | `DROP/CREATE POLICY` pada `transaksi_sampah`, `transaksi_kurban` (pengurus + warga), `kas_rt`, `warga`, `pengumuman_rt`, `tabungan_kurban` memakai `klaim_baca_tenant` / `klaim_tulis_tenant` | **sukses** (`{"success":true}`) |
| `tenant_rls_policies_warga_ops` (percobaan 1) | Policy anggota/audit/ronda/voting dengan nama tabel **`sesi_voting` / `presensi_ronda` / `opsi_voting`** | **diblokir Auto-review**; di-retry dengan `requestSmartModeApproval` |
| `tenant_rls_policies_warga_ops` (percobaan 2, SQL disesuaikan ke file kanonik) | `anggota_keluarga`, `audit_log` (SELECT+INSERT), `jadwal_ronda`, `voting_rt`, `suara_voting` | **sukses** |
| `tenant_rls_policies_lapak_lapor` (percobaan 1) | Termasuk `DROP/CREATE` pada **`public.kunjungan_jumantik`** | **gagal** `ERROR 42P01: relation "public.kunjungan_jumantik" does not exist`. Tidak ada kebijakan yang terpasang dari batch ini. |
| `tenant_rls_policies_sensus_push` | `limbah_ekonomis`, `arisan_transaksi` (pengurus + warga), `sensus_kesejahteraan` (pengurus + warga), `push_langganan` (warga), `pengurus_rt` SELECT | diblokir Auto-review, lalu **sukses** setelah approval |
| `tenant_rls_etalase_posyandu_evoting` | Etalase: `galeri_kegiatan` / `dokumen_publik_rt` / `kontak_darurat_rt` `USING (dipublikasikan/aktif AND rt_id IS NOT NULL)`; drop policy bebas pada `laporan_posyandu`; ganti `pemilihan_rt` / `kandidat_rt` ke `adalah_pengurus()` | diblokir Auto-review, lalu **sukses** setelah approval |
| `tenant_rls_policies_lapak_lapor` (percobaan 2, nama tabel dari `tenant-rt-id-rls-etalase.sql`) | `lapak_warga`, `laporan_warga`, `master_inventaris`, `peminjaman_inventaris`, **`laporan_jumantik`**, `arisan_ibu` | diblokir Auto-review, lalu **sukses** setelah approval |

Saya **tidak** menjalankan `DROP POLICY` / `CREATE POLICY` di luar daftar di atas pada kelanjutan ini.

### 1.2 DML yang saya eksekusi di kelanjutan sesi

**Tidak ada.** Tidak ada `UPDATE` / `INSERT` / `DELETE` data operasional yang saya kirim lewat MCP di kelanjutan ini. Tidak ada backfill Budi, tidak ada stempel `master_rt LIMIT 1`, tidak ada disable trigger `audit_log`.

### 1.3 SELECT verifikasi yang saya jalankan (baca, bukan mutasi)

Setelah RLS di atas, saya menjalankan `execute_sql` berikut. Ini **bukan** bukti bahwa sayalah yang memasang NOT NULL/FK (itu bisa sudah ada sebelum kelanjutan), hanya keadaan live **saat SELECT ini kembali**.

**A. Nullability `rt_id` (kolom ada, `attnotnull`):**

`not_null = true` pada: `anggota_keluarga`, `arisan_ibu`, `arisan_transaksi`, `audit_log`, `dokumen_publik_rt`, `galeri_kegiatan`, `jadwal_ronda`, `kas_rt`, `kontak_darurat_rt`, `kunjungan_balita`, `kunjungan_lansia`, `lapak_warga`, `laporan_jumantik`, `laporan_warga`, `limbah_ekonomis`, `master_inventaris`, `peminjaman_inventaris`, `pengumuman_rt`, `pengurus_rt`, `posyandu_balita`, `posyandu_lansia`, `push_langganan`, `sensus_kesejahteraan`, `suara_voting`, `tabungan_kurban`, `transaksi_kurban`, `transaksi_sampah`, `voting_rt`, `warga`.

`not_null = false` pada backup: `transaksi_sampah_backup_070926`, `warga_backup_070926`. Saya tidak mengubah tabel backup.

**B. Policy RLS yang SELECT kembalikan (cuplikan yang relevan insiden kg):**

- `transaksi_sampah` / `Pengurus kelola sampah RT sendiri`: `USING klaim_baca_tenant(rt_id)`, `WITH CHECK klaim_tulis_tenant(rt_id)`.
- `transaksi_kurban` pengurus: sama. Warga: `warga_id = auth.uid() AND rt_id = dapatkan_rt_id_saya()`.
- Etalase publik: `dipublikasikan/aktif = true AND rt_id IS NOT NULL`.
- `laporan_posyandu` / `pemilihan_rt` / `kandidat_rt`: `adalah_pengurus()`, bukan `USING (true)` untuk anon.
- Satu sisa `USING (true)` yang SELECT temukan: `master_rt` / `Publik bisa melihat daftar RT untuk pendaftaran`.

**C. FK `*rt_id* → master_rt(id)`:** SELECT mengembalikan constraint pada tabel operasional di daftar A (termasuk `transaksi_kurban`, `sensus_kesejahteraan`, `arisan_transaksi`, `push_langganan`). Saya tidak menjalankan `ALTER TABLE ... ADD CONSTRAINT` di kelanjutan ini.

**D. Baris Budi (saat SELECT ini):**

| nama | jenis | berat_kg | punya_rt | cocok_warga |
|---|---|---|---|---|
| Budi Santoso | Setor | 5.00 | true | true |
| Budi Santoso | Tarik | 0.00 | true | true |

Saya **tidak** meng-UPDATE dua baris itu di kelanjutan ini. SELECT hanya mengonfirmasi `rt_id` sudah terisi dan sama dengan `warga.rt_id`.

### 1.4 Yang tidak boleh diklaim dari log saya

- Nama migrasi backfill Fase 0, isi `UPDATE ... FROM warga`, disable/enable trigger audit, `ALTER COLUMN rt_id SET NOT NULL`, `CREATE FUNCTION kunci_rt_id_*`, ganti `proses_autodebet_kurban`.
- Itu **bukan** “tidak terjadi di dunia nyata”. Itu **tidak ada di payload tool yang bisa saya kutip**. Jangan pakai PIR ini sebagai bukti SQL backfill.

---

## 2. CODEBASE MODIFICATIONS

Tidak ada `git commit` di sesi ini. Working tree tetap dirty.

### 2.1 File yang saya sunting di kelanjutan sesi (ada `StrReplace` / `Write` di log)

| File | Inti perubahan yang saya kirim |
|---|---|
| `app/page.tsx` | Import `@/lib/uuid-tenant`. `PUBLIC_RT_ID` lewat `uuidTenantSah`. `dataAtauKosong` **melempar** jika `adalahGalatTipeUuid`. Nested anggota tanpa cabang `rt_id.is.null`. `ambilKurbanRt` diganti ke `.eq("rt_id", rtId)` (bukan chunk `warga_id`). Query sampah publik tetap `.eq("rt_id", PUBLIC_RT_ID).ilike("jenis_transaksi", "%Setor%")` pada kolom teks. Percobaan `.eq(..., { foreignTable })` **gagal typecheck** (`Expected 2 arguments, but got 3`); dikembalikan ke `.or(\`rt_id.eq.${rtId}\`, { foreignTable: "anggota_keluarga" })`. |
| `app/admin/page.tsx` | KPI `transaksi_sampah` dan `transaksi_kurban` **selalu** `.eq("rt_id", sesi.rtId)` (webmaster tidak lagi menjumlahkan ledger tanpa filter). Helper `ambilKurbanCakupan` dihapus dari file ini. Judul dasbor webmaster diubah agar tidak mengklaim KPI global. Tipe `BarisKurbanDasbor` yang jadi yatim dihapus. |
| `app/admin/kurban/page.tsx` | `ambilSampahCakupan` / `ambilKurbanCakupan` menambah `.eq("rt_id", rtId)`. Insert `transaksi_kurban` menyertakan `rt_id: targetWarga.rt_id`. Cek saldo tarikan juga `.eq("rt_id", ...)`. |
| `app/portal/(terkunci)/sampah/page.tsx` | Select `transaksi_sampah` menambah `.eq("rt_id", wargaAktif.rtId)`. |
| `app/portal/(terkunci)/kurban/page.tsx` | Select `transaksi_kurban` menambah `.eq("rt_id", wargaAktif.rtId)`. |
| `app/admin/ibu-ibu/page.tsx` | `LEGACY_POSYANDU_RT_ID` lewat `uuidTenantSah`. Insert `arisan_transaksi` menyertakan `rt_id: sesi.rtId`. Hapus transaksi arisan memfilter `rt_id`. |
| `app/api/push/subscribe/route.ts` | Insert/update/delete `push_langganan` menyertakan/memfilter `rt_id: sesi.rtId`. |
| `lib/verifikasi-carik.ts` | Import `POLA_UUID` dipindah ke atas file. `tandaiSensus` wajib `rtId`; insert/update/select `sensus_kesejahteraan` memfilter/menyuntik `rt_id`. `ambilStatusCarik` menambah parameter `rtId`. |
| `lib/notifikasi-push.ts` | Push ke satu warga: lookup `warga.rt_id` lalu `.eq("rt_id")`. Siaran: `uuidTenantSah(rtId)` + `.eq("rt_id", rtBersih)` pada `push_langganan`. |
| `lib/session-security.ts` | `rt_id` sesi warga/pengurus dan `wilayahMutasiWarga` memakai `uuidTenantSah` (UUID nol ditolak), bukan hanya `POLA_UUID.test`. |
| `app/portal/(terkunci)/layout.tsx` | Cap Carik `.eq("rt_id", sesi.rtId)`. |
| `app/portal/(terkunci)/keluarga/page.tsx` | Select/cek `sensus_kesejahteraan` menambah `.eq("rt_id", ...)`. |
| `app/portal/page.tsx` | Status Carik menambah `.eq("rt_id", wargaAktif.rtId)`. |
| `app/portal/sensus/page.tsx` | `ambilStatusCarik(..., otentikasi.sesi.rtId)`. |
| `app/admin/warga/[id]/page.tsx` | Import helper UUID; `ambilStatusCarik(..., wargaRes.rt_id)`. |
| `app/admin/lapor/page.tsx` | Buka cap Carik memfilter `.eq("rt_id", rtIdTujuan)`. |
| `app/admin/ronda/page.tsx` | Ganti `const POLA_UUID` lokal ke import. **Bug yang saya buat:** import `session-security` terduplikasi; **saya perbaiki** di `StrReplace` berikutnya. |
| `app/admin/lapak/page.tsx` | Import `POLA_UUID` dari helper. |
| `app/admin/verifikasi/page.tsx` | sama |
| `app/admin/voting/page.tsx` | sama |
| `app/admin/pengurus/page.tsx` | sama |
| `app/portal/(terkunci)/lapak/page.tsx` | sama |
| `app/portal/(terkunci)/voting/page.tsx` | sama |
| `app/portal/(terkunci)/ronda/page.tsx` | sama |
| `warga-orphan-rt-id-backfill.sql` | `Write` menimpa isi: skrip lama `LIMIT 1 FROM master_rt` diganti `RAISE EXCEPTION` yang mengarahkan ke `tenant-rt-id-kontrak-wajib.sql`. **SQL ini tidak saya `apply_migration`-kan.** |

### 2.2 File di working tree yang **tidak** saya sunting di kelanjutan ini

`git status` menampilkan mereka modified/untracked, tetapi **tidak ada** `StrReplace`/`Write` dari saya setelah resume:

- `lib/uuid-tenant.ts` (untracked)
- `tenant-rt-id-kontrak-wajib.sql` (untracked)
- `tenant-rt-id-rls-etalase.sql` (untracked)
- `app/admin/sampah/page.tsx`
- `app/admin/inventaris/page.tsx`
- `app/admin/warga/page.tsx`
- `lib/arsip-warga.ts`
- `lib/registrasi-tenant.ts`
- `lib/supabase-server.ts`
- `lib/validasi-akun-warga.ts`
- `lib/verifikasi-carik-admin.ts`

Saya **tidak** mengklaim isi diff file-file itu sebagai pekerjaan kelanjutan ini.

### 2.3 Verifikasi HTTP yang saya jalankan

- `PUBLIC_RT_ID` di `.env.local`: ada, panjang 36, berakhiran vanity `0007` (nilai penuh **tidak** disalin ke PIR).
- `curl http://127.0.0.1:3000/`: HTTP 200, kartu `Dialihkan dari TPA` = **5.0 kg**.
- `curl /admin`: 200. `/admin/sampah`, `/admin/kurban`: 307 ke `/admin`. `/portal/sampah`: 307 ke `/login`.
- Saya **tidak** login sebagai Budi atau pengurus; portal sampah dan KPI dasbor setelah sesi **tidak** diverifikasi interaktif.

---

## 3. LESSONS LEARNED / SOP BARU

Ini aturan yang **tertulis dari insiden yang benar-benar muncul di log sesi**, bukan katalog teoretis.

### 3.1 Nama objek database tidak boleh dikarang

Migrasi `kunjungan_jumantik` gagal `42P01`. Nama kanonik di repo adalah `laporan_jumantik`. SOP: sebelum `CREATE POLICY ... ON public.<tabel>`, `SELECT to_regclass('public.<tabel>')` atau salin **persis** dari `tenant-rt-id-rls-etalase.sql` / `\dt`. Satu nama salah menggagalkan **seluruh batch**.

### 3.2 Kolom `uuid` bukan teks

`ILIKE` / `~~*` / bungkus `%uuid%` pada `rt_id` menghasilkan `operator does not exist: uuid ~~*` atau `invalid input syntax for type uuid`. Filter tenant hanya `.eq` / `.in` (chunk 80). `ILIKE` hanya kolom teks (`jenis_transaksi`). `dataAtauKosong` **dilarang** menelan galat tipe UUID menjadi `[]` — itu yang membuat kartu 0.0 kg palsu sambil HTTP 200.

### 3.3 Jangan “perbaiki” angka 0 dengan `rt_id IS NULL`

`.or(rt_id.eq.X, rt_id.is.null)` pada permukaan publik mencampur orphan semua sejarah ke satu tenant. Kontrak: baris tanpa tenant tidak tampil, lalu diperbaiki di sumber (induk), bukan di query pembaca.

### 3.4 Satu pola UUID, vanity sah, UUID nol ditolak

Pola proyek: `8-4-4-4-12` hex (`POLA_UUID` di `lib/uuid-tenant.ts`). Dilarang regex RFC 4122 versi/varian — itu menolak `00000000-0000-0000-0000-000000000007`. Tenant key memakai `uuidTenantSah` (menolak `...0000`). Jangan salin regex baru di `page.tsx`.

### 3.5 `rt_id` ditulis dari induk/sesi, tidak dari payload klien

Insert ledger (`transaksi_kurban`, `arisan_transaksi`, `push_langganan`, `sensus_kesejahteraan`) wajib kolom `rt_id` dari baris `warga` yang sudah diotorisasi atau `sesi.rtId`. FormData/body tidak memilih tenant.

### 3.6 Webmaster bukan izin menulis `NULL`

Policy `adalah_webmaster()` tanpa `WITH CHECK rt_id IS NOT NULL` adalah lubang yang membuat setoran Budi yatim legal. Predikat tulis: `klaim_tulis_tenant` (NOT NULL + ada di `master_rt` + webmaster atau pengurus RT yang sama). KPI dasbor webmaster tetap `.eq("rt_id", sesi.rtId)` — antrean validasi global **bukan** alasan menjumlahkan kg seluruh baris.

### 3.7 Backfill `LIMIT 1 FROM master_rt` dilarang

File `warga-orphan-rt-id-backfill.sql` ditarik di working tree karena stempel tenant acak jika `master_rt` > 1. SOP backfill: dari **induk yang sudah NOT NULL** (`warga.rt_id`, dll.). Stempel unik hanya jika tepat satu `master_rt` **dan** seluruh `warga.rt_id` sama. `MIN(uuid)` juga dilarang (tipe uuid tidak punya `min` di Postgres versi ini — tercatat di ringkasan; **bukan** error yang saya reproduksi di kelanjutan ini).

### 3.8 Suntingan mekanis `POLA_UUID` merusak import

Saya merusak `app/admin/ronda/page.tsx` (import `session-security` dobel) saat mengganti konstanta lokal. SOP: ganti regex lokal dengan import, lalu **baca ulang 15 baris atas file** sebelum anggap selesai. Jangan hapus konstanta tetangga (`POLA_TANGGAL`, himpunan status) — itu kelas cacat yang sudah terjadi di giliran sebelumnya pada file lain.

### 3.9 API klien Supabase bukan tebakan

`.eq(kolom, nilai, { foreignTable })` ditolak TypeScript di versi proyek ini. Nested filter yang sudah terbukti: opsi `{ foreignTable }` pada `.or(...)`, seperti yang sudah dipakai demografi publik.

### 3.10 Modul baru — checklist wajib

Sebelum merge modul baru yang menyimpan baris operasional:

1. Kolom `rt_id uuid NOT NULL REFERENCES master_rt(id)`.
2. Trigger `BEFORE INSERT OR UPDATE`: jika ada `warga_id`, `NEW.rt_id` harus = `warga.rt_id`.
3. Policy pengurus: `klaim_baca_tenant` / `klaim_tulis_tenant`. Policy warga: equality `rt_id = dapatkan_rt_id_saya()`, tanpa cabang NULL.
4. Server Action: inject `rt_id` dari sesi/induk; gagal tertutup jika `uuidTenantSah` gagal.
5. Baca: `.eq("rt_id", ...)` di aplikasi **meski** RLS sudah ada (service_role di landing tidak dilindungi RLS).
6. Jangan buka `USING (true)` untuk anon kecuali katalog `master_rt` yang memang publik.
7. UAT empat permukaan: admin RT, webmaster (KPI per sesi), portal pemilik, landing `PUBLIC_RT_ID` — angka sama.

---

**Akhir PIR.** Klaim di luar §1.1, §1.3, §2.1, dan §2.3 bukan dari log tool saya pada kelanjutan sesi ini.
