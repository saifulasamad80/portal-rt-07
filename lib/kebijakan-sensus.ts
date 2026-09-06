import type { SupabaseClient } from "@supabase/supabase-js";

export const BATAS_ANGGOTA_KELUARGA = 30;
export const PESAN_TINJAUAN_PENGURUS =
  "Data salah satu anggota sudah tercatat dan perlu diperiksa pengurus RT.";
export const JUDUL_PERMOHONAN_PERUBAHAN_KELUARGA = "Permohonan perubahan data keluarga";
export const JUDUL_TIKET_PENDAFTARAN = "Pendaftaran warga baru (Lapor Diri)";
export const STATUS_TIKET_TERBUKA = ["Menunggu", "Diproses"] as const;
export const PESAN_TANGGAPAN_IZINKAN_REVISI =
  "Revisi data keluarga diizinkan. Warga dapat mengisi ulang form Carik. NIK tetap terkunci.";

export function adalahTiketPerubahanKeluarga(judul: string | null | undefined): boolean {
  return String(judul || "").trim() === JUDUL_PERMOHONAN_PERUBAHAN_KELUARGA;
}

export function adalahTiketPendaftaranWarga(judul: string | null | undefined): boolean {
  return String(judul || "").trim() === JUDUL_TIKET_PENDAFTARAN;
}

export function statusTiketDariValidasiWarga(
  statusWarga: string
): "Selesai" | "Ditolak" | null {
  if (statusWarga === "Disetujui") return "Selesai";
  if (statusWarga === "Ditolak") return "Ditolak";
  return null;
}

export async function tutupTiketPendaftaranWarga(
  supabase: SupabaseClient,
  wargaId: string,
  rtId: string,
  statusWarga: string
): Promise<{ error: string | null; ditutup: number }> {
  const statusTiket = statusTiketDariValidasiWarga(statusWarga);
  if (!statusTiket) return { error: null, ditutup: 0 };

  const { data, error } = await supabase
    .from("laporan_warga")
    .update({
      status: statusTiket,
      tanggapan_rt: `Pendaftaran diproses menjadi ${statusWarga}.`,
    })
    .eq("warga_id", wargaId)
    .eq("rt_id", rtId)
    .eq("judul_laporan", JUDUL_TIKET_PENDAFTARAN)
    .in("status", [...STATUS_TIKET_TERBUKA])
    .select("id");

  if (error) return { error: error.message, ditutup: 0 };
  return { error: null, ditutup: Array.isArray(data) ? data.length : 0 };
}

export function tiketKeluargaMasihTerbuka(status: string | null | undefined): boolean {
  const isi = String(status || "Menunggu");
  return (STATUS_TIKET_TERBUKA as readonly string[]).includes(isi);
}

export function adalahCapCarikDisetujui(status: string | null | undefined): boolean {
  return String(status || "").trim() === "Disetujui";
}

export function adalahCapCarikMenunggu(status: string | null | undefined): boolean {
  return String(status || "").trim() === "Menunggu";
}

/**
 * NIK anggota ditampilkan terpotong di portal. Enam digit wilayah tetap
 * terbaca, sisanya disembunyikan agar cuplikan layar tidak membocorkan NIK utuh.
 */
export function samarkanNik(nik: string | null | undefined): string {
  const bersih = String(nik || "").replace(/\D/g, "");
  if (bersih.length !== 16) return "Tidak tercatat";
  return `${bersih.slice(0, 6)}******${bersih.slice(-4)}`;
}

export type IdentitasAnggotaTersimpan = {
  id: string;
  nik: string | null;
};

export type IdentitasAnggotaMasuk = {
  id?: string;
  nik: string;
};

export type HasilKebijakanAnggota =
  | { ok: true; nikBaru: string[] }
  | { ok: false };

/**
 * Keputusan kepemilikan murni, tanpa database dan tanpa data korban di hasil.
 * ID asing/stale dan perubahan NIK anggota lama sama-sama ditolak.
 */
export function periksaKepemilikanAnggota(
  anggotaLama: IdentitasAnggotaTersimpan[],
  anggotaMasuk: IdentitasAnggotaMasuk[]
): HasilKebijakanAnggota {
  const berdasarkanId = new Map(anggotaLama.map((anggota) => [anggota.id, anggota]));
  const idMasuk = new Set<string>();
  const nikBaru: string[] = [];

  for (const anggota of anggotaMasuk) {
    if (!anggota.id) {
      nikBaru.push(anggota.nik);
      continue;
    }

    if (idMasuk.has(anggota.id)) return { ok: false };
    idMasuk.add(anggota.id);

    const tersimpan = berdasarkanId.get(anggota.id);
    if (!tersimpan || tersimpan.nik !== anggota.nik) return { ok: false };
  }

  return { ok: true, nikBaru };
}
