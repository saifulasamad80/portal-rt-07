import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-server";

import { uuidTenantSah } from "@/lib/uuid-tenant";
const POLA_KODE_RUJUKAN = /^[a-z0-9][a-z0-9-]{1,31}$/;

export const PESAN_RT_REGISTRASI =
  "Pendaftaran belum tersedia untuk wilayah ini. Gunakan tautan rujukan dari pengurus RT.";

export type WilayahRegistrasi = {
  rtId: string;
  namaRt: string;
  namaRw: string;
  kodeRujukan: string;
};

export type HasilWilayahRegistrasi =
  | { ok: true; wilayah: WilayahRegistrasi }
  | { ok: false; message: string };

type BarisMasterRt = {
  id: string;
  nama_rt: string | null;
  nama_rw: string | null;
  kode_rujukan: string | null;
};

function uuidSah(nilai: string): boolean {
  return Boolean(uuidTenantSah(nilai));
}

function bentukWilayah(baris: BarisMasterRt | null): HasilWilayahRegistrasi {
  const rtId = String(baris?.id || "").trim();
  const kodeRujukan = String(baris?.kode_rujukan || "").trim().toLowerCase();
  if (!baris || !uuidSah(rtId) || !POLA_KODE_RUJUKAN.test(kodeRujukan)) {
    return { ok: false, message: PESAN_RT_REGISTRASI };
  }
  return {
    ok: true,
    wilayah: {
      rtId,
      namaRt: String(baris.nama_rt || "RT").trim() || "RT",
      namaRw: String(baris.nama_rw || "").trim(),
      kodeRujukan,
    },
  };
}

async function cariMasterRt(filter: { kolom: "id" | "kode_rujukan"; nilai: string }): Promise<HasilWilayahRegistrasi> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("master_rt")
    .select("id, nama_rt, nama_rw, kode_rujukan")
    .eq(filter.kolom, filter.nilai)
    .maybeSingle();
  if (error) {
    console.error("Pencarian wilayah registrasi gagal:", error.message);
    return { ok: false, message: PESAN_RT_REGISTRASI };
  }
  return bentukWilayah(data as BarisMasterRt | null);
}

function rtIdDariEnv(): string {
  return (process.env.REGISTRATION_RT_ID || process.env.PUBLIC_RT_ID || "").trim();
}

/**
 * Menentukan RT tujuan lapor diri publik.
 *
 * Urutan: `?rt=` (kode_rujukan atau UUID yang ada di master_rt) → env
 * REGISTRATION_RT_ID / PUBLIC_RT_ID. Kode URL yang tidak ketemu ditolak;
 * tidak boleh diam-diam jatuh ke env agar typo tidak mengikat ke RT lain.
 * Nilai dari browser tidak pernah ditulis ke rt_id tanpa lookup master_rt.
 */
export async function tetapkanRtRegistrasi(kodeUrl: unknown): Promise<HasilWilayahRegistrasi> {
  const kode = String(kodeUrl || "").trim().toLowerCase();
  if (kode) {
    if (uuidSah(kode)) return cariMasterRt({ kolom: "id", nilai: kode });
    if (POLA_KODE_RUJUKAN.test(kode)) return cariMasterRt({ kolom: "kode_rujukan", nilai: kode });
    return { ok: false, message: PESAN_RT_REGISTRASI };
  }

  const dariEnv = rtIdDariEnv();
  if (!uuidSah(dariEnv)) return { ok: false, message: PESAN_RT_REGISTRASI };
  return cariMasterRt({ kolom: "id", nilai: dariEnv });
}

/** Verifikasi ulang UUID terikat Server Action sebelum INSERT. */
export async function pastikanRtRegistrasiAda(rtIdMasukan: unknown): Promise<HasilWilayahRegistrasi> {
  const rtId = String(rtIdMasukan || "").trim();
  if (!uuidSah(rtId)) return { ok: false, message: PESAN_RT_REGISTRASI };
  return cariMasterRt({ kolom: "id", nilai: rtId });
}
