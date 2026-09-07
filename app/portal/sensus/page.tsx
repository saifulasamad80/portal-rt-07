import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { buatKlienTerautentikasi, getSupabaseAdminClientDariSesi } from "@/lib/supabase-server";
import { otentikasiWargaAktif } from "@/lib/session-security";
import SensusClient from "./SensusClient";
import {
  ambilStatusCarik,
  laporkanNikTidakSesuaiMandiri,
  simpanVerifikasiCarikMandiri,
  type AnggotaInput,
  type HasilCarik,
} from "@/lib/verifikasi-carik";

export default async function SensusPage() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");

  const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
  const statusCarik = await ambilStatusCarik(supabase, otentikasi.sesi.id, otentikasi.sesi.rtId);
  if (!statusCarik.ok) redirect("/login");
  if (statusCarik.data?.status_validasi === "Disetujui") {
    redirect("/portal/keluarga");
  }

  const { data: profilWarga, error: errProfil } = await supabase
    .from("warga")
    .select(`
      id,
      nik,
      nama_lengkap,
      tempat_lahir,
      tanggal_lahir,
      jenis_kelamin,
      agama,
      pekerjaan,
      no_whatsapp,
      status_tinggal,
      detail_alamat,
      pendapatan_bulanan,
      daya_listrik,
      anggota_keluarga (
        id,
        nik,
        rt_id,
        nama_lengkap,
        hubungan_keluarga,
        hubungan_detail,
        tanggal_lahir,
        tempat_lahir,
        jenis_kelamin,
        agama,
        pekerjaan
      )
    `)
    .eq("id", otentikasi.sesi.id)
    .eq("nik", otentikasi.sesi.nik)
    .eq("rt_id", otentikasi.sesi.rtId)
    .maybeSingle();

  if (errProfil) console.error("Profil sensus mandiri gagal dimuat:", errProfil.message);
  if (errProfil || !profilWarga) redirect("/login");

  // RLS sudah membatasi anggota ke rumah tangga sendiri. Baris warisan
  // lintas tenant atau tanpa rt_id tetap ditahan di sini; RPC atomik
  // mensyaratkan pengurus untuk memperbaikinya.
  const anggotaTerbaca = Array.isArray(profilWarga.anggota_keluarga)
    ? profilWarga.anggota_keluarga
    : [];
  if (anggotaTerbaca.some((anggota: { rt_id?: unknown }) => String(anggota.rt_id || "") !== otentikasi.sesi.rtId)) {
    console.error("Profil sensus memiliki anggota lintas tenant atau tanpa rt_id:", otentikasi.sesi.id);
    redirect("/login");
  }
  const profilAman = {
    ...profilWarga,
    anggota_keluarga: anggotaTerbaca.map((anggota: {
      id: string;
      nik: string | null;
      rt_id?: unknown;
      nama_lengkap: string | null;
      hubungan_keluarga: string | null;
      hubungan_detail: string | null;
      tanggal_lahir: string | null;
      tempat_lahir: string | null;
      jenis_kelamin: string | null;
      agama: string | null;
      pekerjaan: string | null;
    }) => ({
      id: anggota.id,
      nik: anggota.nik,
      nama_lengkap: anggota.nama_lengkap,
      hubungan_keluarga: anggota.hubungan_keluarga,
      hubungan_detail: anggota.hubungan_detail,
      tanggal_lahir: anggota.tanggal_lahir,
      tempat_lahir: anggota.tempat_lahir,
      jenis_kelamin: anggota.jenis_kelamin,
      agama: anggota.agama,
      pekerjaan: anggota.pekerjaan,
    })),
  };

  async function aksiSimpanCarik(
    biodata: Record<string, unknown>,
    anggota: AnggotaInput[],
    catatan: string
  ): Promise<HasilCarik> {
    "use server";
    try {
      const sesiAktif = await otentikasiWargaAktif();
      if (!sesiAktif.ok) return { success: false, message: sesiAktif.message };

      const klien = getSupabaseAdminClientDariSesi(sesiAktif.sesi);
      return await simpanVerifikasiCarikMandiri(
        klien,
        sesiAktif.sesi,
        biodata,
        anggota,
        catatan
      );
    } catch (err: unknown) {
      console.error("Server Action sensus mandiri gagal:", err instanceof Error ? err.name : "unknown");
      return { success: false, message: "Verifikasi belum dapat disimpan. Coba lagi nanti." };
    }
  }

  async function aksiNikTidakSesuai(): Promise<HasilCarik> {
    "use server";
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

  return (
    <SensusClient
      warga={profilAman}
      aksiSimpan={aksiSimpanCarik}
      aksiNikTidakSesuai={aksiNikTidakSesuai}
      modeRevisi={statusCarik.data?.status_validasi === "Menunggu"}
    />
  );
}
