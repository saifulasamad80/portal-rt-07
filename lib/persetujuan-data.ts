import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { adalahArsipPemilu } from "@/lib/verifikasi-carik";
import {
  type InventoriPdp,
  type JejakPersetujuan,
  type PersetujuanLaporDiri,
  type SumberPersetujuan,
  TANGGAL_PEMBERITAHUAN_PDP,
  VERSI_KEBIJAKAN_PRIVASI,
  ringkasanAuditPersetujuan,
  tanggalTenggatDataSpesifik,
  tenggatPdpSudahLewat,
} from "@/lib/kebijakan-privasi";
import { POLA_UUID } from "@/lib/uuid-tenant";

export const TABEL_PERSETUJUAN = "persetujuan_data_warga";
export const POLA_PATH_SURAT_PERSETUJUAN = new RegExp(
  `^persetujuan/${"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"}/${"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"}/SURAT_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(?:jpg|pdf)$`,
  "i"
);

function teks(nilai: unknown) {
  return String(nilai ?? "").trim();
}

function fotoKkAda(path: unknown) {
  const isi = teks(path);
  return isi !== "" && isi !== "-" && isi !== "MENYUSUL";
}

export function pathSuratPersetujuan(rtId: string, wargaId: string, ekstensi: "jpg" | "pdf") {
  const uuid = crypto.randomUUID();
  return `persetujuan/${rtId}/${wargaId}/SURAT_${uuid}.${ekstensi}`;
}

export async function catatPersetujuanData(
  supabase: SupabaseClient,
  input: {
    wargaId: string;
    rtId: string;
    sumber: SumberPersetujuan;
    persetujuan: PersetujuanLaporDiri;
    jumlahAnggota: number;
    jumlahAnak: number;
    berkasPath?: string | null;
    aktorAudit: string;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!POLA_UUID.test(input.wargaId) || !POLA_UUID.test(input.rtId)) {
    return { ok: false, message: "Identitas persetujuan tidak valid." };
  }
  if (input.berkasPath && !POLA_PATH_SURAT_PERSETUJUAN.test(input.berkasPath)) {
    return { ok: false, message: "Berkas surat pernyataan tidak valid." };
  }

  const { data: jejakBaru, error: errTabel } = await supabase.from(TABEL_PERSETUJUAN).insert([{
    warga_id: input.wargaId,
    rt_id: input.rtId,
    sumber: input.sumber,
    versi_naskah: input.persetujuan.versi_naskah,
    baca_kebijakan: input.persetujuan.baca_kebijakan,
    data_pribadi: input.persetujuan.data_pribadi,
    data_anggota: input.persetujuan.data_anggota,
    data_anak: input.persetujuan.data_anak,
    data_keuangan: input.persetujuan.data_keuangan,
    data_kesehatan: input.persetujuan.data_kesehatan,
    berkas_path: input.berkasPath || null,
  }]).select("id").single();
  if (errTabel) {
    console.error("Catatan persetujuan tabel gagal:", errTabel.message);
    return { ok: false, message: "Catatan persetujuan gagal disimpan." };
  }
  if (!jejakBaru?.id) {
    console.error("Catatan persetujuan tabel tidak mengembalikan id.");
    return { ok: false, message: "Catatan persetujuan gagal disimpan." };
  }

  const { error: errAudit } = await supabase.from("audit_log").insert([{
    aktor: teks(input.aktorAudit).slice(0, 150) || "Sistem",
    aksi: "Persetujuan pemrosesan data",
    tabel_target: TABEL_PERSETUJUAN,
    detail: ringkasanAuditPersetujuan(input.persetujuan, {
      wargaId: input.wargaId,
      jumlahAnggota: input.jumlahAnggota,
      jumlahAnak: input.jumlahAnak,
      sumber: input.sumber,
    }),
    rt_id: input.rtId,
  }]);
  if (errAudit) {
    console.error("Audit persetujuan gagal:", errAudit.message);
    const { error: errRollback } = await supabase
      .from(TABEL_PERSETUJUAN)
      .delete()
      .eq("id", jejakBaru.id)
      .eq("warga_id", input.wargaId)
      .eq("rt_id", input.rtId);
    if (errRollback) {
      console.error("Rollback catatan persetujuan gagal:", errRollback.message);
    }
    return { ok: false, message: "Catatan persetujuan gagal disimpan." };
  }
  return { ok: true };
}

export async function ambilPersetujuanTerbaru(
  supabase: SupabaseClient,
  wargaId: string,
  rtId: string
): Promise<{ ok: true; data: JejakPersetujuan | null } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from(TABEL_PERSETUJUAN)
    .select("id, warga_id, sumber, versi_naskah, data_pribadi, data_keuangan, data_anggota, data_anak, data_kesehatan, berkas_path, dicatat_pada")
    .eq("warga_id", wargaId)
    .eq("rt_id", rtId)
    .order("dicatat_pada", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Gagal membaca persetujuan:", error.message);
    return { ok: false, message: "Catatan persetujuan belum dapat dibaca." };
  }
  return { ok: true, data: (data as JejakPersetujuan | null) ?? null };
}

export async function hitungInventoriPdp(
  supabase: SupabaseClient,
  rtId: string
): Promise<{ ok: true; data: InventoriPdp } | { ok: false; message: string }> {
  const [{ data: warga, error: errWarga }, { data: jejak, error: errJejak }] = await Promise.all([
    supabase
      .from("warga")
      .select("id, nama_lengkap, tanggal_lahir, nik, pendapatan_bulanan, daya_listrik, kk_path")
      .eq("rt_id", rtId)
      .neq("status_aktif", false),
    supabase
      .from(TABEL_PERSETUJUAN)
      .select("warga_id, data_keuangan, dicatat_pada")
      .eq("rt_id", rtId)
      .order("dicatat_pada", { ascending: false }),
  ]);

  if (errWarga) {
    console.error("Inventori PDP warga gagal:", errWarga.message);
    return { ok: false, message: "Inventori data lama belum dapat dihitung." };
  }
  if (errJejak) {
    console.error("Inventori PDP persetujuan gagal:", errJejak.message);
    return { ok: false, message: "Inventori data lama belum dapat dihitung." };
  }

  const terbaru = new Map<string, { data_keuangan: boolean }>();
  for (const baris of jejak || []) {
    const id = String(baris.warga_id || "");
    if (!id || terbaru.has(id)) continue;
    terbaru.set(id, { data_keuangan: Boolean(baris.data_keuangan) });
  }

  let tanpaJejak = 0;
  let pendapatanTanpaKeuangan = 0;
  let fotoKkTanpaJejak = 0;
  for (const baris of warga || []) {
    if (adalahArsipPemilu(baris)) continue;
    const izin = terbaru.get(String(baris.id));
    if (!izin) tanpaJejak += 1;
    const adaPendapatan = teks(baris.pendapatan_bulanan) !== "" || teks(baris.daya_listrik) !== "";
    if (adaPendapatan && !izin?.data_keuangan) pendapatanTanpaKeuangan += 1;
    if (fotoKkAda(baris.kk_path) && !izin) fotoKkTanpaJejak += 1;
  }

  return {
    ok: true,
    data: {
      tanpaJejak,
      pendapatanTanpaKeuangan,
      fotoKkTanpaJejak,
      tenggat: tanggalTenggatDataSpesifik(),
      pemberitahuan: TANGGAL_PEMBERITAHUAN_PDP,
      tenggatLewat: tenggatPdpSudahLewat(),
    },
  };
}

export async function kosongkanDataSpesifikLewatTenggat(
  supabase: SupabaseClient,
  input: { rtId: string; aktor: string; acuan?: Date }
): Promise<{ ok: true; pendapatan: number; fotoKk: number } | { ok: false; message: string }> {
  if (!tenggatPdpSudahLewat(input.acuan)) {
    return {
      ok: false,
      message: `Tenggat ${tanggalTenggatDataSpesifik()} belum lewat. Pemberitahuan dulu, baru data spesifik dikosongkan.`,
    };
  }

  const inventoriWarga = await supabase
    .from("warga")
    .select("id, nama_lengkap, tanggal_lahir, nik, pendapatan_bulanan, daya_listrik, kk_path")
    .eq("rt_id", input.rtId)
    .neq("status_aktif", false);
  if (inventoriWarga.error) {
    return { ok: false, message: "Daftar warga untuk tenggat belum dapat dibaca." };
  }

  const jejak = await supabase
    .from(TABEL_PERSETUJUAN)
    .select("warga_id, data_keuangan, dicatat_pada")
    .eq("rt_id", input.rtId)
    .order("dicatat_pada", { ascending: false });
  if (jejak.error) {
    return { ok: false, message: "Jejak persetujuan untuk tenggat belum dapat dibaca." };
  }

  const terbaru = new Map<string, { data_keuangan: boolean }>();
  for (const baris of jejak.data || []) {
    const id = String(baris.warga_id || "");
    if (!id || terbaru.has(id)) continue;
    terbaru.set(id, { data_keuangan: Boolean(baris.data_keuangan) });
  }

  const hapusPendapatan: string[] = [];
  const hapusFoto: { id: string; path: string }[] = [];
  for (const baris of inventoriWarga.data || []) {
    if (adalahArsipPemilu(baris)) continue;
    const id = String(baris.id);
    const izin = terbaru.get(id);
    const adaPendapatan = teks(baris.pendapatan_bulanan) !== "" || teks(baris.daya_listrik) !== "";
    if (adaPendapatan && !izin?.data_keuangan) hapusPendapatan.push(id);
    if (fotoKkAda(baris.kk_path) && !izin) {
      hapusFoto.push({ id, path: teks(baris.kk_path) });
    }
  }

  if (hapusPendapatan.length > 0) {
    const { error } = await supabase
      .from("warga")
      .update({ pendapatan_bulanan: null, daya_listrik: null })
      .eq("rt_id", input.rtId)
      .in("id", hapusPendapatan);
    if (error) return { ok: false, message: "Pendapatan belum dapat dikosongkan." };
  }

  const pathHapus: string[] = [];
  for (const item of hapusFoto) {
    const { error } = await supabase
      .from("warga")
      .update({ kk_path: null })
      .eq("rt_id", input.rtId)
      .eq("id", item.id);
    if (error) return { ok: false, message: "Foto KK belum dapat dikosongkan." };
    pathHapus.push(item.path);
  }

  if (pathHapus.length > 0) {
    const { error } = await supabase.storage.from("dokumen_warga").remove(pathHapus);
    if (error) console.error("Berkas KK tenggat gagal dihapus dari brankas:", error.message);
  }

  const { error: errAudit } = await supabase.from("audit_log").insert([{
    aktor: teks(input.aktor).slice(0, 150) || "Pengurus",
    aksi: "Tenggat PDP data spesifik",
    tabel_target: "warga",
    detail: `Dikosongkan pendapatan=${hapusPendapatan.length} KK; foto_kk=${hapusFoto.length} KK. Buku induk identitas tidak dihapus.`,
    rt_id: input.rtId,
  }]);
  if (errAudit) console.error("Audit tenggat PDP gagal:", errAudit.message);

  return { ok: true, pendapatan: hapusPendapatan.length, fotoKk: hapusFoto.length };
}

export async function izinKesehatanRumahTangga(
  supabase: SupabaseClient,
  wargaId: string,
  rtId: string,
  opsi?: { wajibAnak?: boolean }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const jejak = await ambilPersetujuanTerbaru(supabase, wargaId, rtId);
  if (!jejak.ok) return jejak;
  if (!jejak.data || !jejak.data.data_kesehatan) {
    return {
      ok: false,
      message: "Kunjungan posyandu individu ditolak: rumah tangga belum memberi izin data kesehatan.",
    };
  }
  if (opsi?.wajibAnak && !jejak.data.data_anak) {
    return {
      ok: false,
      message: "Kunjungan balita ditolak: izin wali data anak belum tercatat.",
    };
  }
  return { ok: true };
}

export async function terapkanPenarikanIzin(
  supabase: SupabaseClient,
  input: {
    wargaId: string;
    rtId: string;
    tarikKeuangan: boolean;
    tarikKesehatan: boolean;
    aktor: string;
  }
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (!input.tarikKeuangan && !input.tarikKesehatan) {
    return { ok: false, message: "Pilih izin keuangan atau kesehatan yang ingin ditarik." };
  }

  const jejak = await ambilPersetujuanTerbaru(supabase, input.wargaId, input.rtId);
  if (!jejak.ok) return jejak;
  const terakhir = jejak.data;
  const persetujuan: PersetujuanLaporDiri = {
    versi_naskah: VERSI_KEBIJAKAN_PRIVASI,
    baca_kebijakan: true,
    data_pribadi: terakhir?.data_pribadi !== false,
    data_anggota: Boolean(terakhir?.data_anggota),
    data_anak: Boolean(terakhir?.data_anak),
    data_keuangan: input.tarikKeuangan ? false : Boolean(terakhir?.data_keuangan),
    data_kesehatan: input.tarikKesehatan ? false : Boolean(terakhir?.data_kesehatan),
  };

  const catat = await catatPersetujuanData(supabase, {
    wargaId: input.wargaId,
    rtId: input.rtId,
    sumber: "penarikan",
    persetujuan,
    jumlahAnggota: 0,
    jumlahAnak: 0,
    aktorAudit: input.aktor,
  });
  if (!catat.ok) return catat;

  if (input.tarikKeuangan) {
    const { error } = await supabase
      .from("warga")
      .update({ pendapatan_bulanan: null, daya_listrik: null })
      .eq("id", input.wargaId)
      .eq("rt_id", input.rtId);
    if (error) return { ok: false, message: "Izin tercatat, tetapi pendapatan belum dapat dikosongkan." };
  }

  return {
    ok: true,
    message: input.tarikKeuangan && input.tarikKesehatan
      ? "Izin keuangan dan kesehatan ditarik. Pendapatan dikosongkan; kunjungan posyandu baru ditolak."
      : input.tarikKeuangan
        ? "Izin keuangan ditarik. Kisaran pendapatan dan daya listrik dikosongkan."
        : "Izin kesehatan ditarik. Kunjungan posyandu individu baru ditolak.",
  };
}

export async function catatJejakEksporBukuInduk(
  supabase: SupabaseClient,
  input: { rtId: string; aktor: string; jumlahKk: number }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("audit_log").insert([{
    aktor: teks(input.aktor).slice(0, 150) || "Pengurus",
    aksi: "Ekspor PDF buku induk",
    tabel_target: "warga",
    detail: `Mengunduh PDF buku induk ${input.jumlahKk} KK. Berkas rahasia, jangan disebar.`,
    rt_id: input.rtId,
  }]);
  if (error) {
    console.error("Jejak ekspor PDF gagal:", error.message);
    return { ok: false, message: "Jejak ekspor belum tercatat. Unduhan dibatalkan." };
  }
  return { ok: true };
}
