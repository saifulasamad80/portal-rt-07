"use server";

import {
  PESAN_PERSETUJUAN_CARIK,
  jumlahAnakDariTanggal,
  normalisasiPersetujuanLaporDiri,
} from "@/lib/kebijakan-privasi";
import { catatPersetujuanData } from "@/lib/persetujuan-data";
import { ambilRumahTanggaPortal } from "@/lib/rumah-tangga-warga";
import { otentikasiWargaAktif } from "@/lib/session-security";
import { getSupabaseAdminClientDariSesi } from "@/lib/supabase-server";

export async function aksiSimpanPersetujuanPortal(payload: unknown): Promise<{ success: boolean; message: string }> {
  try {
    const sesi = await otentikasiWargaAktif();
    if (!sesi.ok) return { success: false, message: sesi.message };
    const rumah = await ambilRumahTanggaPortal(sesi.sesi);
    if (rumah.adalahTanggungan) {
      return { success: false, message: "Izin rumah tangga diisi kepala keluarga." };
    }

    const klien = getSupabaseAdminClientDariSesi(sesi.sesi);
    const { data: anggota, error } = await klien
      .from("anggota_keluarga")
      .select("tanggal_lahir")
      .eq("warga_id", sesi.sesi.id)
      .eq("rt_id", sesi.sesi.rtId);
    if (error) return { success: false, message: "Data keluarga belum dapat dibaca." };

    const tanggal = (anggota || []).map((item) => String(item.tanggal_lahir || ""));
    const persetujuan = normalisasiPersetujuanLaporDiri(
      payload,
      tanggal.length,
      jumlahAnakDariTanggal(tanggal),
      { wajibKeuangan: false, pesanWajib: PESAN_PERSETUJUAN_CARIK }
    );
    if (!persetujuan.ok) return { success: false, message: persetujuan.message };

    const jejak = await catatPersetujuanData(klien, {
      wargaId: sesi.sesi.id,
      rtId: sesi.sesi.rtId,
      sumber: "portal",
      persetujuan: persetujuan.data,
      jumlahAnggota: tanggal.length,
      jumlahAnak: jumlahAnakDariTanggal(tanggal),
      aktorAudit: "Portal warga",
    });
    if (!jejak.ok) return { success: false, message: jejak.message };
    return { success: true, message: "Izin tercatat. Login dan layanan administrasi RT tetap jalan." };
  } catch (err: unknown) {
    console.error("Persetujuan portal gagal:", err instanceof Error ? err.message : err);
    return { success: false, message: "Izin belum dapat disimpan. Coba lagi nanti." };
  }
}
