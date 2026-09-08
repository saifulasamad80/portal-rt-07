import { redirect } from "next/navigation";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";
import { otentikasiWargaAktif } from "@/lib/session-security";
import { ambilStatusCarik } from "@/lib/verifikasi-carik-server";
import { anggotaSamaWilayah } from "@/lib/normalisasi-warga";
import SensusClient from "./SensusClient";

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

  // Nested anggota sudah terikat warga_id rumah tangga ini.
  // rt_id kosong = stempel warisan; UUID asing disembunyikan, bukan mengunci sesi.
  const anggotaMentah = Array.isArray(profilWarga.anggota_keluarga)
    ? profilWarga.anggota_keluarga
    : [];
  const anggotaTerbaca = anggotaMentah.filter((anggota: { rt_id?: unknown }) =>
    anggotaSamaWilayah(anggota.rt_id, otentikasi.sesi.rtId)
  );
  if (anggotaTerbaca.length !== anggotaMentah.length) {
    console.error("Profil sensus memiliki anggota lintas tenant; baris itu disembunyikan:", otentikasi.sesi.id);
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

  return (
    <SensusClient
      warga={profilAman}
      modeRevisi={statusCarik.data?.status_validasi === "Menunggu"}
    />
  );
}
