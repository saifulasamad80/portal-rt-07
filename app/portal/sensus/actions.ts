"use server";

import { cookies } from "next/headers";
import { getSupabaseAdminClientDariSesi } from "@/lib/supabase-server";
import { otentikasiWargaAktif } from "@/lib/session-security";
import type { AnggotaInput, HasilCarik } from "@/lib/verifikasi-carik";
import {
  laporkanNikTidakSesuaiMandiri,
  simpanVerifikasiCarikMandiri,
} from "@/lib/verifikasi-carik-server";

export async function aksiSimpanCarik(
  biodata: Record<string, unknown>,
  anggota: AnggotaInput[],
  catatan: string,
  persetujuan: unknown
): Promise<HasilCarik> {
  try {
    const sesiAktif = await otentikasiWargaAktif();
    if (!sesiAktif.ok) return { success: false, message: sesiAktif.message };

    const klien = getSupabaseAdminClientDariSesi(sesiAktif.sesi);
    return await simpanVerifikasiCarikMandiri(
      klien,
      sesiAktif.sesi,
      biodata,
      anggota,
      catatan,
      persetujuan
    );
  } catch (err: unknown) {
    console.error("Server Action sensus mandiri gagal:", err instanceof Error ? err.name : "unknown");
    return { success: false, message: "Verifikasi belum dapat disimpan. Coba lagi nanti." };
  }
}

export async function aksiNikTidakSesuai(): Promise<HasilCarik> {
  try {
    const sesiAktif = await otentikasiWargaAktif();
    if (!sesiAktif.ok) return { success: false, message: sesiAktif.message };

    const klien = getSupabaseAdminClientDariSesi(sesiAktif.sesi);
    const hasil = await laporkanNikTidakSesuaiMandiri(klien, sesiAktif.sesi);

    if (hasil.success) {
      const store = await cookies();
      store.delete("warga_session");
    }

    return hasil;
  } catch (err: unknown) {
    console.error("Server Action laporan NIK gagal:", err instanceof Error ? err.name : "unknown");
    return { success: false, message: "Laporan belum dapat diproses. Coba lagi nanti." };
  }
}
