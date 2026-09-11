# DPIA — Portal RT (go-live 12 September 2026)

Dokumen ini adalah penilaian dampak pelindungan data menurut Pasal 34 UU 27/2022 untuk pemrosesan buku induk digital RT, termasuk data spesifik (keuangan rumah, data anak, kesehatan posyandu).

## 1. Pemrosesan yang dinilai

- Buku induk: NIK, KK, nama, alamat, WhatsApp, anggota keluarga.
- Opsional: pendapatan, daya listrik, foto KK, kunjungan posyandu.
- Operasional: iuran, surat, ronda, notifikasi.

Pengendali: pengurus RT untuk data warganya. Operator platform merawat skema, hosting, dan notifikasi.

## 2. Risiko

| Risiko | Tingkat | Mitigasi yang sudah di kode |
| --- | --- | --- |
| Pungut tanpa dasar | Tinggi | Notice + consent terekam; impor CSV mati |
| Data kesehatan tanpa izin | Tinggi | Tulis posyandu wajib izin kesehatan (+ wali anak) |
| Identitas di JWT/log | Sedang | NIK tidak di klaim JWT; audit memakai NIK tersamar |
| Salinan di laptop pengurus | Tinggi | Jejak ekspor PDF + label RAHASIA |
| Transfer luar negeri | Tinggi | Notice + konfirmasi OneSignal; Supabase di Singapore |
| Hapus tidak menembus cadangan | Sedang | TTL kotak sampah 30 hari; cadangan butuh permintaan operator |
| Reidentifikasi di halaman publik | Sedang | Agregat agama dan flag DBD individu tidak dipublikasikan |

## 3. Keputusan

Pemrosesan boleh jalan untuk go-live dengan syarat:

1. Lapor diri / Carik / portal / surat kertas memakai naskah versi 2026-09-12.
2. Posyandu individu tidak dicatat tanpa izin kesehatan.
3. Permintaan hapus diproses lewat tiket pengurus dan kotak sampah 30 hari.
4. DPA bertanda tangan dengan Supabase, Vercel, dan OneSignal dilengkapi setelah go-live (daftar pemroses sudah tertulis).
5. Insiden mengikuti `docs/pdp-prosedur-insiden.md`.

## 4. Yang tidak ditutup dokumen ini

Penunjukan DPO orang sungguhan, pendaftaran PSE Kominfo, dan kontrak vendor bertanda tangan bukan artefak kode. Kontak pelindungan data operasional: pengurus RT.
