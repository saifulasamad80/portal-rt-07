import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import WargaDetailClient from "./WargaDetailClient";
import {
  ambilStatusCarik,
  cariDuplikatWarga,
  hapusDuplikatPilihan,
  hapusKarenaNikTidakSesuai,
  simpanVerifikasiCarik,
  type AnggotaInput,
  type HasilCarik,
} from "@/lib/verifikasi-carik";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production"
);
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_VERIFIKASI_SAH = ["Disetujui", "Menunggu", "Ditolak"] as const;

type SesiAdmin = { nama?: string; role?: string; rt_id?: string };

async function otentikasiAdmin(): Promise<{ ok: true; sesi: SesiAdmin } | { ok: false; message: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) return { ok: false, message: "Sesi pengurus sudah berakhir. Silakan masuk kembali." };
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { ok: true, sesi: payload as SesiAdmin };
  } catch {
    return { ok: false, message: "Sesi tidak valid atau telah dimanipulasi. Silakan masuk kembali." };
  }
}

export default async function AdminWargaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idWarga } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) redirect("/admin");
  try {
    await jwtVerify(token, JWT_SECRET);
  } catch {
    redirect("/admin");
  }

  if (!POLA_UUID.test(idWarga)) redirect("/admin/warga");

  const supabase = getSupabaseAdminClient();
  const { data: wargaRes } = await supabase
    .from("warga")
    .select("*, anggota_keluarga(*)")
    .eq("id", idWarga)
    .maybeSingle();

  if (!wargaRes) redirect("/admin/warga");

  const [statusCarik, duplikat] = await Promise.all([
    ambilStatusCarik(supabase, idWarga),
    cariDuplikatWarga(supabase, {
      id: wargaRes.id,
      nik: wargaRes.nik,
      nama_lengkap: wargaRes.nama_lengkap,
      tanggal_lahir: wargaRes.tanggal_lahir,
    }),
  ]);

  async function aksiVerifikasiAkun(wargaId: string, statusBaru: string): Promise<HasilCarik> {
    "use server";
    try {
      const otentikasi = await otentikasiAdmin();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };
      if (!POLA_UUID.test(wargaId)) return { success: false, message: "ID warga tidak valid." };
      if (!STATUS_VERIFIKASI_SAH.includes(statusBaru as (typeof STATUS_VERIFIKASI_SAH)[number])) {
        return { success: false, message: `Status "${statusBaru}" tidak dikenali.` };
      }

      const klien = getSupabaseAdminClient();
      const { data: target, error: errTarget } = await klien
        .from("warga")
        .select("id, nik, nama_lengkap")
        .eq("id", wargaId)
        .maybeSingle();

      if (errTarget) return { success: false, message: `Gagal membaca warga: ${errTarget.message}` };
      if (!target) return { success: false, message: "Data warga sudah tidak ada." };

      const { error } = await klien.from("warga").update({ status_verifikasi: statusBaru }).eq("id", wargaId);
      if (error) return { success: false, message: `Gagal mengubah status akun: ${error.message}` };

      await klien.from("audit_log").insert([
        {
          aktor: otentikasi.sesi.nama || "pengurus",
          aksi: `Verifikasi Akun Warga: ${statusBaru}`,
          tabel_target: "warga",
          detail: `Status akun NIK ${target.nik} (${target.nama_lengkap}) menjadi ${statusBaru}`,
        },
      ]);

      return { success: true, message: `Status akun ${target.nama_lengkap} diubah menjadi ${statusBaru}.` };
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal saat mengubah status akun.";
      return { success: false, message: pesan };
    }
  }

  async function aksiEditBiodata(
    wargaId: string,
    dataBaru: Record<string, unknown>,
    anggota: AnggotaInput[]
  ): Promise<HasilCarik> {
    "use server";
    try {
      const otentikasi = await otentikasiAdmin();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };
      const klien = getSupabaseAdminClient();
      return await simpanVerifikasiCarik(
        klien,
        wargaId,
        dataBaru,
        anggota,
        "",
        otentikasi.sesi.nama || "pengurus",
        { hapusDuplikat: false, capCarik: false }
      );
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal saat menyimpan biodata.";
      return { success: false, message: pesan };
    }
  }

  async function aksiVerifikasiCarikPengurus(
    wargaId: string,
    dataBaru: Record<string, unknown>,
    anggota: AnggotaInput[],
    catatan: string
  ): Promise<HasilCarik> {
    "use server";
    try {
      const otentikasi = await otentikasiAdmin();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };
      const klien = getSupabaseAdminClient();
      return await simpanVerifikasiCarik(
        klien,
        wargaId,
        dataBaru,
        anggota,
        catatan || "Diverifikasi langsung oleh pengurus RT",
        otentikasi.sesi.nama || "pengurus"
      );
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal saat mencatat verifikasi carik.";
      return { success: false, message: pesan };
    }
  }

  async function aksiNikTidakSesuai(wargaId: string): Promise<HasilCarik> {
    "use server";
    try {
      const otentikasi = await otentikasiAdmin();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };
      const klien = getSupabaseAdminClient();
      const hasil = await hapusKarenaNikTidakSesuai(klien, wargaId, otentikasi.sesi.nama || "pengurus");
      if (hasil.success) hasil.arah = "/admin/warga";
      return hasil;
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal saat menghapus data.";
      return { success: false, message: pesan };
    }
  }

  async function aksiHapusDuplikat(idTarget: string): Promise<HasilCarik> {
    "use server";
    try {
      const otentikasi = await otentikasiAdmin();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };
      const klien = getSupabaseAdminClient();
      return await hapusDuplikatPilihan(klien, idTarget, idWarga, otentikasi.sesi.nama || "pengurus");
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal saat menghapus data kembar.";
      return { success: false, message: pesan };
    }
  }

  return (
    <WargaDetailClient
      warga={wargaRes}
      carik={statusCarik.ok ? statusCarik.data : null}
      duplikat={duplikat}
      aksiVerifikasiAkun={aksiVerifikasiAkun}
      aksiEdit={aksiEditBiodata}
      aksiVerifikasiCarik={aksiVerifikasiCarikPengurus}
      aksiNikTidakSesuai={aksiNikTidakSesuai}
      aksiHapusDuplikat={aksiHapusDuplikat}
    />
  );
}
