import bcrypt from "bcryptjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uuidTenantSah } from "@/lib/uuid-tenant";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { tandaiAktorHapus } from "@/lib/kotak-sampah";

export type HasilHapusWarga = {
  success: boolean;
  mode?: "hapus_permanen" | "arsip_pemilu" | "sudah_arsip" | "tidak_ditemukan" | "gagal";
  message: string;
};

export type ErrorSupabase =
  | { message?: string; code?: string; details?: string; hint?: string }
  | null
  | undefined;

export const TABEL_TURUNAN_WARGA = [
  "anggota_keluarga",
  "jadwal_ronda",
  "kas_rt",
  "lapak_warga",
  "laporan_warga",
  "limbah_ekonomis",
  "peminjaman_inventaris",
  "push_langganan",
  "sensus_kesejahteraan",
  "tabungan_kurban",
  "transaksi_kurban",
  "transaksi_sampah",
] as const;

/**
 * Nilai pengganti untuk kolom teks yang dikosongkan saat pengarsipan.
 *
 * Dipakai alih-alih NULL karena beberapa kolom di tabel `warga` (mis.
 * no_whatsapp) dideklarasikan NOT NULL. Menulis NULL ke kolom tersebut membuat
 * PostgreSQL menolak seluruh UPDATE dengan error 23502, sehingga pengarsipan
 * gagal total. Tanda "-" juga dipakai sebagai representasi "kosong" di ekspor
 * PDF Buku Induk, jadi tampilannya tetap konsisten.
 */
export const NILAI_ARSIP_TEKS = "-";
const TANGGAL_ARSIP = "1900-01-01";
const PESAN_ALAMAT_ARSIP =
  "Data personal dilepas. Indeks pemilih e-voting tetap utuh demi integritas surat suara.";

/**
 * Nilai cadangan per kolom, dipakai HANYA bila database menolak nilai yang
 * kita kirim (NOT NULL atau tipe tidak cocok). Sengaja dipisah per kolom
 * karena tipe datanya berbeda: kolom teks aman diisi "-", sedangkan
 * tanggal_lahir wajib berupa tanggal yang sah.
 */
const PENGGANTI_ANTI_NULL: Record<string, unknown> = {
  nama_lengkap: "Arsip Pemilih",
  no_whatsapp: NILAI_ARSIP_TEKS,
  detail_alamat: PESAN_ALAMAT_ARSIP,
  pekerjaan: NILAI_ARSIP_TEKS,
  tempat_lahir: NILAI_ARSIP_TEKS,
  ktp_path: NILAI_ARSIP_TEKS,
  kk_path: NILAI_ARSIP_TEKS,
  tanggal_lahir: TANGGAL_ARSIP,
};

// Kode PostgreSQL/PostgREST yang berarti "skema database belum sinkron dengan
// kode", bukan "data bermasalah". Contoh paling sering: migrasi
// wargaku-v2-push-ibu-soft-delete.sql belum dijalankan, sehingga kolom
// warga.status_aktif belum ada.
const KODE_SKEMA_BELUM_SIAP = new Set([
  "42703", // undefined_column
  "42P01", // undefined_table
  "PGRST202", // fungsi tidak ditemukan di schema cache
  "PGRST204", // kolom tidak ditemukan di schema cache
  "PGRST205", // tabel tidak ditemukan di schema cache
]);

const KODE_NOT_NULL = "23502"; // not_null_violation
const KODE_TIPE_TIDAK_COCOK = new Set([
  "22007", // invalid_datetime_format
  "22008", // datetime_field_overflow
  "22P02", // invalid_text_representation
  "22001", // string_data_right_truncation
]);

export function skemaBelumSiap(error: ErrorSupabase) {
  if (!error) return false;
  if (KODE_SKEMA_BELUM_SIAP.has(String(error.code || ""))) return true;

  const pesan = `${error.message || ""} ${error.details || ""} ${error.hint || ""}`.toLowerCase();
  if (/(column|relation|table)[\s\S]*?does not exist/.test(pesan)) return true;
  return pesan.includes("schema cache") || pesan.includes("could not find the");
}

/**
 * Menarik nama kolom yang disebut PostgreSQL/PostgREST di dalam pesan error.
 *
 * Menangani ketiga format yang dipakai di lapangan:
 *   - null value in column "no_whatsapp" of relation "warga" ...
 *   - column warga.status_aktif does not exist
 *   - Could not find the 'status_aktif' column of 'warga' in the schema cache
 */
export function namaKolomDariError(error: ErrorSupabase): string | null {
  if (!error) return null;
  const pesan = `${error.message || ""} ${error.details || ""} ${error.hint || ""}`;

  const berkutip = pesan.match(/column\s+["'`]([a-z0-9_]+)["'`]/i);
  if (berkutip) return berkutip[1];

  const schemaCache = pesan.match(/could not find the\s+["'`]?([a-z0-9_]+)["'`]?\s+column/i);
  if (schemaCache) return schemaCache[1];

  const berpunktuasi = pesan.match(/column\s+(?:[a-z0-9_]+\.)?([a-z0-9_]+)/i);
  if (berpunktuasi) return berpunktuasi[1];

  return null;
}

export function terkaitConstraintPemilu(error: ErrorSupabase) {
  if (!error) return false;

  // PENTING: kegagalan karena skema belum siap (mis. tabel
  // partisipasi_pemilihan belum dibuat) TIDAK boleh dianggap sebagai
  // constraint pemilu. Tanpa penjagaan ini, pesan error "relation
  // partisipasi_pemilihan does not exist" akan lolos lewat pencocokan kata
  // kunci di bawah dan membuat setiap permintaan hapus berubah menjadi arsip,
  // sehingga data personal warga dilepas tanpa alasan yang sah.
  if (skemaBelumSiap(error)) return false;

  // Pelanggaran NOT NULL berasal dari payload kita sendiri, bukan dari
  // proteksi e-voting. Menganggapnya "terkait pemilu" akan memicu percobaan
  // arsip berulang yang pasti gagal dengan alasan yang sama.
  if (String(error.code || "") === KODE_NOT_NULL) return false;

  const kode = String(error.code || "");
  const pesan = `${error.message || ""} ${error.details || ""} ${error.hint || ""}`.toLowerCase();

  // Kode error PostgreSQL untuk pelanggaran integritas (foreign key, check
  // constraint, atau RAISE EXCEPTION dari trigger kustom). Setelah semua
  // tabel turunan non-pemilu dibersihkan (lihat TABEL_TURUNAN_WARGA), satu-
  // satunya sumber pelanggaran yang mungkin tersisa saat menghapus baris
  // warga adalah relasi ke data e-voting (partisipasi_pemilihan/suara_pemilihan)
  // yang memang sengaja tidak pernah disentuh. Jadi kode-kode di bawah ini
  // AMAN dianggap "terkait pemilu" pada titik pemanggilan ini, apa pun nama
  // constraint atau trigger persisnya.
  const KODE_INTEGRITAS = new Set([
    "23503", // foreign_key_violation
    "23505", // unique_violation (index pemilih yang dikunci)
    "P0001", // raise_exception generik dari trigger kustom
    "55000", // object_not_in_prerequisite_state (sering dipakai trigger read-only)
    "0A000", // feature_not_supported (dipakai beberapa trigger "immutable")
  ]);
  if (KODE_INTEGRITAS.has(kode)) return true;

  const kataKunci = [
    "immutable",
    "partisipasi_pemilihan",
    "proteksi_evote",
    "pelanggaran protokol",
    "suara_pemilihan",
    "suara_voting",
    "foreign key",
    "violates",
    "tidak dapat dihapus",
    "tidak boleh dihapus",
    "tidak dapat diubah",
    "tidak boleh diubah",
    "dilarang dihapus",
    "dilarang diubah",
    "read-only",
    "read only",
    "restrict",
    "trigger",
  ];
  return kataKunci.some((kata) => pesan.includes(kata));
}

/**
 * Menjalankan query yang menyaring kolom status_aktif, lalu otomatis mengulang
 * memakai versi tanpa kolom tersebut bila migrasi
 * wargaku-v2-push-ibu-soft-delete.sql belum dijalankan.
 *
 * Tanpa penjagaan ini, error 42703 membuat `data` bernilai null dan `count`
 * bernilai 0, sehingga daftar warga tampak KOSONG dan statistik tampak NOL
 * tanpa satu pun pesan error yang terlihat oleh pengurus.
 */
export async function kueriFallbackStatusAktif<H extends { error: ErrorSupabase }>(
  denganFilterArsip: () => PromiseLike<H>,
  tanpaFilterArsip: () => PromiseLike<H>
): Promise<H> {
  const hasil = await denganFilterArsip();
  if (hasil.error && skemaBelumSiap(hasil.error)) {
    return tanpaFilterArsip();
  }
  return hasil;
}

export type HasilUpdateAdaptif = {
  ok: boolean;
  error?: ErrorSupabase;
  statusAktifTersedia: boolean;
  disesuaikan: string[];
  dilepas: string[];
};

/**
 * UPDATE tabel `warga` yang tahan terhadap perbedaan skema antar-lingkungan.
 *
 * Struktur tabel `warga` berbeda-beda antar instalasi RT (ada yang NOT NULL,
 * ada yang belum menjalankan migrasi terbaru), dan kode ini tidak bisa
 * mengetahuinya lebih dulu. Alih-alih menebak, fungsi ini belajar dari balasan
 * PostgreSQL dan memperbaiki payload-nya sendiri:
 *
 *   - kolom menolak NULL (23502)        -> diisi nilai pengganti yang sesuai tipe
 *   - tipe/panjang tidak cocok (22xxx)  -> diisi nilai pengganti yang sah
 *   - kolom belum ada di skema (42703)  -> dikeluarkan dari payload
 *
 * Setiap putaran dijamin memperkecil masalah (mengganti satu nilai atau
 * membuang satu kolom), sehingga loop selalu berhenti. Kolom yang benar-benar
 * tidak bisa dikosongkan dilaporkan lewat `dilepas` agar pengurus tahu data
 * mana yang masih tertinggal, bukan disembunyikan.
 */
export async function updateWargaAdaptif(
  supabase: SupabaseClient,
  wargaId: string,
  payloadAwal: Record<string, unknown>
): Promise<HasilUpdateAdaptif> {
  const payload: Record<string, unknown> = { ...payloadAwal };
  const disesuaikan: string[] = [];
  const dilepas: string[] = [];
  let statusAktifTersedia = true;

  // Batas atas = jumlah kolom + cadangan. Cukup untuk memperbaiki setiap
  // kolom satu kali tanpa pernah berputar tanpa akhir.
  const maksPercobaan = Object.keys(payloadAwal).length * 2 + 4;

  for (let percobaan = 0; percobaan < maksPercobaan; percobaan++) {
    const { error } = await supabase.from("warga").update(payload).eq("id", wargaId);
    if (!error) {
      return { ok: true, statusAktifTersedia, disesuaikan, dilepas };
    }

    const kolom = namaKolomDariError(error);
    const kode = String(error.code || "");

    // 1. Kolom belum ada di database: keluarkan dari payload.
    if (skemaBelumSiap(error)) {
      if (!kolom || !(kolom in payload)) {
        return { ok: false, error, statusAktifTersedia, disesuaikan, dilepas };
      }
      delete payload[kolom];

      if (kolom === "status_aktif") {
        // Akun tetap WAJIB kehilangan akses. status_verifikasi "Ditolak"
        // sudah ditolak oleh /api/warga/login, jadi dipakai sebagai
        // mekanisme pencabutan akses pengganti.
        statusAktifTersedia = false;
        payload.status_verifikasi = "Ditolak";
      } else {
        dilepas.push(kolom);
      }
      continue;
    }

    // 2. Kolom menolak NULL, atau nilai kita tidak cocok tipe/panjangnya.
    if (kode === KODE_NOT_NULL || KODE_TIPE_TIDAK_COCOK.has(kode)) {
      if (!kolom || !(kolom in payload)) {
        return { ok: false, error, statusAktifTersedia, disesuaikan, dilepas };
      }

      const pengganti = PENGGANTI_ANTI_NULL[kolom];
      if (pengganti !== undefined && payload[kolom] !== pengganti) {
        payload[kolom] = pengganti;
        if (!disesuaikan.includes(kolom)) disesuaikan.push(kolom);
        continue;
      }

      // Tidak ada nilai pengganti yang aman: biarkan kolom apa adanya
      // daripada menggagalkan seluruh pengarsipan.
      delete payload[kolom];
      if (!dilepas.includes(kolom)) dilepas.push(kolom);
      continue;
    }

    // 3. Kegagalan lain (trigger, foreign key, izin) bukan wewenang fungsi ini.
    return { ok: false, error, statusAktifTersedia, disesuaikan, dilepas };
  }

  return {
    ok: false,
    error: { message: "Batas percobaan penyesuaian skema tercapai saat mengarsipkan warga." },
    statusAktifTersedia,
    disesuaikan,
    dilepas,
  };
}

export type RingkasanWarga = {
  id: string;
  nama_lengkap: string | null;
  status_aktif: boolean | null;
  rt_id: string | null;
};

export type HasilAmbilWarga =
  | { ok: true; ditemukan: true; warga: RingkasanWarga; dukungStatusAktif: boolean }
  | { ok: true; ditemukan: false }
  | { ok: false; message: string };

/**
 * Membaca ringkasan satu warga secara defensif.
 *
 * Memakai maybeSingle() (bukan single()) supaya "baris tidak ada" dikembalikan
 * sebagai data null tanpa error, sehingga kita bisa membedakan tiga kondisi
 * yang sebelumnya tercampur menjadi satu pesan "Data warga tidak ditemukan":
 *   1. baris benar-benar tidak ada  -> ditemukan: false
 *   2. kolom status_aktif belum ada -> otomatis diulang tanpa kolom tersebut
 *   3. kegagalan database asli      -> ok: false berisi pesan sebenarnya
 */
export async function ambilRingkasanWarga(
  supabase: SupabaseClient,
  wargaId: string
): Promise<HasilAmbilWarga> {
  let dukungStatusAktif = true;

  let { data, error } = await supabase
    .from("warga")
    .select("id, nama_lengkap, status_aktif, rt_id")
    .eq("id", wargaId)
    .maybeSingle();

  if (error && skemaBelumSiap(error)) {
    dukungStatusAktif = false;
    ({ data, error } = await supabase
      .from("warga")
      .select("id, nama_lengkap, rt_id")
      .eq("id", wargaId)
      .maybeSingle());
  }

  if (error) {
    return { ok: false, message: `Gagal membaca data warga: ${error.message}` };
  }
  if (!data) {
    return { ok: true, ditemukan: false };
  }

  return {
    ok: true,
    ditemukan: true,
    dukungStatusAktif,
    warga: {
      id: String((data as Record<string, unknown>).id ?? wargaId),
      nama_lengkap: ((data as Record<string, unknown>).nama_lengkap as string) ?? null,
      status_aktif: dukungStatusAktif
        ? (((data as Record<string, unknown>).status_aktif as boolean) ?? null)
        : null,
      rt_id: ((data as Record<string, unknown>).rt_id as string) ?? null,
    },
  };
}

export async function bersihkanRelasiNonPemilu(
  supabase: SupabaseClient,
  wargaId: string,
  opsi?: { lewatiAnggotaKeluarga?: boolean }
) {
  const { data: lapakMilikWarga } = await supabase.from("lapak_warga").select("id").eq("warga_id", wargaId);
  if (lapakMilikWarga && lapakMilikWarga.length > 0) {
    const lapakIds = lapakMilikWarga.map((l: { id: string }) => l.id);
    await supabase.from("limbah_ekonomis").update({ teknisi_id: null }).in("teknisi_id", lapakIds);
  }

  const tabelTurunan = opsi?.lewatiAnggotaKeluarga
    ? TABEL_TURUNAN_WARGA.filter((tabel) => tabel !== "anggota_keluarga")
    : TABEL_TURUNAN_WARGA;

  const peringatan: string[] = [];
  for (const tabel of tabelTurunan) {
    const { error } = await supabase.from(tabel).delete().eq("warga_id", wargaId);
    if (error) {
      // Tabel/kolom yang belum ada di skema bukan kegagalan yang perlu
      // dilaporkan: memang tidak ada data turunan untuk dibersihkan.
      if (skemaBelumSiap(error) || terkaitConstraintPemilu(error)) continue;
      peringatan.push(`${tabel}: ${error.message}`);
    }
  }
  return peringatan;
}

async function hapusAnggotaUntukArsipPemilu(
  supabase: SupabaseClient,
  wargaId: string,
  rtId: string | null | undefined
): Promise<{ ok: true } | { ok: false; message: string }> {
  const rtSah = uuidTenantSah(rtId);
  if (!rtSah) {
    return { ok: false, message: "Wilayah RT warga tidak sah; arsip pemilu dibatalkan." };
  }

  const { error } = await supabase.rpc("hapus_anggota_tanpa_kotak_sampah", {
    p_warga_id: wargaId,
    p_rt_id: rtSah,
  });
  if (!error) return { ok: true };
  if (!skemaBelumSiap(error)) {
    return { ok: false, message: `Gagal melepas tanggungan untuk arsip pemilu: ${error.message}` };
  }

  const { error: errHapus } = await supabase
    .from("anggota_keluarga")
    .delete()
    .eq("warga_id", wargaId)
    .eq("rt_id", rtSah);
  if (errHapus && !skemaBelumSiap(errHapus)) {
    return { ok: false, message: `Gagal melepas tanggungan: ${errHapus.message}` };
  }

  const { error: errSampah } = await supabase
    .from("kotak_sampah")
    .delete()
    .eq("bundel_id", wargaId)
    .eq("rt_id", rtSah)
    .eq("tabel_asal", "anggota_keluarga")
    .is("dipulihkan_pada", null);
  if (errSampah && !skemaBelumSiap(errSampah)) {
    console.error("Gagal membersihkan sisa kotak sampah arsip pemilu:", errSampah.message);
  }
  return { ok: true };
}

export async function arsipkanWargaKarenaPemilu(
  supabase: SupabaseClient,
  wargaId: string,
  namaAsli: string | undefined,
  rtId?: string | null
): Promise<HasilHapusWarga> {
  let rtArsip = rtId ?? null;
  if (!uuidTenantSah(rtArsip)) {
    const ringkasan = await ambilRingkasanWarga(supabase, wargaId);
    if (ringkasan.ok && ringkasan.ditemukan) rtArsip = ringkasan.warga.rt_id;
  }

  const anggota = await hapusAnggotaUntukArsipPemilu(supabase, wargaId, rtArsip);
  if (!anggota.ok) {
    return { success: false, mode: "gagal", message: anggota.message };
  }

  if (uuidTenantSah(rtArsip)) {
    const { anonimkanKunjunganRumahTangga } = await import("@/lib/posyandu-kunjungan");
    await anonimkanKunjunganRumahTangga(supabase, {
      rtId: String(rtArsip),
      wargaId,
      aktor: "pengurus",
    });
  }

  await bersihkanRelasiNonPemilu(supabase, wargaId, { lewatiAnggotaKeluarga: true });

  const nikArsip = `99${wargaId.replace(/-/g, "").slice(0, 14)}`;
  const pinAcak = await bcrypt.hash(`${wargaId}-${Date.now()}`, 10);

  // SETIAP kolom diisi nilai cadangan sejak awal, tidak ada yang dikirim NULL.
  // Data warisan impor Excel banyak yang kolomnya masih kosong, dan sebagian
  // instalasi RT memasang NOT NULL pada kolom dokumen maupun tanggal_lahir,
  // sehingga NULL membuat UPDATE pertama ditolak 23502. Tanda "-" juga dipakai
  // sebagai representasi "kosong" di ekspor PDF Buku Induk, jadi tampilannya
  // tetap konsisten. updateWargaAdaptif kini hanya menjadi jaring pengaman
  // untuk kolom wajib lain yang belum terdaftar di PENGGANTI_ANTI_NULL.
  const payloadArsip: Record<string, unknown> = {
    status_aktif: false,
    nama_lengkap: "Arsip Pemilih",
    nik: nikArsip,
    no_whatsapp: NILAI_ARSIP_TEKS,
    ktp_path: NILAI_ARSIP_TEKS,
    kk_path: NILAI_ARSIP_TEKS,
    detail_alamat: PESAN_ALAMAT_ARSIP,
    pin: pinAcak,
    tanggal_lahir: TANGGAL_ARSIP,
    tempat_lahir: NILAI_ARSIP_TEKS,
    pekerjaan: NILAI_ARSIP_TEKS,
  };

  const hasil = await updateWargaAdaptif(supabase, wargaId, payloadArsip);

  if (!hasil.ok) {
    return {
      success: false,
      mode: "gagal",
      message: `Gagal mengarsipkan ${namaAsli || "warga"}: ${hasil.error?.message || "kesalahan tidak diketahui"}`,
    };
  }

  const catatan: string[] = [];
  if (!hasil.statusAktifTersedia) {
    catatan.push(
      "kolom status_aktif belum ada sehingga akses dicabut lewat status verifikasi; jalankan wargaku-v2-push-ibu-soft-delete.sql agar label arsip tampil benar"
    );
  }
  if (hasil.disesuaikan.length > 0) {
    catatan.push(`kolom wajib diisi tanda "-" karena database menolak nilai kosong: ${hasil.disesuaikan.join(", ")}`);
  }
  if (hasil.dilepas.length > 0) {
    catatan.push(`kolom berikut TIDAK bisa dikosongkan dan masih berisi data lama: ${hasil.dilepas.join(", ")}`);
  }
  const catatanTeknis = catatan.length > 0 ? ` (Catatan teknis: ${catatan.join("; ")}.)` : "";

  return {
    success: true,
    mode: "arsip_pemilu",
    message: `${namaAsli || "Warga"} tidak bisa dihapus permanen karena sudah tercatat di e-voting. Data personal dilepas, akun dinonaktifkan, dan indeks pemilih tetap disimpan.${catatanTeknis}`,
  };
}

async function catatAudit(
  supabase: SupabaseClient,
  aktor: string | undefined,
  aksi: string,
  detail: string,
  rtId: string | null
) {
  const rtSah = uuidTenantSah(rtId);
  if (!rtSah) {
    console.error("Audit log ditahan: rt_id tenant tidak sah.");
    return;
  }
  const { error } = await supabase.from("audit_log").insert([
    {
      aktor: aktor || "pengurus",
      aksi,
      tabel_target: "warga",
      detail,
      rt_id: rtSah,
    },
  ]);
  if (error) console.error("Audit log gagal dicatat:", error.message);
}

export async function prosesHapusAtauArsipWarga(
  supabase: SupabaseClient,
  wargaId: string,
  aktor?: string
): Promise<HasilHapusWarga> {
  if (!wargaId) {
    return { success: false, mode: "gagal", message: "ID warga wajib diisi." };
  }

  const ringkasan = await ambilRingkasanWarga(supabase, wargaId);

  if (!ringkasan.ok) {
    // Kegagalan database asli: tampilkan penyebab sebenarnya, jangan
    // menyamarkannya sebagai "data tidak ditemukan".
    return { success: false, mode: "gagal", message: ringkasan.message };
  }

  if (!ringkasan.ditemukan) {
    return {
      success: true,
      mode: "tidak_ditemukan",
      message: "Data warga ini sudah tidak ada di database (mungkin sudah dihapus sebelumnya). Daftar akan disegarkan.",
    };
  }

  const target = ringkasan.warga;
  const namaTarget = target.nama_lengkap || "Warga";
  const supabasePrivileged = getSupabaseAdminClient();

  if (target.status_aktif === false) {
    return {
      success: true,
      mode: "sudah_arsip",
      message: "Warga ini sudah dinonaktifkan sebelumnya karena terikat data pemilu.",
    };
  }

  // Satu-satunya jalur arsip di seluruh fungsi ini, agar SETIAP alur yang
  // mencoba mengarsipkan warga—baik karena partisipasi_pemilihan terdeteksi
  // lebih dulu, maupun karena hapus permanen gagal di tengah jalan—selalu
  // berakhir dengan Result Object bersih, tidak pernah melempar exception
  // mentah ke Vercel.
  const arsipkanDanCatat = async (): Promise<HasilHapusWarga> => {
    try {
      const hasil = await arsipkanWargaKarenaPemilu(
        supabasePrivileged,
        wargaId,
        namaTarget,
        target.rt_id
      );
      if (!hasil.success) return hasil;

      await catatAudit(
        supabasePrivileged,
        aktor,
        "Arsip Warga (Soft Delete / E-Voting)",
        `Data personal ${namaTarget} dilepas; indeks pemilih e-voting dipertahankan.`,
        target.rt_id
      );
      return hasil;
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        mode: "gagal",
        message: `Warga terikat data pemilu, namun gagal diarsipkan otomatis. Detail: ${pesan}`,
      };
    }
  };

  // head: true dihindari karena permintaan HEAD dibalas tanpa body: kode error
  // PostgREST (mis. 42P01 untuk tabel e-voting yang belum dibuat) hilang dan
  // errornya tiba sebagai objek kosong, sehingga skemaBelumSiap() maupun
  // terkaitConstraintPemilu() salah menilai. limit(1) menjaga payload ringan.
  const { count: jumlahPartisipasi, error: errPartisipasi } = await supabase
    .from("partisipasi_pemilihan")
    .select("warga_id", { count: "exact" })
    .eq("warga_id", wargaId)
    .limit(1);

  // Tabel e-voting yang belum dibuat berarti "belum ada riwayat memilih",
  // sehingga hapus permanen tetap boleh dilanjutkan.
  if (errPartisipasi && !skemaBelumSiap(errPartisipasi) && terkaitConstraintPemilu(errPartisipasi)) {
    return arsipkanDanCatat();
  }

  if ((jumlahPartisipasi || 0) > 0) {
    return arsipkanDanCatat();
  }

  try {
    if (target.rt_id) {
      const { anonimkanKunjunganRumahTangga } = await import("@/lib/posyandu-kunjungan");
      await anonimkanKunjunganRumahTangga(supabasePrivileged, {
        rtId: String(target.rt_id),
        wargaId,
        aktor: aktor || "pengurus",
      });
    }
    await bersihkanRelasiNonPemilu(supabasePrivileged, wargaId);

    const { error: errHapus } = await supabasePrivileged.from("warga").delete().eq("id", wargaId);
    if (errHapus) {
      // Titik ini adalah satu-satunya tempat baris "warga" benar-benar
      // dihapus. Setelah semua tabel turunan non-pemilu sudah dibersihkan,
      // kegagalan di sini hampir pasti berasal dari trigger/constraint
      // e-voting, jadi paling aman diselesaikan dengan mengarsipkan warga.
      // Kegagalan karena skema belum siap dilaporkan apa adanya supaya
      // pengurus tahu migrasi mana yang belum dijalankan.
      if (skemaBelumSiap(errHapus)) {
        return {
          success: false,
          mode: "gagal",
          message: `Struktur database belum sesuai: ${errHapus.message}`,
        };
      }
      return arsipkanDanCatat();
    }

    // Baris warga sudah pasti terhapus di titik ini. Pencatatan audit log
    // hanyalah pelengkap—kegagalannya tidak boleh mengubah status akhir
    // menjadi gagal atau memicu percobaan arsip pada baris yang sudah hilang.
    await tandaiAktorHapus(
      supabasePrivileged,
      wargaId,
      target.rt_id || "",
      aktor || "pengurus",
      "hapus_warga"
    );

    await catatAudit(
      supabasePrivileged,
      aktor,
      "Hapus Warga",
      `Memindahkan ${namaTarget} ke kotak sampah (tidak terikat pemilu).`,
      target.rt_id
    );

    return {
      success: true,
      mode: "hapus_permanen",
      message: `${namaTarget} dipindah ke kotak sampah. Pengurus bisa memulihkannya dari menu Kotak Sampah.`,
    };
  } catch (err: unknown) {
    // Jaring pengaman terakhir: exception tak terduga (bukan objek error
    // Supabase biasa) selama proses hapus tetap difallback ke arsip.
    if (skemaBelumSiap(err as ErrorSupabase)) {
      const pesan = err instanceof Error ? err.message : String(err);
      return { success: false, mode: "gagal", message: `Struktur database belum sesuai: ${pesan}` };
    }
    return arsipkanDanCatat();
  }
}
