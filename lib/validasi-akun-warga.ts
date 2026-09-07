import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { tutupTiketPendaftaranWarga } from "@/lib/kebijakan-sensus";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import {
  otorisasiWargaUntukAdmin,
  saringWargaTerotorisasi,
  wilayahMutasiWarga,
  type PengurusTerautentikasi,
} from "@/lib/session-security";

export const STATUS_VALIDASI_WARGA_SAH = ["Disetujui", "Ditolak", "Menunggu"] as const;

export type HasilValidasiAkunWarga = {
  success: boolean;
  message: string;
};

/**
 * Mengubah status_verifikasi (alias generated: status_validasi).
 * status_validasi tidak boleh di-update langsung.
 */
export async function prosesValidasiAkunWarga(
  supabase: SupabaseClient,
  sesi: PengurusTerautentikasi,
  idWarga: string,
  statusBaru: string,
  labelAksi: string
): Promise<HasilValidasiAkunWarga> {
  const statusBersih = String(statusBaru || "").trim();
  if (!STATUS_VALIDASI_WARGA_SAH.includes(statusBersih as (typeof STATUS_VALIDASI_WARGA_SAH)[number])) {
    return { success: false, message: `Status "${statusBersih}" tidak dikenali sistem.` };
  }

  const target = await otorisasiWargaUntukAdmin(supabase, sesi, idWarga);
  if (!target.ok) return { success: false, message: target.message };

  const wilayah = wilayahMutasiWarga(sesi, target.sesi.rtId);
  if (!wilayah.ok) return { success: false, message: wilayah.message };

  const supabasePrivileged = getSupabaseAdminClient();

  const { data: diperbarui, error } = await saringWargaTerotorisasi(
    supabasePrivileged.from("warga").update({
      status_verifikasi: statusBersih,
    }),
    target.sesi,
    wilayah.rtIdSaring
  )
    .select("id")
    .maybeSingle();

  if (error) return { success: false, message: `Gagal menyimpan status: ${error.message}` };
  if (!diperbarui) return { success: false, message: "Data warga berubah; muat ulang halaman." };

  const { error: errAudit } = await supabase.from("audit_log").insert([
    {
      aktor: sesi.nama,
      aksi: `${labelAksi}: ${statusBersih}`,
      tabel_target: "warga",
      detail: `Warga: ${target.sesi.nama} (NIK ${target.sesi.nik}) menjadi ${statusBersih}`,
      rt_id: wilayah.rtIdTulis,
    },
  ]);
  if (errAudit) console.error("Audit log validasi akun gagal dicatat:", errAudit.message);

  const tiket = await tutupTiketPendaftaranWarga(supabasePrivileged, idWarga, wilayah.rtIdTulis, statusBersih);
  if (tiket.error) console.error("Penutupan tiket pendaftaran gagal:", tiket.error);

  return {
    success: true,
    message: `${target.sesi.nama} berhasil ditandai sebagai ${statusBersih}.`,
  };
}
