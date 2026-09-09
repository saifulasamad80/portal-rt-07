import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { POLA_UUID, uuidTenantSah } from "@/lib/uuid-tenant";
import type { BundelKotakSampah, HasilKotakSampah, ItemKotakSampah } from "@/lib/kotak-sampah-tipe";

export type { BundelKotakSampah, HasilKotakSampah, ItemKotakSampah };

const KOLOM_WARGA = [
  "id",
  "nik",
  "nama_lengkap",
  "no_whatsapp",
  "status_tinggal",
  "detail_alamat",
  "dokumen_kk_url",
  "status_verifikasi",
  "created_at",
  "pin",
  "auth_email",
  "password",
  "tanggal_lahir",
  "tempat_lahir",
  "jenis_kelamin",
  "pekerjaan",
  "pendapatan_bulanan",
  "daya_listrik",
  "rt_id",
  "email",
  "reset_token",
  "reset_token_expires",
  "percobaan_gagal",
  "terkunci_sampai",
  "ktp_path",
  "kk_path",
  "agama",
  "status_aktif",
  "session_version",
  "status_validasi",
  "no_kk",
  "pendidikan",
  "hubungan_kk",
] as const;

const KOLOM_ANGGOTA = [
  "id",
  "warga_id",
  "nama_lengkap",
  "hubungan_keluarga",
  "created_at",
  "nik",
  "tanggal_lahir",
  "tempat_lahir",
  "jenis_kelamin",
  "pekerjaan",
  "ktp_path",
  "hubungan_detail",
  "rt_id",
  "agama",
  "no_kk",
  "pendidikan",
] as const;

type BarisKotakSampah = {
  id: string;
  rt_id: string;
  tabel_asal: string;
  baris_id: string;
  bundel_id: string;
  nama_tampil: string | null;
  snapshot: Record<string, unknown> | null;
  alasan: string | null;
  aktor: string | null;
  dihapus_pada: string;
  dipulihkan_pada: string | null;
};

function teks(nilai: unknown) {
  return String(nilai ?? "").trim();
}

function payloadDariSnapshot(
  snapshot: Record<string, unknown> | null,
  kolom: readonly string[]
): Record<string, unknown> | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const keluar: Record<string, unknown> = {};
  for (const kunci of kolom) {
    if (Object.prototype.hasOwnProperty.call(snapshot, kunci)) {
      keluar[kunci] = snapshot[kunci];
    }
  }
  if (!keluar.id) return null;
  return keluar;
}

function normalisasiSnapshot(nilai: unknown): Record<string, unknown> | null {
  if (!nilai || typeof nilai !== "object" || Array.isArray(nilai)) return null;
  return nilai as Record<string, unknown>;
}

function keItem(baris: BarisKotakSampah): ItemKotakSampah {
  return {
    id: baris.id,
    tabel_asal: baris.tabel_asal === "warga" ? "warga" : "anggota_keluarga",
    baris_id: baris.baris_id,
    bundel_id: baris.bundel_id,
    nama_tampil: teks(baris.nama_tampil) || "Tanpa nama",
    alasan: baris.alasan,
    aktor: baris.aktor,
    dihapus_pada: baris.dihapus_pada,
    dipulihkan_pada: baris.dipulihkan_pada,
  };
}

export function kelompokkanBundel(daftar: ItemKotakSampah[]): BundelKotakSampah[] {
  const peta = new Map<string, BundelKotakSampah>();
  for (const item of daftar) {
    let bundel = peta.get(item.bundel_id);
    if (!bundel) {
      bundel = {
        bundel_id: item.bundel_id,
        dihapus_pada: item.dihapus_pada,
        aktor: item.aktor,
        alasan: item.alasan,
        kepala: null,
        anggota: [],
      };
      peta.set(item.bundel_id, bundel);
    }
    if (item.tabel_asal === "warga") bundel.kepala = item;
    else bundel.anggota.push(item);
    if (item.dihapus_pada > bundel.dihapus_pada) bundel.dihapus_pada = item.dihapus_pada;
    if (!bundel.aktor && item.aktor) bundel.aktor = item.aktor;
    if (!bundel.alasan && item.alasan) bundel.alasan = item.alasan;
  }
  return [...peta.values()].sort((a, b) => (a.dihapus_pada < b.dihapus_pada ? 1 : -1));
}

export async function tandaiAktorHapus(
  supabase: SupabaseClient,
  bundelId: string,
  rtId: string,
  aktor: string,
  alasan: string
): Promise<void> {
  if (!POLA_UUID.test(bundelId) || !POLA_UUID.test(rtId)) return;
  const { error } = await supabase
    .from("kotak_sampah")
    .update({ aktor: teks(aktor) || "pengurus", alasan: teks(alasan) || "hapus" })
    .eq("bundel_id", bundelId)
    .eq("rt_id", rtId)
    .is("dipulihkan_pada", null);
  if (error) console.error("Gagal menandai aktor kotak sampah:", error.message);
}

export async function daftarKotakSampah(
  supabase: SupabaseClient,
  rtId: string
): Promise<{ ok: true; data: ItemKotakSampah[] } | { ok: false; message: string }> {
  const rtSah = uuidTenantSah(rtId);
  if (!rtSah) return { ok: false, message: "Wilayah RT tidak valid." };

  const { data, error } = await supabase
    .from("kotak_sampah")
    .select("id, tabel_asal, baris_id, bundel_id, nama_tampil, alasan, aktor, dihapus_pada, dipulihkan_pada")
    .eq("rt_id", rtSah)
    .is("dipulihkan_pada", null)
    .order("dihapus_pada", { ascending: false })
    .limit(500);

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return { ok: false, message: "Tabel kotak sampah belum ada. Jalankan kotak-sampah-recycle-bin.sql." };
    }
    return { ok: false, message: `Gagal membaca kotak sampah: ${error.message}` };
  }

  const aman = (data || []).map((baris) => keItem(baris as BarisKotakSampah));
  return { ok: true, data: aman };
}

async function tandaiDipulihkan(
  supabase: SupabaseClient,
  id: string,
  rtId: string,
  aktor: string
) {
  const { error } = await supabase
    .from("kotak_sampah")
    .update({ dipulihkan_pada: new Date().toISOString(), dipulihkan_oleh: teks(aktor) || "pengurus" })
    .eq("id", id)
    .eq("rt_id", rtId)
    .is("dipulihkan_pada", null);
  if (error) throw new Error(`Gagal menandai pemulihan: ${error.message}`);
}

async function pulihkanBaris(
  supabase: SupabaseClient,
  baris: BarisKotakSampah,
  rtId: string,
  aktor: string
): Promise<HasilKotakSampah> {
  if (baris.rt_id !== rtId) {
    return { success: false, message: "Pemulihan lintas RT ditolak." };
  }
  if (baris.dipulihkan_pada) {
    return { success: true, message: "Item ini sudah dipulihkan sebelumnya.", dipulihkan: 0 };
  }

  const tabel = baris.tabel_asal;
  const kolom = tabel === "warga" ? KOLOM_WARGA : KOLOM_ANGGOTA;
  const payload = payloadDariSnapshot(baris.snapshot, kolom);
  if (!payload) {
    return { success: false, message: "Salinan data rusak, tidak bisa dipulihkan." };
  }
  if (teks(payload.rt_id) !== rtId) {
    return { success: false, message: "Salinan data beda RT, pemulihan ditolak." };
  }

  const { data: sudahAda, error: errAda } = await supabase
    .from(tabel)
    .select("id")
    .eq("id", baris.baris_id)
    .maybeSingle();
  if (errAda) return { success: false, message: `Gagal memeriksa data aktif: ${errAda.message}` };
  if (sudahAda) {
    await tandaiDipulihkan(supabase, baris.id, rtId, aktor);
    return { success: true, message: "Baris tujuan sudah ada; item kotak sampah ditandai dipulihkan.", dipulihkan: 0 };
  }

  if (tabel === "warga" && teks(payload.nik)) {
    const { data: nikDipakai, error: errNik } = await supabase
      .from("warga")
      .select("id, nama_lengkap")
      .eq("nik", payload.nik)
      .eq("rt_id", rtId)
      .maybeSingle();
    if (errNik) return { success: false, message: `Gagal memeriksa NIK: ${errNik.message}` };
    if (nikDipakai && nikDipakai.id !== baris.baris_id) {
      return {
        success: false,
        message: `NIK sudah dipakai akun lain (${teks(nikDipakai.nama_lengkap) || "tanpa nama"}). Pemulihan ditolak supaya tidak dobel.`,
      };
    }
  }

  if (tabel === "anggota_keluarga") {
    const indukId = teks(payload.warga_id);
    if (!POLA_UUID.test(indukId)) {
      return { success: false, message: "Salinan anggota tidak punya kepala keluarga yang sah." };
    }
    const { data: induk, error: errInduk } = await supabase
      .from("warga")
      .select("id")
      .eq("id", indukId)
      .eq("rt_id", rtId)
      .maybeSingle();
    if (errInduk) return { success: false, message: `Gagal memeriksa kepala keluarga: ${errInduk.message}` };
    if (!induk) {
      return {
        success: false,
        message: "Kepala keluarga belum ada di buku induk. Pulihkan akun KK terlebih dahulu.",
      };
    }
  }

  const { error: errInsert } = await supabase.from(tabel).insert(payload);
  if (errInsert) {
    return { success: false, message: `Gagal mengembalikan data: ${errInsert.message}` };
  }

  await tandaiDipulihkan(supabase, baris.id, rtId, aktor);
  return { success: true, message: `${teks(baris.nama_tampil) || "Data"} dikembalikan ke buku induk.`, dipulihkan: 1 };
}

async function ambilBarisPenuh(
  supabase: SupabaseClient,
  id: string,
  rtId: string
): Promise<{ ok: true; baris: BarisKotakSampah } | { ok: false; message: string }> {
  if (!POLA_UUID.test(id)) return { ok: false, message: "ID kotak sampah tidak valid." };
  const { data, error } = await supabase
    .from("kotak_sampah")
    .select("id, rt_id, tabel_asal, baris_id, bundel_id, nama_tampil, snapshot, alasan, aktor, dihapus_pada, dipulihkan_pada")
    .eq("id", id)
    .eq("rt_id", rtId)
    .maybeSingle();
  if (error) return { ok: false, message: `Gagal membaca kotak sampah: ${error.message}` };
  if (!data) return { ok: false, message: "Item kotak sampah tidak ditemukan." };
  const snapshotMentah = data.snapshot;
  const snapshot =
    snapshotMentah && typeof snapshotMentah === "object" && !Array.isArray(snapshotMentah)
      ? (snapshotMentah as Record<string, unknown>)
      : null;
  return { ok: true, baris: { ...(data as Omit<BarisKotakSampah, "snapshot">), snapshot } };
}

export async function pulihkanItemKotakSampah(
  supabase: SupabaseClient,
  id: string,
  rtId: string,
  aktor: string
): Promise<HasilKotakSampah> {
  const rtSah = uuidTenantSah(rtId);
  if (!rtSah) return { success: false, message: "Wilayah RT tidak valid." };
  const muat = await ambilBarisPenuh(supabase, id, rtSah);
  if (!muat.ok) return { success: false, message: muat.message };
  const hasil = await pulihkanBaris(supabase, muat.baris, rtSah, aktor);
  if (hasil.success) {
    await supabase.from("audit_log").insert({
      aktor: teks(aktor) || "pengurus",
      aksi: "Pulihkan dari kotak sampah",
      tabel_target: muat.baris.tabel_asal,
      detail: `Memulihkan ${muat.baris.nama_tampil || "data"} dari kotak sampah.`,
      rt_id: rtSah,
    });
  }
  return hasil;
}

export async function pulihkanBundelKotakSampah(
  supabase: SupabaseClient,
  bundelId: string,
  rtId: string,
  aktor: string
): Promise<HasilKotakSampah> {
  const rtSah = uuidTenantSah(rtId);
  if (!rtSah) return { success: false, message: "Wilayah RT tidak valid." };
  if (!POLA_UUID.test(bundelId)) return { success: false, message: "ID bundel tidak valid." };

  const { data, error } = await supabase
    .from("kotak_sampah")
    .select("id, rt_id, tabel_asal, baris_id, bundel_id, nama_tampil, snapshot, alasan, aktor, dihapus_pada, dipulihkan_pada")
    .eq("bundel_id", bundelId)
    .eq("rt_id", rtSah)
    .is("dipulihkan_pada", null)
    .order("tabel_asal", { ascending: false });

  if (error) return { success: false, message: `Gagal membaca bundel: ${error.message}` };
  const baris: BarisKotakSampah[] = (data || []).map((item) => ({
    ...(item as Omit<BarisKotakSampah, "snapshot">),
    snapshot: normalisasiSnapshot((item as { snapshot?: unknown }).snapshot),
  }));
  if (!baris.length) return { success: false, message: "Bundel kosong atau sudah dipulihkan." };

  const wargaDulu = baris.filter((b) => b.tabel_asal === "warga");
  const anggotaKemudian = baris.filter((b) => b.tabel_asal !== "warga");
  let dipulihkan = 0;
  const nama: string[] = [];

  for (const item of [...wargaDulu, ...anggotaKemudian]) {
    const hasil = await pulihkanBaris(supabase, item, rtSah, aktor);
    if (!hasil.success) {
      return {
        success: false,
        message: dipulihkan
          ? `Sebagian terpulihkan (${dipulihkan}), lalu gagal: ${hasil.message}`
          : hasil.message,
        dipulihkan,
      };
    }
    dipulihkan += hasil.dipulihkan || 0;
    if (item.nama_tampil) nama.push(item.nama_tampil);
  }

  await supabase.from("audit_log").insert({
    aktor: teks(aktor) || "pengurus",
    aksi: "Pulihkan bundel kotak sampah",
    tabel_target: "warga/anggota_keluarga",
    detail: `Memulihkan ${dipulihkan} baris: ${nama.slice(0, 8).join(", ") || "tanpa nama"}.`,
    rt_id: rtSah,
  });

  return {
    success: true,
    message: `${dipulihkan} baris dikembalikan ke buku induk.`,
    dipulihkan,
  };
}
