import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { klienDanTenantPublik, resolveTenantPublik } from "@/lib/tenant-publik";
import { UUID_SENTINEL } from "@/lib/uuid-tenant";

export type EtalasePublik = {
  galeri: Array<{
    id: string;
    judul: string;
    deskripsi: string | null;
    url_foto: string;
    kategori: string | null;
    tanggal_kegiatan: string | null;
  }>;
  dokumen: Array<{
    id: string;
    judul: string;
    deskripsi: string | null;
    kategori: string | null;
    url_berkas: string;
    ukuran_berkas: string | null;
    tanggal_terbit: string | null;
  }>;
  kontak: Array<{
    id: string;
    nama_layanan: string;
    nomor: string;
    keterangan: string | null;
    ikon: string | null;
    urutan: number;
  }>;
  error: string | null;
};

const ETALASE_KOSONG: EtalasePublik = {
  galeri: [],
  dokumen: [],
  kontak: [],
  error: null,
};

/**
 * Satu-satunya DAL untuk etalase publik. Tenant selalu dari PUBLIC_RT_ID
 * di server, bukan query string atau payload klien. Klien opsional hanya
 * untuk berbagi koneksi SSR; ia tidak boleh membawa tenant lain.
 */
export async function ambilEtalasePublik(
  supabase?: SupabaseClient,
): Promise<EtalasePublik> {
  const tenant = resolveTenantPublik();
  if (tenant === UUID_SENTINEL) {
    return { ...ETALASE_KOSONG, error: "PUBLIC_RT_ID tidak valid" };
  }
  const klien = supabase ?? klienDanTenantPublik().supabase;

  const [galeriRes, dokumenRes, kontakRes] = await Promise.all([
    klien
      .from("galeri_kegiatan")
      .select("id, judul, deskripsi, url_foto, kategori, tanggal_kegiatan")
      .eq("rt_id", tenant)
      .eq("dipublikasikan", true)
      .order("urutan", { ascending: true })
      .order("tanggal_kegiatan", { ascending: false })
      .limit(8),
    klien
      .from("dokumen_publik_rt")
      .select("id, judul, deskripsi, kategori, url_berkas, ukuran_berkas, tanggal_terbit")
      .eq("rt_id", tenant)
      .eq("dipublikasikan", true)
      .order("urutan", { ascending: true })
      .order("tanggal_terbit", { ascending: false })
      .limit(8),
    klien
      .from("kontak_darurat_rt")
      .select("id, nama_layanan, nomor, keterangan, ikon, urutan")
      .eq("rt_id", tenant)
      .eq("aktif", true)
      .order("urutan", { ascending: true }),
  ]);

  const error = galeriRes.error || dokumenRes.error || kontakRes.error;
  if (error) {
    return {
      ...ETALASE_KOSONG,
      error: error.message || error.code || "Etalase publik gagal dimuat",
    };
  }

  return {
    galeri: (galeriRes.data || []) as EtalasePublik["galeri"],
    dokumen: (dokumenRes.data || []) as EtalasePublik["dokumen"],
    kontak: (kontakRes.data || []) as EtalasePublik["kontak"],
    error: null,
  };
}
