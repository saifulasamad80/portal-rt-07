import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ambilEtalasePublik } from "@/lib/etalase-publik";
import { skemaBelumSiap } from "@/lib/arsip-warga";
import { type RekamanJiwa } from "@/lib/demografi-publik";
import { klienDanTenantPublik } from "@/lib/tenant-publik";
import { adalahGalatTipeUuid } from "@/lib/uuid-tenant";

export type BarisKasPublik = {
  tipe_transaksi: string;
  nominal: number;
  kategori?: string | null;
  keterangan?: string | null;
  tanggal_transaksi?: string | null;
  created_at?: string | null;
};

export type BarisKurbanPublik = {
  jenis_transaksi: string;
  nominal: number;
  warga_id: string | null;
};

export type BarisPosyanduBalitaPublik = {
  tanggal_kunjungan: string;
  imunisasi: string | null;
};

export type BarisPosyanduLansiaPublik = {
  tanggal_kunjungan: string;
};

export type LapakPublikLanding = {
  id: string;
  nama_usaha: string;
  kategori: string;
  deskripsi: string;
  foto_url: string;
};

export type MasterRtPublik = {
  nama_rt: string | null;
  nama_rw: string | null;
  kelurahan: string | null;
};

export type PengumumanPublik = {
  id: string;
  judul: string;
  deskripsi: string | null;
  link_dokumen: string | null;
  tanggal_publikasi: string | null;
};

export type VotingPublik = {
  id: string;
  judul: string;
  deskripsi: string | null;
  opsi_1: string;
  opsi_2: string;
  status: string;
  created_at: string;
};

export type RekapVotingPublik = VotingPublik & {
  statistik: {
    opsi_1_pct: number;
    opsi_2_pct: number;
    total: number;
  };
};

export type JumantikPublik = {
  jumlah_rumah_diperiksa: number | null;
  ditemukan_jentik: boolean | null;
  created_at: string | null;
};

export type SampahPublik = {
  berat_kg?: number | null;
  nominal_warga?: number | null;
  nominal_kas_rt?: number | null;
  tanggal_transaksi?: string | null;
};

export type MuatanLandingPublik = {
  pengumumanReguler: PengumumanPublik[];
  rekapVoting: RekapVotingPublik | null;
  kasData: BarisKasPublik[];
  sampahGlobal: SampahPublik[];
  jumantik: JumantikPublik | null;
  dataKurban: BarisKurbanPublik[];
  dataBalita: BarisPosyanduBalitaPublik[];
  dataLansia: BarisPosyanduLansiaPublik[];
  daftarFoto: Array<{
    id: string;
    judul: string;
    deskripsi: string | null;
    url_foto: string;
    kategori: string | null;
    tanggal_kegiatan: string | null;
  }>;
  daftarLapak: LapakPublikLanding[];
  daftarKontak: Array<{
    id: string;
    nama_layanan: string;
    nomor: string;
    keterangan: string | null;
    ikon: string | null;
    urutan: number;
  }>;
  masterRt: MasterRtPublik | null;
  dataDemografiReal: RekamanJiwa[];
};

function dataAtauKosong<T>(
  hasil: { data: unknown; error: { message?: string; code?: string } | null },
  cadangan: T,
  label: string,
): T {
  if (hasil.error) {
    const pesan = hasil.error.message || hasil.error.code || "";
    if (adalahGalatTipeUuid(pesan)) {
      console.error(`Portal publik galat tipe UUID pada ${label}:`, pesan);
      throw new Error(`Portal publik: filter UUID gagal pada ${label}`);
    }
    console.warn(`Portal publik gagal memuat ${label}:`, pesan);
    return cadangan;
  }
  return (hasil.data ?? cadangan) as T;
}

async function ambilDemografiSah(supabase: SupabaseClient, tenant: string) {
  const pilih =
    "id, rt_id, tanggal_lahir, jenis_kelamin, pekerjaan, anggota_keluarga(id, rt_id, tanggal_lahir, jenis_kelamin, pekerjaan)";
  const dasar = () =>
    supabase
      .from("warga")
      .select(pilih)
      .eq("status_verifikasi", "Disetujui")
      .eq("rt_id", tenant)
      .or(`rt_id.eq.${tenant}`, { foreignTable: "anggota_keluarga" });

  let hasil = await dasar().neq("status_aktif", false);
  if (hasil.error && skemaBelumSiap(hasil.error)) {
    hasil = await dasar();
  }
  if (hasil.error) {
    console.error("Portal publik gagal memuat demografi:", hasil.error.message || hasil.error.code);
    return [] as RekamanJiwa[];
  }
  return (hasil.data || []) as RekamanJiwa[];
}

async function ambilKurbanRt(supabase: SupabaseClient, tenant: string) {
  const { data, error } = await supabase
    .from("transaksi_kurban")
    .select("jenis_transaksi, nominal, warga_id")
    .eq("rt_id", tenant);
  return { data: (data || []) as BarisKurbanPublik[], error };
}

async function ambilKasRt(supabase: SupabaseClient, tenant: string) {
  const UKURAN = 1000;
  const semua: BarisKasPublik[] = [];
  let dari = 0;
  while (dari < 20000) {
    const { data, error } = await supabase
      .from("kas_rt")
      .select("tipe_transaksi, nominal, kategori, keterangan, tanggal_transaksi, created_at")
      .eq("rt_id", tenant)
      .order("created_at", { ascending: false })
      .range(dari, dari + UKURAN - 1);
    if (error) return { data: [], error };
    const batch = (data || []) as BarisKasPublik[];
    semua.push(...batch);
    if (batch.length < UKURAN) break;
    dari += UKURAN;
  }
  return { data: semua, error: null };
}

async function ambilKunjunganPosyanduRt<T>(
  supabase: SupabaseClient,
  tabel: "kunjungan_balita" | "kunjungan_lansia",
  kolom: string,
  tenant: string,
) {
  const UKURAN = 1000;
  const semua: T[] = [];
  let dari = 0;
  while (dari < 20000) {
    const { data, error } = await supabase
      .from(tabel)
      .select(kolom)
      .eq("rt_id", tenant)
      .order("tanggal_kunjungan", { ascending: false })
      .range(dari, dari + UKURAN - 1);
    if (error) return { data: [] as T[], error };
    const batch = (data || []) as T[];
    semua.push(...batch);
    if (batch.length < UKURAN) break;
    dari += UKURAN;
  }
  return { data: semua, error: null };
}

async function ambilRekapVoting(
  supabase: SupabaseClient,
  tenant: string,
  votingTerbaru: VotingPublik | null,
): Promise<RekapVotingPublik | null> {
  if (!votingTerbaru) return null;

  let tampilkan = false;
  if (votingTerbaru.status === "Aktif") {
    tampilkan = true;
  } else if (votingTerbaru.status === "Ditutup") {
    const selisihHari = Math.floor(
      (new Date().getTime() - new Date(votingTerbaru.created_at).getTime()) / (1000 * 3600 * 24),
    );
    if (selisihHari <= 7) tampilkan = true;
  }
  if (!tampilkan) return null;

  const { data: suaraRekap } = await supabase
    .from("suara_voting")
    .select("pilihan")
    .eq("rt_id", tenant)
    .eq("voting_id", votingTerbaru.id);
  const dataSuara = suaraRekap || [];
  const suaraOpsi1 = dataSuara.filter((s) => s.pilihan === votingTerbaru.opsi_1).length;
  const suaraOpsi2 = dataSuara.filter((s) => s.pilihan === votingTerbaru.opsi_2).length;
  const total = suaraOpsi1 + suaraOpsi2;
  return {
    ...votingTerbaru,
    statistik: {
      opsi_1_pct: total === 0 ? 0 : Math.round((suaraOpsi1 / total) * 100),
      opsi_2_pct: total === 0 ? 0 : Math.round((suaraOpsi2 / total) * 100),
      total,
    },
  };
}

export async function ambilMuatanLandingPublik(): Promise<MuatanLandingPublik> {
  const { supabase, tenant } = klienDanTenantPublik();

  const [
    pengumumanRes,
    votingTerbaruRes,
    kasRes,
    sampahRes,
    dataDemografiReal,
    jumantikRes,
    kurbanRes,
    balitaRes,
    lansiaRes,
    etalaseRes,
    lapakRes,
    masterRes,
  ] = await Promise.all([
    supabase
      .from("pengumuman_rt")
      .select("id, judul, deskripsi, link_dokumen, tanggal_publikasi")
      .eq("rt_id", tenant)
      .order("tanggal_publikasi", { ascending: false })
      .limit(7),
    supabase
      .from("voting_rt")
      .select("id, judul, deskripsi, opsi_1, opsi_2, status, created_at")
      .eq("rt_id", tenant)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    ambilKasRt(supabase, tenant),
    supabase
      .from("transaksi_sampah")
      .select("berat_kg, nominal_warga, nominal_kas_rt, tanggal_transaksi")
      .eq("rt_id", tenant)
      .ilike("jenis_transaksi", "%Setor%"),
    ambilDemografiSah(supabase, tenant),
    supabase
      .from("laporan_jumantik")
      .select("jumlah_rumah_diperiksa, ditemukan_jentik, created_at")
      .eq("rt_id", tenant)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    ambilKurbanRt(supabase, tenant),
    ambilKunjunganPosyanduRt<BarisPosyanduBalitaPublik>(
      supabase,
      "kunjungan_balita",
      "tanggal_kunjungan, imunisasi",
      tenant,
    ),
    ambilKunjunganPosyanduRt<BarisPosyanduLansiaPublik>(
      supabase,
      "kunjungan_lansia",
      "tanggal_kunjungan",
      tenant,
    ),
    ambilEtalasePublik(supabase),
    supabase
      .from("lapak_warga")
      .select("id, nama_usaha, kategori, deskripsi, foto_url")
      .eq("rt_id", tenant)
      .eq("status", "Aktif")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("master_rt").select("nama_rt, nama_rw, kelurahan").eq("id", tenant).maybeSingle(),
  ]);

  const votingTerbaru = votingTerbaruRes.error ? null : (votingTerbaruRes.data as VotingPublik | null);
  if (etalaseRes.error) console.warn("Portal publik gagal memuat etalase:", etalaseRes.error);

  return {
    pengumumanReguler: dataAtauKosong(pengumumanRes, [], "pengumuman"),
    rekapVoting: await ambilRekapVoting(supabase, tenant, votingTerbaru),
    kasData: dataAtauKosong(kasRes, [] as BarisKasPublik[], "kas"),
    sampahGlobal: dataAtauKosong(sampahRes, [], "bank sampah"),
    jumantik: jumantikRes.error ? null : (jumantikRes.data as JumantikPublik | null),
    dataKurban: dataAtauKosong(kurbanRes, [] as BarisKurbanPublik[], "dana kurban"),
    dataBalita: dataAtauKosong(balitaRes, [] as BarisPosyanduBalitaPublik[], "posyandu balita"),
    dataLansia: dataAtauKosong(lansiaRes, [] as BarisPosyanduLansiaPublik[], "posyandu lansia"),
    daftarFoto: etalaseRes.galeri,
    daftarLapak: dataAtauKosong(lapakRes, [] as LapakPublikLanding[], "lapak UMKM"),
    daftarKontak: etalaseRes.kontak,
    masterRt: (masterRes.error ? null : masterRes.data) as MasterRtPublik | null,
    dataDemografiReal,
  };
}
