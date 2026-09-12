import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { skemaBelumSiap } from "@/lib/arsip-warga";
import { izinKesehatanRumahTangga } from "@/lib/persetujuan-data";
import {
  KUNCI_JIWA_KEPALA,
  angkaKunjunganOpsional,
  anggotaIdDariKunciJiwa,
  jiwaLayakPosyanduBalita,
  jiwaLayakPosyanduLansia,
  tanggalKunjunganSah,
  type BarisKunjunganBalita,
  type BarisKunjunganLansia,
  type KartuIzinPosyandu,
  type JiwaPosyandu,
} from "@/lib/posyandu-aturan";
import { POLA_UUID } from "@/lib/uuid-tenant";

export type { BarisKunjunganBalita, BarisKunjunganLansia, KartuIzinPosyandu, JiwaPosyandu };

export type HasilPosyandu = { ok: true } | { ok: false; message: string };

export type RekapPosyanduPublik = {
  total: number;
  bulanIni: number;
  imunisasi: number;
};

export type SalinanKunjunganPosyandu = {
  balita: Array<{
    tanggal_kunjungan: string;
    nama_anak: string;
    berat_kg: number | null;
    tinggi_cm: number | null;
    imunisasi: string | null;
    catatan: string | null;
  }>;
  lansia: Array<{
    tanggal_kunjungan: string;
    nama_peserta: string;
    tensi_darah: string | null;
    gula_darah: number | null;
    berat_kg: number | null;
    catatan: string | null;
  }>;
};

const KOLOM_BALITA =
  "id, created_at, nama_anak, nama_ibu, tanggal_kunjungan, berat_kg, tinggi_cm, imunisasi, catatan";
const KOLOM_LANSIA =
  "id, created_at, nama_peserta, tanggal_kunjungan, tensi_darah, gula_darah, berat_kg, catatan";

function teks(nilai: unknown, maksimum = 150) {
  return String(nilai ?? "").trim().slice(0, maksimum);
}

function gagal(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

async function catatAudit(
  supabase: SupabaseClient,
  input: { rtId: string; aktor: string; aksi: string; detail: string; tabel: string }
) {
  const { error } = await supabase.from("audit_log").insert([{
    aktor: teks(input.aktor) || "Pengurus",
    aksi: input.aksi,
    tabel_target: input.tabel,
    detail: teks(input.detail, 500),
    rt_id: input.rtId,
  }]);
  if (error) console.error("Audit posyandu gagal:", error.message);
}

type IzinTerbaru = { data_kesehatan: boolean; data_anak: boolean };

async function petaIzinTerbaru(
  supabase: SupabaseClient,
  rtId: string
): Promise<{ ok: true; data: Map<string, IzinTerbaru> } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("persetujuan_data_warga")
    .select("warga_id, data_kesehatan, data_anak, dicatat_pada")
    .eq("rt_id", rtId)
    .order("dicatat_pada", { ascending: false });
  if (error) {
    console.error("Gagal membaca izin kesehatan posyandu:", error.message);
    return gagal("Daftar izin kesehatan belum dapat dibaca.");
  }
  const peta = new Map<string, IzinTerbaru>();
  for (const baris of data || []) {
    const id = String(baris.warga_id || "");
    if (!id || peta.has(id)) continue;
    peta.set(id, {
      data_kesehatan: Boolean(baris.data_kesehatan),
      data_anak: Boolean(baris.data_anak),
    });
  }
  return { ok: true, data: peta };
}

export async function daftarKartuIzinPosyandu(
  supabase: SupabaseClient,
  rtId: string
): Promise<{ ok: true; data: KartuIzinPosyandu[] } | { ok: false; message: string }> {
  if (!POLA_UUID.test(rtId)) return gagal("Wilayah RT tidak valid.");

  const izin = await petaIzinTerbaru(supabase, rtId);
  if (!izin.ok) return izin;

  const { data: warga, error: errWarga } = await supabase
    .from("warga")
    .select("id, nama_lengkap, tanggal_lahir")
    .eq("rt_id", rtId)
    .neq("status_aktif", false)
    .order("nama_lengkap")
    .limit(500);
  if (errWarga) {
    console.error("Gagal membaca kartu posyandu:", errWarga.message);
    return gagal("Kartu keluarga posyandu belum dapat dibaca.");
  }

  const idIzin = (warga || [])
    .map((baris) => String(baris.id))
    .filter((id) => izin.data.get(id)?.data_kesehatan);
  if (idIzin.length === 0) return { ok: true, data: [] };

  const { data: anggota, error: errAnggota } = await supabase
    .from("anggota_keluarga")
    .select("id, warga_id, nama_lengkap, tanggal_lahir")
    .eq("rt_id", rtId)
    .in("warga_id", idIzin);
  if (errAnggota) {
    console.error("Gagal membaca jiwa posyandu:", errAnggota.message);
    return gagal("Anggota keluarga untuk posyandu belum dapat dibaca.");
  }

  const anggotaPerKk = new Map<string, Array<{ id: string; nama_lengkap: string; tanggal_lahir: unknown }>>();
  for (const baris of anggota || []) {
    const kk = String(baris.warga_id || "");
    if (!kk) continue;
    const daftar = anggotaPerKk.get(kk) || [];
    daftar.push({
      id: String(baris.id),
      nama_lengkap: teks(baris.nama_lengkap) || "Tanpa nama",
      tanggal_lahir: baris.tanggal_lahir,
    });
    anggotaPerKk.set(kk, daftar);
  }

  const hasil: KartuIzinPosyandu[] = [];
  for (const baris of warga || []) {
    const id = String(baris.id);
    const jejak = izin.data.get(id);
    if (!jejak?.data_kesehatan) continue;
    const namaKk = teks(baris.nama_lengkap) || "Tanpa nama";
    const jiwaBalita: JiwaPosyandu[] = [];
    const jiwaLansia: JiwaPosyandu[] = [];

    if (jiwaLayakPosyanduLansia(baris.tanggal_lahir)) {
      jiwaLansia.push({ kunci: KUNCI_JIWA_KEPALA, anggota_id: null, nama: `${namaKk} (kepala KK)` });
    }

    if (jejak.data_anak) {
      for (const anak of anggotaPerKk.get(id) || []) {
        if (!jiwaLayakPosyanduBalita(anak.tanggal_lahir)) continue;
        jiwaBalita.push({ kunci: anak.id, anggota_id: anak.id, nama: anak.nama_lengkap });
      }
    }
    for (const jiwa of anggotaPerKk.get(id) || []) {
      if (!jiwaLayakPosyanduLansia(jiwa.tanggal_lahir)) continue;
      jiwaLansia.push({ kunci: jiwa.id, anggota_id: jiwa.id, nama: jiwa.nama_lengkap });
    }

    if (jiwaBalita.length === 0 && jiwaLansia.length === 0) continue;
    hasil.push({ id, nama: namaKk, jiwaBalita, jiwaLansia });
  }

  return { ok: true, data: hasil };
}

export async function daftarKunjunganBalitaRt(
  supabase: SupabaseClient,
  rtId: string
): Promise<BarisKunjunganBalita[]> {
  const { data, error } = await supabase
    .from("kunjungan_balita")
    .select(KOLOM_BALITA)
    .eq("rt_id", rtId)
    .is("dianonimkan_pada", null)
    .not("warga_id", "is", null)
    .order("tanggal_kunjungan", { ascending: false })
    .limit(200);
  if (error) {
    if (!skemaBelumSiap(error)) console.error("Gagal membaca kunjungan balita:", error.message);
    return [];
  }
  return (data || []) as BarisKunjunganBalita[];
}

export async function daftarKunjunganLansiaRt(
  supabase: SupabaseClient,
  rtId: string
): Promise<BarisKunjunganLansia[]> {
  const { data, error } = await supabase
    .from("kunjungan_lansia")
    .select(KOLOM_LANSIA)
    .eq("rt_id", rtId)
    .is("dianonimkan_pada", null)
    .not("warga_id", "is", null)
    .order("tanggal_kunjungan", { ascending: false })
    .limit(200);
  if (error) {
    if (!skemaBelumSiap(error)) console.error("Gagal membaca kunjungan lansia:", error.message);
    return [];
  }
  return (data || []) as BarisKunjunganLansia[];
}

export async function daftarKunjunganBalitaRumahTangga(
  supabase: SupabaseClient,
  rtId: string,
  wargaId: string
): Promise<BarisKunjunganBalita[]> {
  if (!POLA_UUID.test(rtId) || !POLA_UUID.test(wargaId)) return [];
  const { data, error } = await supabase
    .from("kunjungan_balita")
    .select(KOLOM_BALITA)
    .eq("rt_id", rtId)
    .eq("warga_id", wargaId)
    .is("dianonimkan_pada", null)
    .order("tanggal_kunjungan", { ascending: false })
    .limit(100);
  if (error) {
    if (!skemaBelumSiap(error)) console.error("Gagal membaca posyandu balita rumah tangga:", error.message);
    return [];
  }
  return (data || []) as BarisKunjunganBalita[];
}

export async function daftarKunjunganLansiaRumahTangga(
  supabase: SupabaseClient,
  rtId: string,
  wargaId: string
): Promise<BarisKunjunganLansia[]> {
  if (!POLA_UUID.test(rtId) || !POLA_UUID.test(wargaId)) return [];
  const { data, error } = await supabase
    .from("kunjungan_lansia")
    .select(KOLOM_LANSIA)
    .eq("rt_id", rtId)
    .eq("warga_id", wargaId)
    .is("dianonimkan_pada", null)
    .order("tanggal_kunjungan", { ascending: false })
    .limit(100);
  if (error) {
    if (!skemaBelumSiap(error)) console.error("Gagal membaca posyandu lansia rumah tangga:", error.message);
    return [];
  }
  return (data || []) as BarisKunjunganLansia[];
}

export async function hitungRekamYatimRt(
  supabase: SupabaseClient,
  rtId: string
): Promise<number> {
  const [balita, lansia] = await Promise.all([
    supabase.from("kunjungan_balita").select("id", { count: "exact", head: true }).eq("rt_id", rtId).is("warga_id", null).is("dianonimkan_pada", null),
    supabase.from("kunjungan_lansia").select("id", { count: "exact", head: true }).eq("rt_id", rtId).is("warga_id", null).is("dianonimkan_pada", null),
  ]);
  return (balita.count || 0) + (lansia.count || 0);
}

async function pastikanKartuKeluarga(
  supabase: SupabaseClient,
  wargaId: string,
  rtId: string
): Promise<{ ok: true; nama: string; tanggal_lahir: unknown } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("warga")
    .select("id, nama_lengkap, tanggal_lahir")
    .eq("id", wargaId)
    .eq("rt_id", rtId)
    .neq("status_aktif", false)
    .maybeSingle();
  if (error || !data) return gagal("Kartu keluarga tidak berada di RT posyandu ini.");
  return { ok: true, nama: teks(data.nama_lengkap) || "Tanpa nama", tanggal_lahir: data.tanggal_lahir };
}

async function pastikanAnggotaKk(
  supabase: SupabaseClient,
  anggotaId: string,
  wargaId: string,
  rtId: string
): Promise<{ ok: true; nama: string; tanggal_lahir: unknown } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("anggota_keluarga")
    .select("id, nama_lengkap, tanggal_lahir")
    .eq("id", anggotaId)
    .eq("warga_id", wargaId)
    .eq("rt_id", rtId)
    .maybeSingle();
  if (error || !data) return gagal("Jiwa itu tidak tercatat di kartu keluarga yang dipilih.");
  return { ok: true, nama: teks(data.nama_lengkap) || "Tanpa nama", tanggal_lahir: data.tanggal_lahir };
}

export async function simpanKunjunganBalita(
  supabase: SupabaseClient,
  input: {
    rtId: string;
    aktor: string;
    payload: unknown;
  }
): Promise<{ ok: true; data: BarisKunjunganBalita } | { ok: false; message: string }> {
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    return gagal("Format kunjungan balita tidak valid.");
  }
  const sumber = input.payload as Record<string, unknown>;
  const wargaId = String(sumber.warga_id ?? "").trim();
  const anggotaId = String(sumber.anggota_id ?? anggotaIdDariKunciJiwa(String(sumber.kunci_jiwa ?? "")) ?? "").trim();
  const tanggal = tanggalKunjunganSah(sumber.tanggal_kunjungan);
  const berat = angkaKunjunganOpsional(sumber.berat_kg, 500);
  const tinggi = angkaKunjunganOpsional(sumber.tinggi_cm, 300);
  if (!POLA_UUID.test(wargaId) || !POLA_UUID.test(anggotaId) || !tanggal || !berat.ok || !tinggi.ok) {
    return gagal("Pilih anak dari buku induk yang usianya 0–5 tahun dan rumah tangga yang sudah izin kesehatan.");
  }

  const kk = await pastikanKartuKeluarga(supabase, wargaId, input.rtId);
  if (!kk.ok) return kk;
  const izin = await izinKesehatanRumahTangga(supabase, wargaId, input.rtId, { wajibAnak: true });
  if (!izin.ok) return izin;
  const anak = await pastikanAnggotaKk(supabase, anggotaId, wargaId, input.rtId);
  if (!anak.ok) return anak;
  if (!jiwaLayakPosyanduBalita(anak.tanggal_lahir)) {
    return gagal("Posyandu balita hanya untuk anak 0–5 tahun yang tercatat di KK itu.");
  }

  const { data, error } = await supabase
    .from("kunjungan_balita")
    .insert([{
      rt_id: input.rtId,
      warga_id: wargaId,
      anggota_id: anggotaId,
      nama_anak: anak.nama,
      nama_ibu: kk.nama,
      tanggal_kunjungan: tanggal,
      berat_kg: berat.nilai,
      tinggi_cm: tinggi.nilai,
      imunisasi: teks(sumber.imunisasi, 500) || null,
      catatan: teks(sumber.catatan, 2000) || null,
      dicatat_oleh: teks(input.aktor) || "Pengurus",
    }])
    .select(KOLOM_BALITA)
    .single();
  if (error || !data) {
    console.error("Gagal menyimpan kunjungan balita:", error?.message);
    return gagal("Kunjungan balita belum dapat disimpan.");
  }

  await catatAudit(supabase, {
    rtId: input.rtId,
    aktor: input.aktor,
    aksi: "Catat kunjungan posyandu balita",
    tabel: "kunjungan_balita",
    detail: `warga_id=${wargaId}; anggota_id=${anggotaId}; tanggal=${tanggal}`,
  });
  return { ok: true, data: data as BarisKunjunganBalita };
}

export async function simpanKunjunganLansia(
  supabase: SupabaseClient,
  input: {
    rtId: string;
    aktor: string;
    payload: unknown;
  }
): Promise<{ ok: true; data: BarisKunjunganLansia } | { ok: false; message: string }> {
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    return gagal("Format kunjungan lansia tidak valid.");
  }
  const sumber = input.payload as Record<string, unknown>;
  const wargaId = String(sumber.warga_id ?? "").trim();
  const kunci = String(sumber.kunci_jiwa ?? "").trim();
  const anggotaId = anggotaIdDariKunciJiwa(kunci);
  const tanggal = tanggalKunjunganSah(sumber.tanggal_kunjungan);
  const gula = angkaKunjunganOpsional(sumber.gula_darah, 3000);
  const berat = angkaKunjunganOpsional(sumber.berat_kg, 500);
  if (!POLA_UUID.test(wargaId) || !kunci || !tanggal || !gula.ok || !berat.ok) {
    return gagal("Pilih peserta dari buku induk (45 tahun ke atas) yang rumah tangganya sudah izin kesehatan.");
  }
  if (anggotaId && !POLA_UUID.test(anggotaId)) {
    return gagal("Identitas peserta lansia tidak valid.");
  }

  const kk = await pastikanKartuKeluarga(supabase, wargaId, input.rtId);
  if (!kk.ok) return kk;
  const izin = await izinKesehatanRumahTangga(supabase, wargaId, input.rtId);
  if (!izin.ok) return izin;

  let namaPeserta = kk.nama;
  let tanggalLahir: unknown = kk.tanggal_lahir;
  if (anggotaId) {
    const jiwa = await pastikanAnggotaKk(supabase, anggotaId, wargaId, input.rtId);
    if (!jiwa.ok) return jiwa;
    namaPeserta = jiwa.nama;
    tanggalLahir = jiwa.tanggal_lahir;
  }
  if (!jiwaLayakPosyanduLansia(tanggalLahir)) {
    return gagal("Posyandu lansia hanya untuk jiwa 45 tahun ke atas yang tercatat di KK itu.");
  }

  const { data, error } = await supabase
    .from("kunjungan_lansia")
    .insert([{
      rt_id: input.rtId,
      warga_id: wargaId,
      anggota_id: anggotaId,
      nama_peserta: namaPeserta,
      tanggal_kunjungan: tanggal,
      tensi_darah: teks(sumber.tensi_darah, 30) || null,
      gula_darah: gula.nilai,
      berat_kg: berat.nilai,
      catatan: teks(sumber.catatan, 2000) || null,
      dicatat_oleh: teks(input.aktor) || "Pengurus",
    }])
    .select(KOLOM_LANSIA)
    .single();
  if (error || !data) {
    console.error("Gagal menyimpan kunjungan lansia:", error?.message);
    return gagal("Kunjungan lansia belum dapat disimpan.");
  }

  await catatAudit(supabase, {
    rtId: input.rtId,
    aktor: input.aktor,
    aksi: "Catat kunjungan posyandu lansia",
    tabel: "kunjungan_lansia",
    detail: `warga_id=${wargaId}; kunci=${kunci}; tanggal=${tanggal}`,
  });
  return { ok: true, data: data as BarisKunjunganLansia };
}

export async function hapusKunjunganPosyandu(
  supabase: SupabaseClient,
  input: { rtId: string; aktor: string; tabel: string; id: string }
): Promise<HasilPosyandu> {
  if (input.tabel !== "kunjungan_balita" && input.tabel !== "kunjungan_lansia") {
    return gagal("Tabel kunjungan tidak diizinkan.");
  }
  if (!POLA_UUID.test(input.id) || !POLA_UUID.test(input.rtId)) {
    return gagal("Identitas kunjungan tidak valid.");
  }
  const { data, error } = await supabase
    .from(input.tabel)
    .delete()
    .eq("id", input.id)
    .eq("rt_id", input.rtId)
    .is("dianonimkan_pada", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Gagal menghapus kunjungan posyandu:", error.message);
    return gagal("Kunjungan belum dapat dihapus.");
  }
  if (!data) return gagal("Kunjungan tidak ditemukan atau sudah dianonimkan.");
  await catatAudit(supabase, {
    rtId: input.rtId,
    aktor: input.aktor,
    aksi: "Hapus kunjungan posyandu",
    tabel: input.tabel,
    detail: `id=${input.id}`,
  });
  return { ok: true };
}

export async function anonimkanKunjunganRumahTangga(
  supabase: SupabaseClient,
  input: { rtId: string; wargaId: string; aktor: string }
): Promise<{ ok: true; balita: number; lansia: number } | { ok: false; message: string }> {
  if (!POLA_UUID.test(input.rtId) || !POLA_UUID.test(input.wargaId)) {
    return gagal("Identitas rumah tangga tidak valid.");
  }
  const sekarang = new Date().toISOString();
  const [balita, lansia] = await Promise.all([
    supabase
      .from("kunjungan_balita")
      .update({ dianonimkan_pada: sekarang })
      .eq("rt_id", input.rtId)
      .eq("warga_id", input.wargaId)
      .is("dianonimkan_pada", null)
      .select("id"),
    supabase
      .from("kunjungan_lansia")
      .update({ dianonimkan_pada: sekarang })
      .eq("rt_id", input.rtId)
      .eq("warga_id", input.wargaId)
      .is("dianonimkan_pada", null)
      .select("id"),
  ]);
  if (balita.error && !skemaBelumSiap(balita.error)) {
    return gagal("Catatan posyandu balita belum dapat dianonimkan.");
  }
  if (lansia.error && !skemaBelumSiap(lansia.error)) {
    return gagal("Catatan posyandu lansia belum dapat dianonimkan.");
  }
  const jumlahBalita = balita.data?.length || 0;
  const jumlahLansia = lansia.data?.length || 0;
  if (jumlahBalita + jumlahLansia > 0) {
    await catatAudit(supabase, {
      rtId: input.rtId,
      aktor: input.aktor,
      aksi: "Anonimkan kunjungan posyandu rumah tangga",
      tabel: "kunjungan_balita",
      detail: `warga_id=${input.wargaId}; balita=${jumlahBalita}; lansia=${jumlahLansia}`,
    });
  }
  return { ok: true, balita: jumlahBalita, lansia: jumlahLansia };
}

export async function anonimkanKunjunganYatimRt(
  supabase: SupabaseClient,
  input: { rtId: string; aktor: string }
): Promise<{ ok: true; jumlah: number } | { ok: false; message: string }> {
  if (!POLA_UUID.test(input.rtId)) return gagal("Wilayah RT tidak valid.");
  const sekarang = new Date().toISOString();
  const [balita, lansia] = await Promise.all([
    supabase
      .from("kunjungan_balita")
      .update({ dianonimkan_pada: sekarang })
      .eq("rt_id", input.rtId)
      .is("warga_id", null)
      .is("dianonimkan_pada", null)
      .select("id"),
    supabase
      .from("kunjungan_lansia")
      .update({ dianonimkan_pada: sekarang })
      .eq("rt_id", input.rtId)
      .is("warga_id", null)
      .is("dianonimkan_pada", null)
      .select("id"),
  ]);
  if (balita.error && !skemaBelumSiap(balita.error)) {
    return gagal("Rekam yatim balita belum dapat dianonimkan.");
  }
  if (lansia.error && !skemaBelumSiap(lansia.error)) {
    return gagal("Rekam yatim lansia belum dapat dianonimkan.");
  }
  const jumlah = (balita.data?.length || 0) + (lansia.data?.length || 0);
  await catatAudit(supabase, {
    rtId: input.rtId,
    aktor: input.aktor,
    aksi: "Anonimkan kunjungan posyandu yatim",
    tabel: "kunjungan_balita",
    detail: `jumlah=${jumlah}`,
  });
  return { ok: true, jumlah };
}

export async function salinanKunjunganRumahTangga(
  supabase: SupabaseClient,
  rtId: string,
  wargaId: string
): Promise<SalinanKunjunganPosyandu> {
  const [balita, lansia] = await Promise.all([
    daftarKunjunganBalitaRumahTangga(supabase, rtId, wargaId),
    daftarKunjunganLansiaRumahTangga(supabase, rtId, wargaId),
  ]);
  return {
    balita: balita.map((baris) => ({
      tanggal_kunjungan: baris.tanggal_kunjungan,
      nama_anak: baris.nama_anak,
      berat_kg: baris.berat_kg,
      tinggi_cm: baris.tinggi_cm,
      imunisasi: baris.imunisasi,
      catatan: baris.catatan,
    })),
    lansia: lansia.map((baris) => ({
      tanggal_kunjungan: baris.tanggal_kunjungan,
      nama_peserta: baris.nama_peserta,
      tensi_darah: baris.tensi_darah,
      gula_darah: baris.gula_darah,
      berat_kg: baris.berat_kg,
      catatan: baris.catatan,
    })),
  };
}

function awalBulanIso(acuan = new Date()) {
  const tahun = acuan.getFullYear();
  const bulan = String(acuan.getMonth() + 1).padStart(2, "0");
  return `${tahun}-${bulan}-01`;
}

export async function rekapPosyanduPublik(
  supabase: SupabaseClient,
  tenant: string
): Promise<{ balita: RekapPosyanduPublik; lansia: RekapPosyanduPublik; error: { message?: string; code?: string } | null }> {
  const kosong: RekapPosyanduPublik = { total: 0, bulanIni: 0, imunisasi: 0 };
  const dari = awalBulanIso();
  const hitung = (tabel: "kunjungan_balita" | "kunjungan_lansia") =>
    supabase.from(tabel).select("id", { count: "exact", head: true }).eq("rt_id", tenant);

  const [totalBalita, bulanBalita, imunisasi, totalLansia, bulanLansia] = await Promise.all([
    hitung("kunjungan_balita"),
    hitung("kunjungan_balita").gte("tanggal_kunjungan", dari),
    hitung("kunjungan_balita").eq("ada_imunisasi", true),
    hitung("kunjungan_lansia"),
    hitung("kunjungan_lansia").gte("tanggal_kunjungan", dari),
  ]);

  const error =
    totalBalita.error || bulanBalita.error || imunisasi.error || totalLansia.error || bulanLansia.error;
  if (error && skemaBelumSiap(error)) {
    return { balita: kosong, lansia: kosong, error: null };
  }
  if (imunisasi.error && !totalBalita.error) {
    const cadangan = await hitung("kunjungan_balita").not("imunisasi", "is", null).neq("imunisasi", "");
    return {
      balita: {
        total: totalBalita.count || 0,
        bulanIni: bulanBalita.count || 0,
        imunisasi: cadangan.count || 0,
      },
      lansia: { total: totalLansia.count || 0, bulanIni: bulanLansia.count || 0, imunisasi: 0 },
      error: cadangan.error,
    };
  }

  return {
    balita: {
      total: totalBalita.count || 0,
      bulanIni: bulanBalita.count || 0,
      imunisasi: imunisasi.count || 0,
    },
    lansia: { total: totalLansia.count || 0, bulanIni: bulanLansia.count || 0, imunisasi: 0 },
    error,
  };
}
