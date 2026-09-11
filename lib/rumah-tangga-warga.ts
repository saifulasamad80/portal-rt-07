import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { angkaPostgrest } from "@/lib/angka-postgrest";
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

export type JiwaCermin = {
  nama_lengkap: string;
  tanggal_lahir: string | null;
};

export type CerminRumahTangga = {
  rumah: RumahTanggaPortal;
  jumlahJiwa: number;
  iuranTerakhirPada: string | null;
  jiwa: JiwaCermin[];
  error: string | null;
};

export type BarisKasRumahTangga = {
  id: string;
  created_at: string;
  nominal: number;
  tipe_transaksi: string | null;
  kategori: string | null;
  keterangan: string | null;
};

const KOLOM_KARTU_KK = `
  id,
  nik,
  nama_lengkap,
  tempat_lahir,
  tanggal_lahir,
  jenis_kelamin,
  agama,
  pekerjaan,
  pendidikan,
  no_whatsapp,
  status_tinggal,
  detail_alamat,
  no_kk,
  hubungan_kk,
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
    pekerjaan,
    pendidikan
  )
`;

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

/** Baca kartu KK untuk dasbor. Tidak menulis kas, ronda, atau anggota. */
export async function ambilCerminRumahTangga(
  sesi: IdentitasRumahTangga
): Promise<CerminRumahTangga> {
  const rumah = await ambilRumahTanggaPortal(sesi);
  const gagal = (pesan: string): CerminRumahTangga => ({
    rumah,
    jumlahJiwa: 1,
    iuranTerakhirPada: null,
    jiwa: [],
    error: pesan,
  });

  const supabase = getSupabaseAdminClient();
  const [{ data: kepala, error: errKepala }, { data: anggotaRes, error: errAnggota }, { data: iuran, error: errIuran }] =
    await Promise.all([
      supabase
        .from("warga")
        .select("id, nama_lengkap, tanggal_lahir")
        .eq("id", rumah.kepalaId)
        .eq("rt_id", sesi.rtId)
        .maybeSingle(),
      supabase
        .from("anggota_keluarga")
        .select("nama_lengkap, tanggal_lahir, rt_id")
        .eq("warga_id", rumah.kepalaId)
        .eq("rt_id", sesi.rtId),
      supabase
        .from("kas_rt")
        .select("created_at")
        .eq("warga_id", rumah.kepalaId)
        .eq("rt_id", sesi.rtId)
        .eq("tipe_transaksi", "Pemasukan")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (errKepala || errAnggota || errIuran || !kepala?.id) {
    console.error(
      "Gagal membaca cermin rumah tangga:",
      errKepala?.message || errAnggota?.message || errIuran?.message || "kepala kosong"
    );
    return gagal("Data rumah tangga belum dapat dibaca.");
  }

  const anggota = (Array.isArray(anggotaRes) ? anggotaRes : []).filter(
    (baris) => String((baris as { rt_id?: unknown }).rt_id || "") === sesi.rtId
  );
  const jiwa: JiwaCermin[] = [
    {
      nama_lengkap: String(kepala.nama_lengkap || rumah.namaKepala || "Kepala keluarga"),
      tanggal_lahir: kepala.tanggal_lahir == null ? null : String(kepala.tanggal_lahir),
    },
    ...anggota.map((baris) => ({
      nama_lengkap: String((baris as { nama_lengkap?: unknown }).nama_lengkap || "Anggota keluarga"),
      tanggal_lahir:
        (baris as { tanggal_lahir?: unknown }).tanggal_lahir == null
          ? null
          : String((baris as { tanggal_lahir?: unknown }).tanggal_lahir),
    })),
  ];

  return {
    rumah,
    jumlahJiwa: jiwa.length,
    iuranTerakhirPada: iuran?.created_at ? String(iuran.created_at) : null,
    jiwa,
    error: null,
  };
}

export async function ambilProfilKartuKkRumahTangga(sesi: IdentitasRumahTangga) {
  const rumah = await ambilRumahTanggaPortal(sesi);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("warga")
    .select(KOLOM_KARTU_KK)
    .eq("id", rumah.kepalaId)
    .eq("rt_id", sesi.rtId)
    .maybeSingle();
  if (error) {
    console.error("Gagal membaca kartu KK rumah tangga:", error.message);
    return { rumah, profil: null, error: error.message };
  }
  return { rumah, profil: data, error: null };
}

export async function ambilRiwayatKasRumahTangga(sesi: IdentitasRumahTangga): Promise<{
  rumah: RumahTanggaPortal;
  riwayat: BarisKasRumahTangga[];
  error: string | null;
}> {
  const rumah = await ambilRumahTanggaPortal(sesi);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("kas_rt")
    .select("id, created_at, nominal, tipe_transaksi, kategori, keterangan")
    .eq("warga_id", rumah.kepalaId)
    .eq("rt_id", sesi.rtId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("Gagal membaca kas rumah tangga:", error.message);
    return { rumah, riwayat: [], error: error.message };
  }

  const riwayat = (Array.isArray(data) ? data : []).map((baris) => ({
    id: String(baris.id),
    created_at: String(baris.created_at),
    nominal: angkaPostgrest(baris.nominal),
    tipe_transaksi: baris.tipe_transaksi == null ? null : String(baris.tipe_transaksi),
    kategori: baris.kategori == null ? null : String(baris.kategori),
    keterangan: baris.keterangan == null ? null : String(baris.keterangan),
  }));
  return { rumah, riwayat, error: null };
}
