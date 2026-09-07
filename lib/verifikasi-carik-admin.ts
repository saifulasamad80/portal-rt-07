import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { prosesHapusAtauArsipWarga } from "@/lib/arsip-warga";
import { adalahArsipPemilu, type HasilCarik } from "@/lib/verifikasi-carik";

import { POLA_UUID } from "@/lib/uuid-tenant";
export type SumberDuplikat = "warga" | "anggota_keluarga";

function teks(nilai: unknown) {
  return String(nilai ?? "").trim();
}

async function catatAudit(
  supabase: SupabaseClient,
  aktor: string,
  aksi: string,
  detail: string,
  rtId: string
) {
  const { error } = await supabase.from("audit_log").insert([
    { aktor, aksi, tabel_target: "warga", detail, rt_id: rtId },
  ]);
  if (error) console.error("Audit log administrasi Carik gagal:", error.message);
}

/** Kapabilitas destruktif khusus pengurus; jangan impor modul ini dari portal warga. */
export async function hapusKarenaNikTidakSesuai(
  supabase: SupabaseClient,
  wargaId: string,
  aktor: string
): Promise<HasilCarik> {
  if (!POLA_UUID.test(wargaId)) {
    return { success: false, message: "ID warga tidak valid." };
  }

  const { data: warga, error } = await supabase
    .from("warga")
    .select("id, nik, nama_lengkap, rt_id")
    .eq("id", wargaId)
    .maybeSingle();

  if (error) return { success: false, message: `Gagal membaca data warga: ${error.message}` };
  if (!warga) {
    return {
      success: true,
      message: "Data ini sudah tidak ada di buku induk. Silakan daftar ulang dengan NIK yang benar.",
      arah: "/register?alasan=nik-tidak-sesuai",
    };
  }

  const rtIdWarga = teks(warga.rt_id);
  if (!POLA_UUID.test(rtIdWarga)) {
    return { success: false, message: "Wilayah data warga belum valid. Penghapusan ditolak." };
  }

  const hasil = await prosesHapusAtauArsipWarga(supabase, wargaId, aktor);
  if (!hasil.success) return { success: false, message: hasil.message };

  await catatAudit(
    supabase,
    aktor,
    "Hapus Warga karena NIK Tidak Sesuai",
    `NIK ${warga.nik} (${warga.nama_lengkap}) dihapus/diarsipkan. Warga wajib lapor diri ulang dengan NIK yang benar.`,
    rtIdWarga
  );

  const tambahanArsip =
    hasil.mode === "arsip_pemilu"
      ? " Indeks pemilih e-voting tetap disimpan, tetapi akun portal ini tidak bisa dipakai lagi."
      : "";

  return {
    success: true,
    message: `Data lama dihapus karena NIK tidak sesuai.${tambahanArsip} Silakan daftar ulang dengan NIK yang tertera di KTP.`,
    arah: "/register?alasan=nik-tidak-sesuai",
  };
}

/**
 * Menghapus hanya kandidat yang saat eksekusi masih terbukti memakai NIK sama
 * dan berada di RT yang sama. Kesamaan nama/tanggal lahir tidak cukup kuat.
 */
export async function hapusDuplikatPilihan(
  supabase: SupabaseClient,
  idTarget: string,
  sumberTarget: unknown,
  idYangDitahan: string,
  aktor: string
): Promise<HasilCarik> {
  if (!POLA_UUID.test(idTarget) || !POLA_UUID.test(idYangDitahan)) {
    return { success: false, message: "ID warga tidak valid." };
  }
  if (sumberTarget !== "warga" && sumberTarget !== "anggota_keluarga") {
    return { success: false, message: "Sumber data kembar tidak valid." };
  }
  if (idTarget === idYangDitahan) {
    return { success: false, message: "Tidak bisa menghapus data yang sedang dibuka. Pilih data kembar yang lain." };
  }

  const { data: ditahan, error: errDitahan } = await supabase
    .from("warga")
    .select("id, nik, nama_lengkap, tanggal_lahir, rt_id")
    .eq("id", idYangDitahan)
    .maybeSingle();

  if (errDitahan) {
    console.error("Validasi data warga yang dipertahankan gagal:", errDitahan.message);
    return { success: false, message: "Data yang dipertahankan belum dapat diverifikasi." };
  }
  if (!ditahan || adalahArsipPemilu(ditahan)) {
    return { success: false, message: "Data yang dipertahankan tidak ditemukan atau bukan akun warga aktif." };
  }

  const nikDitahan = teks(ditahan.nik);
  const rtDitahan = teks(ditahan.rt_id);
  if (nikDitahan.length !== 16 || !POLA_UUID.test(rtDitahan)) {
    return { success: false, message: "Identitas data yang dipertahankan belum valid." };
  }

  if (sumberTarget === "warga") {
    const { data: targetWarga, error: errTargetWarga } = await supabase
      .from("warga")
      .select("id, nik, nama_lengkap, tanggal_lahir, rt_id")
      .eq("id", idTarget)
      .maybeSingle();

    if (errTargetWarga) {
      console.error("Validasi kandidat duplikat warga gagal:", errTargetWarga.message);
      return { success: false, message: "Kandidat data kembar belum dapat diverifikasi." };
    }
    if (!targetWarga) {
      return { success: false, message: "Kandidat data warga sudah tidak ada atau berubah." };
    }

    if (
      adalahArsipPemilu(targetWarga) ||
      teks(targetWarga.rt_id) !== rtDitahan ||
      teks(targetWarga.nik) !== nikDitahan
    ) {
      return {
        success: false,
        message: "Penghapusan ditolak: kandidat bukan duplikat NIK dalam RT yang sama. Kesamaan nama/tanggal lahir wajib diperiksa manual.",
      };
    }

    const hasil = await prosesHapusAtauArsipWarga(supabase, idTarget, aktor);
    if (!hasil.success) return { success: false, message: hasil.message };

    await catatAudit(
      supabase,
      aktor,
      "Hapus Data Warga Kembar",
      `Menghapus duplikat NIK terverifikasi ${idTarget}; data yang dipertahankan: ${idYangDitahan}.`,
      rtDitahan
    );

    return { success: true, message: hasil.message || "Data kembar berhasil dihapus." };
  }

  // Sumber sudah diikat oleh pemanggil dan divalidasi di atas. Jangan pernah
  // fallback ke tabel lain ketika ID tidak ditemukan: hal itu memungkinkan
  // UUID yang sama menghapus objek pada tabel yang bukan dipilih operator.
  const { data: targetAnggota, error: errTargetAnggota } = await supabase
    .from("anggota_keluarga")
    .select("id, nik, warga_id, rt_id")
    .eq("id", idTarget)
    .maybeSingle();

  if (errTargetAnggota) {
    console.error("Validasi kandidat duplikat anggota gagal:", errTargetAnggota.message);
    return { success: false, message: "Kandidat data kembar belum dapat diverifikasi." };
  }
  if (
    !targetAnggota ||
    teks(targetAnggota.nik) !== nikDitahan ||
    teks(targetAnggota.rt_id) !== rtDitahan
  ) {
    return { success: false, message: "Penghapusan ditolak: kandidat bukan duplikat NIK yang sah." };
  }

  const wargaIndukId = teks(targetAnggota.warga_id);
  const { data: wargaInduk, error: errInduk } = await supabase
    .from("warga")
    .select("id, rt_id")
    .eq("id", wargaIndukId)
    .maybeSingle();

  if (errInduk) {
    console.error("Validasi rumah tangga kandidat duplikat gagal:", errInduk.message);
    return { success: false, message: "Rumah tangga kandidat belum dapat diverifikasi." };
  }
  if (!wargaInduk || teks(wargaInduk.rt_id) !== rtDitahan) {
    return { success: false, message: "Penghapusan lintas RT ditolak." };
  }

  const { data: anggotaTerhapus, error: errHapusAnggota } = await supabase
    .from("anggota_keluarga")
    .delete()
    .eq("id", idTarget)
    .eq("warga_id", wargaIndukId)
    .eq("nik", nikDitahan)
    .eq("rt_id", rtDitahan)
    .select("id")
    .maybeSingle();

  if (errHapusAnggota) {
    console.error("Penghapusan duplikat anggota gagal:", errHapusAnggota.message);
    return { success: false, message: "Data anggota kembar gagal dihapus." };
  }
  if (!anggotaTerhapus) {
    return { success: false, message: "Data kandidat berubah; muat ulang sebelum mencoba lagi." };
  }

  await catatAudit(
    supabase,
    aktor,
    "Hapus Data Anggota Kembar",
    `Menghapus anggota dengan NIK duplikat terverifikasi ${idTarget}; data warga yang dipertahankan: ${idYangDitahan}.`,
    rtDitahan
  );

  return { success: true, message: "Data anggota kembar berhasil dihapus." };
}
