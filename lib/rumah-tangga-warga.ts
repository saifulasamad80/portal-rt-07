import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { adalahCapCarikDisetujui, adalahCapCarikMenunggu } from "@/lib/kebijakan-sensus";
import { POLA_UUID } from "@/lib/uuid-tenant";

export type IdentitasRumahTangga = {
  id: string;
  nik: string;
  rtId: string;
};

export type RumahTanggaPortal = {
  wargaId: string;
  kepalaId: string;
  adalahTanggungan: boolean;
  namaKepala: string | null;
};

export type CapCarikRumahTangga = {
  rumah: RumahTanggaPortal;
  capDisetujui: boolean;
  capMenunggu: boolean;
  error: string | null;
};

export async function ambilRumahTanggaPortal(
  sesi: IdentitasRumahTangga
): Promise<RumahTanggaPortal> {
  const dasar: RumahTanggaPortal = {
    wargaId: sesi.id,
    kepalaId: sesi.id,
    adalahTanggungan: false,
    namaKepala: null,
  };
  if (!POLA_UUID.test(sesi.id) || !POLA_UUID.test(sesi.rtId) || !/^\d{16}$/.test(sesi.nik)) {
    return dasar;
  }

  const supabase = getSupabaseAdminClient();
  const { data: sebagaiAnggota, error: errAnggota } = await supabase
    .from("anggota_keluarga")
    .select("warga_id")
    .eq("nik", sesi.nik)
    .eq("rt_id", sesi.rtId)
    .neq("warga_id", sesi.id)
    .limit(1)
    .maybeSingle();
  if (errAnggota) {
    console.error("Gagal membaca keanggotaan rumah tangga:", errAnggota.message);
    return dasar;
  }
  const kepalaId = String(sebagaiAnggota?.warga_id || "");
  if (!POLA_UUID.test(kepalaId)) return dasar;

  const { data: kepala, error: errKepala } = await supabase
    .from("warga")
    .select("id, nama_lengkap")
    .eq("id", kepalaId)
    .eq("rt_id", sesi.rtId)
    .maybeSingle();
  if (errKepala) {
    console.error("Gagal membaca kepala rumah tangga:", errKepala.message);
    return dasar;
  }
  if (!kepala?.id) return dasar;

  return {
    wargaId: sesi.id,
    kepalaId: String(kepala.id),
    adalahTanggungan: true,
    namaKepala: kepala.nama_lengkap == null ? null : String(kepala.nama_lengkap),
  };
}

export async function ambilCapCarikRumahTangga(
  sesi: IdentitasRumahTangga
): Promise<CapCarikRumahTangga> {
  const rumah = await ambilRumahTanggaPortal(sesi);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sensus_kesejahteraan")
    .select("id, status_validasi")
    .eq("warga_id", rumah.kepalaId)
    .eq("rt_id", sesi.rtId)
    .maybeSingle();

  if (error) {
    console.error("Gagal membaca carik rumah tangga:", error.message);
    return {
      rumah,
      capDisetujui: false,
      capMenunggu: false,
      error: "Status verifikasi keluarga belum dapat dibaca.",
    };
  }

  const status = data?.status_validasi == null ? null : String(data.status_validasi);
  return {
    rumah,
    capDisetujui: adalahCapCarikDisetujui(status),
    capMenunggu: adalahCapCarikMenunggu(status),
    error: null,
  };
}
