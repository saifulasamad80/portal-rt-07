import "server-only";

import { cache } from "react";
import type { MasterRtPublik, PengumumanPublik } from "@/lib/landing-publik";
import { klienDanTenantPublik } from "@/lib/tenant-publik";
import { UUID_SENTINEL, uuidFormatSah } from "@/lib/uuid-tenant";

export type PengumumanPublikLengkap = {
  siaran: PengumumanPublik;
  masterRt: MasterRtPublik | null;
};

export const ambilPengumumanPublik = cache(async (idMentah: string): Promise<PengumumanPublikLengkap | null> => {
  if (!uuidFormatSah(idMentah)) return null;
  const { supabase, tenant } = klienDanTenantPublik();
  if (tenant === UUID_SENTINEL) return null;

  const [{ data: siaran, error }, { data: masterRt }] = await Promise.all([
    supabase
      .from("pengumuman_rt")
      .select("id, judul, deskripsi, link_dokumen, tanggal_publikasi")
      .eq("id", idMentah)
      .eq("rt_id", tenant)
      .maybeSingle(),
    supabase
      .from("master_rt")
      .select("nama_rt, nama_rw, kelurahan")
      .eq("id", tenant)
      .maybeSingle(),
  ]);

  if (error || !siaran) return null;
  return {
    siaran: siaran as PengumumanPublik,
    masterRt: (masterRt || null) as MasterRtPublik | null,
  };
});
