import { adalahArsipPemilu } from "@/lib/verifikasi-carik";

export type StatusAkunPortal = {
  status_verifikasi?: string | null;
  nama_lengkap?: string | null;
  tanggal_lahir?: string | null;
  nik?: string | null;
};

/**
 * Gerbang masuk portal mengikuti identitas (NIK + status verifikasi),
 * bukan flag buku induk `status_aktif`. Flag itu hanya menyembunyikan jiwa
 * yang sudah menempel di kartu KK agar tidak tampil sebagai KK kedua.
 * Arsip pemilu tetap ditolak.
 */
export function alasanTolakMasukPortal(akun: StatusAkunPortal): string | null {
  const verifikasi = String(akun.status_verifikasi || "").trim();
  if (verifikasi === "Menunggu") {
    return "Pendaftaran masih dalam antrean pengurus RT.";
  }
  if (verifikasi === "Ditolak") {
    return "Pendaftaran akun ini ditolak pengurus RT.";
  }
  if (adalahArsipPemilu(akun)) {
    return "Akun portal ini tidak aktif. Hubungi pengurus RT.";
  }
  if (verifikasi !== "Disetujui") {
    return "Status akun belum disetujui pengurus RT.";
  }
  return null;
}
