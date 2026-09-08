import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buatKlienTerautentikasi,
  getSupabaseAdminClientDariSesi,
} from "@/lib/supabase-server";
import {
  adminBolehMengaksesRt,
  otentikasiAdminAktif,
  otorisasiWargaUntukAdmin,
} from "@/lib/session-security";
import { prosesValidasiAkunWarga } from "@/lib/validasi-akun-warga";
import WargaDetailClient from "./WargaDetailClient";
import {
  type AnggotaInput,
  type HasilCarik,
} from "@/lib/verifikasi-carik";
import {
  ambilStatusCarik,
  cariDuplikatWarga,
  simpanVerifikasiCarik,
} from "@/lib/verifikasi-carik-server";
import {
  hapusDuplikatPilihan,
  hapusKarenaNikTidakSesuai,
} from "@/lib/verifikasi-carik-admin";
import { POLA_UUID } from "@/lib/uuid-tenant";
import { anggotaSamaWilayah } from "@/lib/normalisasi-warga";

export default async function AdminWargaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idWarga } = await params;

  if (!POLA_UUID.test(idWarga)) redirect("/admin/warga");

  const otentikasiHalaman = await otentikasiAdminAktif();
  if (!otentikasiHalaman.ok) redirect("/admin");

  const supabase = await buatKlienTerautentikasi(otentikasiHalaman.sesi);
  const { data: wargaRes, error: errWarga } = await supabase
    .from("warga")
    .select(`
      id,
      nik,
      nama_lengkap,
      no_whatsapp,
      status_tinggal,
      detail_alamat,
      tanggal_lahir,
      tempat_lahir,
      jenis_kelamin,
      agama,
      pekerjaan,
      pendapatan_bulanan,
      daya_listrik,
      status_verifikasi,
      ktp_path,
      kk_path,
      rt_id,
      anggota_keluarga (
        id,
        nik,
        nama_lengkap,
        hubungan_keluarga,
        hubungan_detail,
        tanggal_lahir,
        tempat_lahir,
        jenis_kelamin,
        agama,
        pekerjaan,
        rt_id
      )
    `)
    .eq("id", idWarga)
    .maybeSingle();

  if (errWarga) console.error("Detail warga gagal dimuat:", errWarga.message);
  if (errWarga || !wargaRes || !adminBolehMengaksesRt(otentikasiHalaman.sesi, wargaRes.rt_id)) {
    redirect("/admin/warga");
  }

  // RLS sudah membatasi relasi nested, tetapi baris warisan tanpa rt_id
  // atau lintas tenant tetap disaring di aplikasi sebelum dirender.
  const rtIdWarga = String(wargaRes.rt_id || "");
  if (!POLA_UUID.test(rtIdWarga)) {
    console.error("Detail warga ditolak karena tenant kepala keluarga tidak valid:", wargaRes.id);
    redirect("/admin/warga");
  }
  const anggotaKeluargaAman = (Array.isArray(wargaRes.anggota_keluarga)
    ? wargaRes.anggota_keluarga
    : []
  ).filter((anggota: { rt_id?: unknown }) => {
    if (anggotaSamaWilayah(anggota?.rt_id, rtIdWarga)) return true;
    console.error("Relasi anggota lintas RT disembunyikan dari detail warga:", wargaRes.id);
    return false;
  }).map((anggota: Record<string, unknown>) => ({
    id: String(anggota.id || ""),
    nik: anggota.nik == null ? null : String(anggota.nik),
    nama_lengkap: anggota.nama_lengkap == null ? null : String(anggota.nama_lengkap),
    hubungan_keluarga: anggota.hubungan_keluarga == null ? null : String(anggota.hubungan_keluarga),
    hubungan_detail: anggota.hubungan_detail == null ? null : String(anggota.hubungan_detail),
    tanggal_lahir: anggota.tanggal_lahir == null ? null : String(anggota.tanggal_lahir),
    tempat_lahir: anggota.tempat_lahir == null ? null : String(anggota.tempat_lahir),
    jenis_kelamin: anggota.jenis_kelamin == null ? null : String(anggota.jenis_kelamin),
    agama: anggota.agama == null ? null : String(anggota.agama),
    pekerjaan: anggota.pekerjaan == null ? null : String(anggota.pekerjaan),
  }));

  const [statusCarik, duplikat] = await Promise.all([
    ambilStatusCarik(supabase, idWarga, String(wargaRes.rt_id)),
    cariDuplikatWarga(supabase, {
      id: wargaRes.id,
      nik: wargaRes.nik,
      nama_lengkap: wargaRes.nama_lengkap,
      tanggal_lahir: wargaRes.tanggal_lahir,
      rt_id: String(wargaRes.rt_id),
    }),
  ]);

  const wargaUntukKlien = {
    id: wargaRes.id,
    nik: wargaRes.nik,
    nama_lengkap: wargaRes.nama_lengkap,
    no_whatsapp: wargaRes.no_whatsapp,
    status_tinggal: wargaRes.status_tinggal,
    detail_alamat: wargaRes.detail_alamat,
    tanggal_lahir: wargaRes.tanggal_lahir,
    tempat_lahir: wargaRes.tempat_lahir,
    jenis_kelamin: wargaRes.jenis_kelamin,
    agama: wargaRes.agama,
    pekerjaan: wargaRes.pekerjaan,
    pendapatan_bulanan: wargaRes.pendapatan_bulanan,
    daya_listrik: wargaRes.daya_listrik,
    status_verifikasi: wargaRes.status_verifikasi,
    ktp_path: wargaRes.ktp_path,
    kk_path: wargaRes.kk_path,
    anggota_keluarga: anggotaKeluargaAman,
  };

  async function aksiVerifikasiAkun(statusBaru: string): Promise<HasilCarik> {
    "use server";
    try {
      const otentikasi = await otentikasiAdminAktif();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };
      const klien = await buatKlienTerautentikasi(otentikasi.sesi);
      const hasil = await prosesValidasiAkunWarga(
        klien,
        otentikasi.sesi,
        idWarga,
        statusBaru,
        "Verifikasi Akun Warga"
      );
      if (hasil.success) revalidatePath("/");
      return hasil;
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal saat mengubah status akun.";
      return { success: false, message: pesan };
    }
  }

  async function aksiEditBiodata(
    dataBaru: Record<string, unknown>,
    anggota: AnggotaInput[]
  ): Promise<HasilCarik> {
    "use server";
    try {
      const otentikasi = await otentikasiAdminAktif();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };
      const klien = await buatKlienTerautentikasi(otentikasi.sesi);
      const target = await otorisasiWargaUntukAdmin(klien, otentikasi.sesi, idWarga);
      if (!target.ok) return { success: false, message: target.message };

      const hasil = await simpanVerifikasiCarik(
        klien,
        target.sesi.id,
        dataBaru,
        anggota,
        "",
        otentikasi.sesi.nama,
        { capCarik: false }
      );
      if (hasil.success) revalidatePath("/");
      return hasil;
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal saat menyimpan biodata.";
      return { success: false, message: pesan };
    }
  }

  async function aksiVerifikasiCarikPengurus(
    dataBaru: Record<string, unknown>,
    anggota: AnggotaInput[],
    catatan: string
  ): Promise<HasilCarik> {
    "use server";
    try {
      const otentikasi = await otentikasiAdminAktif();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };
      const klien = await buatKlienTerautentikasi(otentikasi.sesi);
      const target = await otorisasiWargaUntukAdmin(klien, otentikasi.sesi, idWarga);
      if (!target.ok) return { success: false, message: target.message };

      const hasil = await simpanVerifikasiCarik(
        klien,
        target.sesi.id,
        dataBaru,
        anggota,
        catatan || "Diverifikasi langsung oleh pengurus RT",
        otentikasi.sesi.nama
      );
      if (hasil.success) revalidatePath("/");
      return hasil;
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal saat mencatat verifikasi carik.";
      return { success: false, message: pesan };
    }
  }

  async function aksiNikTidakSesuai(): Promise<HasilCarik> {
    "use server";
    try {
      const otentikasi = await otentikasiAdminAktif();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };
      const klien = await buatKlienTerautentikasi(otentikasi.sesi);
      const target = await otorisasiWargaUntukAdmin(klien, otentikasi.sesi, idWarga);
      if (!target.ok) return { success: false, message: target.message };

      const hasil = await hapusKarenaNikTidakSesuai(
        getSupabaseAdminClientDariSesi(otentikasi.sesi),
        target.sesi.id,
        otentikasi.sesi.nama
      );
      if (hasil.success) {
        revalidatePath("/");
        hasil.arah = "/admin/warga";
      }
      return hasil;
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal saat menghapus data.";
      return { success: false, message: pesan };
    }
  }

  async function aksiHapusDuplikat(idTarget: string, sumberTarget: unknown): Promise<HasilCarik> {
    "use server";
    try {
      const otentikasi = await otentikasiAdminAktif();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };
      const klien = await buatKlienTerautentikasi(otentikasi.sesi);
      const targetDipertahankan = await otorisasiWargaUntukAdmin(klien, otentikasi.sesi, idWarga);
      if (!targetDipertahankan.ok) {
        return { success: false, message: targetDipertahankan.message };
      }

      const hasil = await hapusDuplikatPilihan(
        getSupabaseAdminClientDariSesi(otentikasi.sesi),
        idTarget,
        sumberTarget,
        targetDipertahankan.sesi.id,
        otentikasi.sesi.nama
      );
      if (hasil.success) revalidatePath("/");
      return hasil;
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal saat menghapus data kembar.";
      return { success: false, message: pesan };
    }
  }

  return (
    <WargaDetailClient
      warga={wargaUntukKlien}
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
// Validasi Keamanan: Fungsi mendelegasikan pengecekan ke wilayahMutasiWarga dan saringWargaTerotorisasi di layer service.
