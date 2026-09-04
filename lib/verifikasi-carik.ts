import type { SupabaseClient } from "@supabase/supabase-js";
import { prosesHapusAtauArsipWarga } from "@/lib/arsip-warga";

export const PILIHAN_STATUS_TINGGAL = [
  "Warga Tetap",
  "Penyewa Kos",
  "Penyewa Kontrakan",
] as const;

export const PILIHAN_AGAMA = [
  "Islam",
  "Kristen/Katolik",
  "Hindu",
  "Budha",
  "Konghucu",
] as const;

export const PILIHAN_JENIS_KELAMIN = ["Laki-laki", "Perempuan"] as const;

export const PILIHAN_PENDAPATAN = [
  "< 1 Juta",
  "1 - 3 Juta",
  "3 - 5 Juta",
  "5 - 10 Juta",
  "> 10 Juta",
] as const;

export const PILIHAN_DAYA_LISTRIK = [
  "450 VA (Subsidi)",
  "900 VA (Subsidi)",
  "900 VA (Non-Subsidi)",
  "1300 VA",
  "2200 VA",
  "> 2200 VA",
] as const;

export const PILIHAN_HUBUNGAN = ["Istri", "Suami", "Anak", "Lainnya"] as const;

export const BIDANG_WAJIB_CARIK = [
  "nama_lengkap",
  "tempat_lahir",
  "tanggal_lahir",
  "jenis_kelamin",
  "agama",
  "pekerjaan",
  "no_whatsapp",
  "status_tinggal",
  "detail_alamat",
  "pendapatan_bulanan",
  "daya_listrik",
] as const;

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TANGGAL_ARSIP = "1900-01-01";
const NAMA_ARSIP = "arsip pemilih";

export type HasilCarik = {
  success: boolean;
  message: string;
  arah?: string;
  duplikatDihapus?: number;
};

export type AnggotaInput = {
  id?: string;
  nama_lengkap: string;
  nik: string;
  hubungan_keluarga: string;
  hubungan_detail?: string | null;
  tanggal_lahir: string;
  tempat_lahir: string;
  jenis_kelamin: string;
  agama: string;
  pekerjaan: string;
};

export type BiodataInput = {
  nama_lengkap: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  jenis_kelamin: string;
  agama: string;
  pekerjaan: string;
  no_whatsapp: string;
  status_tinggal: string;
  detail_alamat: string;
  pendapatan_bulanan: string;
  daya_listrik: string;
};

export type DuplikatWarga = {
  id: string;
  nik: string;
  nama_lengkap: string;
  tanggal_lahir: string | null;
  alasan: "nik_sama" | "identitas_sama" | "nik_sebagai_anggota";
  sumber: "warga" | "anggota_keluarga";
  warga_induk_id?: string | null;
};

export type RingkasanCarik = {
  id: string;
  catatan_tambahan: string | null;
  status_validasi: string | null;
  created_at: string | null;
};

type BarisWarga = {
  id: string;
  nik: string;
  nama_lengkap: string;
  tanggal_lahir: string | null;
};

function teks(nilai: unknown) {
  return String(nilai ?? "").trim();
}

export function nilaiKosong(nilai: unknown) {
  const isi = teks(nilai);
  return isi === "" || isi === "-" || isi === "MENYUSUL";
}

export function adalahArsipPemilu(baris: { nama_lengkap?: string | null; tanggal_lahir?: string | null; nik?: string | null }) {
  const nama = teks(baris.nama_lengkap).toLowerCase();
  const tgl = teks(baris.tanggal_lahir).slice(0, 10);
  const nik = teks(baris.nik);
  return nama === NAMA_ARSIP || tgl === TANGGAL_ARSIP || (nik.startsWith("99") && nama === NAMA_ARSIP);
}

export function nilaiAda(nilai: unknown) {
  return !nilaiKosong(nilai);
}

export function hitungKelengkapan(warga: Record<string, unknown>) {
  const terisi = BIDANG_WAJIB_CARIK.filter((kolom) => nilaiAda(warga[kolom]));
  return {
    terisi: terisi.length,
    wajib: BIDANG_WAJIB_CARIK.length,
    persen: Math.round((terisi.length / BIDANG_WAJIB_CARIK.length) * 100),
    kosong: BIDANG_WAJIB_CARIK.filter((kolom) => !nilaiAda(warga[kolom])),
  };
}

export function validasiNik(nikInput: string, pemilik: string): string | null {
  const nik = teks(nikInput).replace(/\D/g, "");
  if (nik.length !== 16) return `NIK ${pemilik} harus 16 digit.`;
  if (/^(\d)\1{15}$/.test(nik)) return `NIK ${pemilik} terdeteksi tidak sah (angka berulang).`;
  if (nik === "1234567890123456") return `NIK ${pemilik} tidak valid.`;
  return null;
}

function normalisasiTanggal(nilai: unknown) {
  const isi = teks(nilai).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(isi) ? isi : "";
}

function dalamDaftar<T extends string>(nilai: string, daftar: readonly T[]) {
  return (daftar as readonly string[]).includes(nilai);
}

function normalisasiJenisKelamin(nilai: string) {
  const n = nilai.toLowerCase();
  if (n.startsWith("l")) return "Laki-laki";
  if (n.startsWith("p")) return "Perempuan";
  return nilai;
}

export function sanitasiBiodata(mentah: Record<string, unknown>): { ok: true; data: BiodataInput } | { ok: false; message: string } {
  // NIK sengaja dibuang di sini: kolom itu gembok identitas dan tidak boleh
  // ikut payload UPDATE, baik dari warga maupun pengurus.
  const { nik: _nikDiabaikan, pin: _pinDiabaikan, id: _idDiabaikan, ...sisa } = mentah;

  const data: BiodataInput = {
    nama_lengkap: teks(sisa.nama_lengkap).slice(0, 150),
    tempat_lahir: teks(sisa.tempat_lahir).slice(0, 100),
    tanggal_lahir: normalisasiTanggal(sisa.tanggal_lahir),
    jenis_kelamin: normalisasiJenisKelamin(teks(sisa.jenis_kelamin)),
    agama: teks(sisa.agama),
    pekerjaan: teks(sisa.pekerjaan).slice(0, 100),
    no_whatsapp: teks(sisa.no_whatsapp).replace(/[^\d+]/g, ""),
    status_tinggal: teks(sisa.status_tinggal),
    detail_alamat: teks(sisa.detail_alamat).slice(0, 300),
    pendapatan_bulanan: teks(sisa.pendapatan_bulanan),
    daya_listrik: teks(sisa.daya_listrik),
  };

  if (!data.nama_lengkap) return { ok: false, message: "Nama lengkap wajib diisi." };
  if (!data.tempat_lahir) return { ok: false, message: "Tempat lahir wajib diisi." };
  if (!data.tanggal_lahir) return { ok: false, message: "Tanggal lahir wajib diisi." };
  if (!dalamDaftar(data.jenis_kelamin, PILIHAN_JENIS_KELAMIN)) {
    return { ok: false, message: "Jenis kelamin belum dipilih dengan benar." };
  }
  if (!data.agama) {
    return { ok: false, message: "Agama wajib dipilih." };
  }
  if (!data.pekerjaan) return { ok: false, message: "Pekerjaan wajib diisi." };
  if (data.no_whatsapp.replace(/\D/g, "").length < 10) {
    return { ok: false, message: "Nomor WhatsApp wajib diisi (minimal 10 digit, mulai 08)." };
  }
  if (!dalamDaftar(data.status_tinggal, PILIHAN_STATUS_TINGGAL)) {
    return { ok: false, message: "Status tinggal harus Warga Tetap, Penyewa Kos, atau Penyewa Kontrakan." };
  }
  if (!data.detail_alamat) return { ok: false, message: "Detail alamat (gang/blok/nomor rumah) wajib diisi." };
  if (!data.pendapatan_bulanan) {
    return { ok: false, message: "Pendapatan bulanan wajib dipilih." };
  }
  if (!data.daya_listrik) {
    return { ok: false, message: "Daya listrik terpasang wajib dipilih." };
  }

  return { ok: true, data };
}

function sanitasiAnggota(
  daftar: AnggotaInput[],
  nikKepala: string
): { ok: true; data: AnggotaInput[] } | { ok: false; message: string } {
  const nikTerpakai = new Set<string>([teks(nikKepala)]);
  const bersih: AnggotaInput[] = [];

  for (let i = 0; i < daftar.length; i++) {
    const a = daftar[i];
    const label = teks(a.nama_lengkap) || `Anggota ${i + 1}`;
    const nama = teks(a.nama_lengkap).slice(0, 150);
    const nik = teks(a.nik).replace(/\D/g, "");
    const hubungan = teks(a.hubungan_keluarga);
    const errNik = validasiNik(nik, label);
    if (errNik) return { ok: false, message: errNik };
    if (!nama) return { ok: false, message: `Nama ${label} wajib diisi.` };
    if (!hubungan) {
      return { ok: false, message: `Hubungan keluarga untuk ${label} wajib dipilih.` };
    }
    if (hubungan === "Lainnya" && !teks(a.hubungan_detail)) {
      return { ok: false, message: `Jelaskan hubungan keluarga untuk ${label}.` };
    }
    if (!teks(a.tempat_lahir)) return { ok: false, message: `Tempat lahir ${label} wajib diisi.` };
    if (!normalisasiTanggal(a.tanggal_lahir)) return { ok: false, message: `Tanggal lahir ${label} wajib diisi.` };
    const gender = normalisasiJenisKelamin(teks(a.jenis_kelamin));
    if (!dalamDaftar(gender, PILIHAN_JENIS_KELAMIN)) {
      return { ok: false, message: `Jenis kelamin ${label} wajib dipilih.` };
    }
    if (!teks(a.agama)) {
      return { ok: false, message: `Agama ${label} wajib dipilih.` };
    }
    if (!teks(a.pekerjaan)) return { ok: false, message: `Pekerjaan ${label} wajib diisi.` };
    if (nikTerpakai.has(nik)) {
      return { ok: false, message: `NIK ${nik} dipakai lebih dari sekali dalam keluarga ini.` };
    }
    nikTerpakai.add(nik);

    bersih.push({
      id: a.id && POLA_UUID.test(a.id) ? a.id : undefined,
      nama_lengkap: nama,
      nik,
      hubungan_keluarga: hubungan,
      hubungan_detail: hubungan === "Lainnya" ? teks(a.hubungan_detail).slice(0, 80) : null,
      tanggal_lahir: normalisasiTanggal(a.tanggal_lahir),
      tempat_lahir: teks(a.tempat_lahir).slice(0, 100),
      jenis_kelamin: gender,
      agama: teks(a.agama),
      pekerjaan: teks(a.pekerjaan).slice(0, 100),
    });
  }

  return { ok: true, data: bersih };
}

export async function cariDuplikatWarga(
  supabase: SupabaseClient,
  warga: { id: string; nik: string; nama_lengkap: string; tanggal_lahir: string | null }
): Promise<DuplikatWarga[]> {
  const hasil: DuplikatWarga[] = [];
  const nik = teks(warga.nik);
  const nama = teks(warga.nama_lengkap).toLowerCase();
  const tgl = normalisasiTanggal(warga.tanggal_lahir);
  const sudah = new Set<string>();

  const catat = (item: DuplikatWarga) => {
    const kunci = `${item.sumber}:${item.id}`;
    if (sudah.has(kunci) || item.id === warga.id) return;
    if (adalahArsipPemilu(item)) return;
    sudah.add(kunci);
    hasil.push(item);
  };

  if (nik.length === 16) {
    const { data: nikSama } = await supabase
      .from("warga")
      .select("id, nik, nama_lengkap, tanggal_lahir")
      .eq("nik", nik)
      .neq("id", warga.id);

    for (const baris of (nikSama || []) as BarisWarga[]) {
      catat({
        id: baris.id,
        nik: baris.nik,
        nama_lengkap: baris.nama_lengkap,
        tanggal_lahir: baris.tanggal_lahir,
        alasan: "nik_sama",
        sumber: "warga",
      });
    }

    const { data: sebagaiAnggota } = await supabase
      .from("anggota_keluarga")
      .select("id, nik, nama_lengkap, tanggal_lahir, warga_id")
      .eq("nik", nik)
      .neq("warga_id", warga.id);

    for (const baris of sebagaiAnggota || []) {
      catat({
        id: String(baris.id),
        nik: String(baris.nik || ""),
        nama_lengkap: String(baris.nama_lengkap || ""),
        tanggal_lahir: (baris.tanggal_lahir as string | null) ?? null,
        alasan: "nik_sebagai_anggota",
        sumber: "anggota_keluarga",
        warga_induk_id: (baris.warga_id as string | null) ?? null,
      });
    }
  }

  if (nama && nama !== NAMA_ARSIP && tgl && tgl !== TANGGAL_ARSIP) {
    const { data: identitasSama } = await supabase
      .from("warga")
      .select("id, nik, nama_lengkap, tanggal_lahir")
      .eq("tanggal_lahir", tgl)
      .neq("id", warga.id);

    for (const baris of (identitasSama || []) as BarisWarga[]) {
      if (teks(baris.nama_lengkap).toLowerCase() !== nama) continue;
      catat({
        id: baris.id,
        nik: baris.nik,
        nama_lengkap: baris.nama_lengkap,
        tanggal_lahir: baris.tanggal_lahir,
        alasan: "identitas_sama",
        sumber: "warga",
      });
    }
  }

  return hasil;
}

async function hapusDuplikatTerdeteksi(
  supabase: SupabaseClient,
  duplikat: DuplikatWarga[],
  aktor: string
) {
  let terhapus = 0;

  for (const item of duplikat) {
    if (item.sumber === "anggota_keluarga") {
      const { error } = await supabase.from("anggota_keluarga").delete().eq("id", item.id);
      if (!error) terhapus += 1;
      continue;
    }

    const hasil = await prosesHapusAtauArsipWarga(supabase, item.id, aktor);
    if (hasil.success) terhapus += 1;
  }

  return terhapus;
}

async function gabungkanKkDobelKeAnggota(
  supabase: SupabaseClient,
  wargaTujuanId: string,
  rtId: string | null,
  nikAnggota: string,
  aktor: string,
  nikYangDipertahankan: Set<string>
): Promise<{ ok: true; idDipindah: string[] } | { ok: false; message: string }> {
  const nik = teks(nikAnggota);
  const { data: kkLain, error } = await supabase
    .from("warga")
    .select("id, nama_lengkap, nik")
    .eq("nik", nik)
    .neq("id", wargaTujuanId)
    .maybeSingle();

  if (error) return { ok: false, message: `Gagal memeriksa NIK ${nik}: ${error.message}` };
  if (!kkLain || adalahArsipPemilu(kkLain)) return { ok: true, idDipindah: [] };

  const idDipindah: string[] = [];
  const { data: tanggungan, error: errTanggungan } = await supabase
    .from("anggota_keluarga")
    .select("id, nik")
    .eq("warga_id", kkLain.id);

  if (errTanggungan) {
    return { ok: false, message: `Gagal membaca tanggungan ${kkLain.nama_lengkap}: ${errTanggungan.message}` };
  }

  for (const t of tanggungan || []) {
    if (teks(t.nik) === nik) continue;
    if (nikYangDipertahankan.has(teks(t.nik))) continue;
    const { error: errPindah } = await supabase
      .from("anggota_keluarga")
      .update({ warga_id: wargaTujuanId, rt_id: rtId })
      .eq("id", t.id);
    if (errPindah) {
      return { ok: false, message: `Gagal memindahkan tanggungan dari data dobel: ${errPindah.message}` };
    }
    idDipindah.push(String(t.id));
  }

  const hapus = await prosesHapusAtauArsipWarga(supabase, String(kkLain.id), aktor);
  if (!hapus.success) {
    return {
      ok: false,
      message: `${kkLain.nama_lengkap} tercatat dobel sebagai kepala keluarga. Gagal menggabungkan: ${hapus.message}`,
    };
  }

  await catatAudit(
    supabase,
    aktor,
    "Gabung KK Dobel menjadi Anggota Keluarga",
    `NIK ${nik} (${kkLain.nama_lengkap}) yang terimpor sebagai KK terpisah digabung ke KK ${wargaTujuanId}.`
  );

  return { ok: true, idDipindah };
}

async function sinkronAnggota(
  supabase: SupabaseClient,
  wargaId: string,
  rtId: string | null,
  anggotaBaru: AnggotaInput[],
  aktor: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: anggotaLama, error: errLama } = await supabase
    .from("anggota_keluarga")
    .select("id")
    .eq("warga_id", wargaId);

  if (errLama) {
    return { ok: false, message: `Gagal membaca anggota keluarga: ${errLama.message}` };
  }

  const idLama = new Set((anggotaLama || []).map((a) => String(a.id)));
  const idTertahan = new Set<string>();

  const nikYangDipertahankan = new Set(anggotaBaru.map((a) => teks(a.nik)));

  for (const a of anggotaBaru) {
    const gabung = await gabungkanKkDobelKeAnggota(supabase, wargaId, rtId, a.nik, aktor, nikYangDipertahankan);
    if (!gabung.ok) return gabung;
    for (const id of gabung.idDipindah) idTertahan.add(id);

    if (a.id && idLama.has(a.id)) {
      idTertahan.add(a.id);
      const { error } = await supabase
        .from("anggota_keluarga")
        .update({
          nama_lengkap: a.nama_lengkap,
          hubungan_keluarga: a.hubungan_keluarga,
          hubungan_detail: a.hubungan_detail,
          tanggal_lahir: a.tanggal_lahir,
          tempat_lahir: a.tempat_lahir,
          jenis_kelamin: a.jenis_kelamin,
          agama: a.agama,
          pekerjaan: a.pekerjaan,
        })
        .eq("id", a.id)
        .eq("warga_id", wargaId);

      if (error) {
        return { ok: false, message: `Gagal memperbarui data ${a.nama_lengkap}: ${error.message}` };
      }
      continue;
    }

    const { error } = await supabase.from("anggota_keluarga").insert([
      {
        warga_id: wargaId,
        rt_id: rtId,
        nama_lengkap: a.nama_lengkap,
        nik: a.nik,
        hubungan_keluarga: a.hubungan_keluarga,
        hubungan_detail: a.hubungan_detail,
        tanggal_lahir: a.tanggal_lahir,
        tempat_lahir: a.tempat_lahir,
        jenis_kelamin: a.jenis_kelamin,
        agama: a.agama,
        pekerjaan: a.pekerjaan,
      },
    ]);

    if (error) {
      return { ok: false, message: `Gagal menambah ${a.nama_lengkap}: ${error.message}` };
    }
  }

  for (const id of idLama) {
    if (idTertahan.has(id)) continue;
    const { error } = await supabase.from("anggota_keluarga").delete().eq("id", id).eq("warga_id", wargaId);
    if (error) {
      return { ok: false, message: `Gagal menghapus anggota lama: ${error.message}` };
    }
  }

  return { ok: true };
}

async function catatAudit(supabase: SupabaseClient, aktor: string, aksi: string, detail: string) {
  const { error } = await supabase.from("audit_log").insert([
    { aktor, aksi, tabel_target: "warga", detail },
  ]);
  if (error) console.error("Audit log verifikasi carik gagal:", error.message);
}

async function tandaiSensus(
  supabase: SupabaseClient,
  wargaId: string,
  catatan: string,
  status: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: sudahAda, error: errCek } = await supabase
    .from("sensus_kesejahteraan")
    .select("id")
    .eq("warga_id", wargaId)
    .maybeSingle();

  if (errCek) {
    return { ok: false, message: `Gagal memeriksa status verifikasi carik: ${errCek.message}` };
  }

  const payload = {
    catatan_tambahan: catatan,
    status_validasi: status,
    ada_ibu_hamil: false,
    ada_disabilitas: false,
    ada_ibu_menyusui: false,
    ada_ibu_meninggal: false,
    ada_bayi_meninggal: false,
    ada_balita_meninggal: false,
    ada_bayi_baru_lahir: false,
    bayi_tanpa_akta: false,
    ada_ibu_nifas: false,
    memiliki_mck: true,
    memiliki_tempat_sampah: true,
    memiliki_spal: true,
    memiliki_resapan_air: true,
    sumber_air_utama: "PAM / Leding",
    status_kesehatan_rumah: "Rumah Sehat",
    jenis_makanan_pokok: "Beras / Nasi",
  };

  if (sudahAda?.id) {
    const { error } = await supabase.from("sensus_kesejahteraan").update(payload).eq("id", sudahAda.id);
    if (error) return { ok: false, message: `Gagal memperbarui cap verifikasi: ${error.message}` };
    return { ok: true };
  }

  const { error } = await supabase.from("sensus_kesejahteraan").insert([{ warga_id: wargaId, ...payload }]);
  if (error) return { ok: false, message: `Gagal mencatat verifikasi carik: ${error.message}` };
  return { ok: true };
}

export async function simpanVerifikasiCarik(
  supabase: SupabaseClient,
  wargaId: string,
  biodataMentah: Record<string, unknown>,
  anggotaMentah: AnggotaInput[],
  catatan: string,
  aktor: string,
  opsi?: { hapusDuplikat?: boolean; capCarik?: boolean }
): Promise<HasilCarik> {
  if (!POLA_UUID.test(wargaId)) {
    return { success: false, message: "ID warga tidak valid." };
  }

  const { data: warga, error: errWarga } = await supabase
    .from("warga")
    .select("id, nik, nama_lengkap, rt_id, tanggal_lahir")
    .eq("id", wargaId)
    .maybeSingle();

  if (errWarga) return { success: false, message: `Gagal membaca data warga: ${errWarga.message}` };
  if (!warga) return { success: false, message: "Data warga tidak ditemukan. Mungkin sudah dihapus." };

  const biodata = sanitasiBiodata(biodataMentah);
  if (!biodata.ok) return { success: false, message: biodata.message };

  const anggota = sanitasiAnggota(Array.isArray(anggotaMentah) ? anggotaMentah : [], String(warga.nik));
  if (!anggota.ok) return { success: false, message: anggota.message };

  const { error: errUpdate } = await supabase
    .from("warga")
    .update(biodata.data)
    .eq("id", wargaId);

  if (errUpdate) {
    return { success: false, message: `Gagal menyimpan biodata: ${errUpdate.message}` };
  }

  const sinkron = await sinkronAnggota(
    supabase,
    wargaId,
    (warga.rt_id as string | null) ?? null,
    anggota.data,
    aktor
  );
  if (!sinkron.ok) return { success: false, message: sinkron.message };

  let duplikatDihapus = 0;
  if (opsi?.hapusDuplikat !== false && opsi?.capCarik !== false) {
    const duplikat = await cariDuplikatWarga(supabase, {
      id: wargaId,
      nik: String(warga.nik),
      nama_lengkap: biodata.data.nama_lengkap,
      tanggal_lahir: biodata.data.tanggal_lahir,
    });
    duplikatDihapus = await hapusDuplikatTerdeteksi(supabase, duplikat, aktor);
  }

  if (opsi?.capCarik !== false) {
    const catatanCap = teks(catatan) || "Data Carik divalidasi mandiri oleh warga";
    const cap = await tandaiSensus(supabase, wargaId, catatanCap, "Disetujui");
    if (!cap.ok) return { success: false, message: cap.message };
  }

  const tambahanDuplikat =
    duplikatDihapus > 0
      ? ` ${duplikatDihapus} data kembar dihapus agar satu NIK hanya punya satu catatan.`
      : "";

  await catatAudit(
    supabase,
    aktor,
    opsi?.capCarik === false ? "Edit Data Warga" : "Verifikasi Data Carik",
    `NIK ${warga.nik} (${biodata.data.nama_lengkap}) ${opsi?.capCarik === false ? "diperbarui tanpa mengubah NIK." : "mengonfirmasi data warisan."}${tambahanDuplikat}`
  );

  return {
    success: true,
    message:
      opsi?.capCarik === false
        ? `Biodata dan anggota keluarga berhasil diperbarui. NIK tetap terkunci.${tambahanDuplikat}`
        : `Data keluarga berhasil diverifikasi.${tambahanDuplikat}`,
    duplikatDihapus,
    arah: opsi?.capCarik === false ? undefined : "/portal",
  };
}

export async function simpanBiodataTanpaCap(
  supabase: SupabaseClient,
  wargaId: string,
  biodataMentah: Record<string, unknown>,
  aktor: string
): Promise<HasilCarik> {
  if (!POLA_UUID.test(wargaId)) {
    return { success: false, message: "ID warga tidak valid." };
  }

  const biodata = sanitasiBiodata(biodataMentah);
  if (!biodata.ok) return { success: false, message: biodata.message };

  const { data: warga, error: errWarga } = await supabase
    .from("warga")
    .select("id, nik, nama_lengkap")
    .eq("id", wargaId)
    .maybeSingle();

  if (errWarga) return { success: false, message: `Gagal membaca data warga: ${errWarga.message}` };
  if (!warga) return { success: false, message: "Data warga tidak ditemukan." };

  const { error } = await supabase.from("warga").update(biodata.data).eq("id", wargaId);
  if (error) return { success: false, message: `Gagal menyimpan biodata: ${error.message}` };

  await catatAudit(
    supabase,
    aktor,
    "Edit Data Warga",
    `Memperbarui biodata NIK ${warga.nik} (${biodata.data.nama_lengkap}) tanpa mengubah NIK.`
  );

  return { success: true, message: "Biodata berhasil diperbarui. NIK tetap terkunci." };
}

export async function hapusKarenaNikTidakSesuai(
  supabase: SupabaseClient,
  wargaId: string,
  aktor: string
): Promise<HasilCarik> {
  if (!POLA_UUID.test(wargaId)) {
    return { success: false, message: "ID warga tidak valid." };
  }

  const { data: warga, error } = await supabase
    .from("warga")
    .select("id, nik, nama_lengkap")
    .eq("id", wargaId)
    .maybeSingle();

  if (error) return { success: false, message: `Gagal membaca data warga: ${error.message}` };
  if (!warga) {
    return {
      success: true,
      message: "Data ini sudah tidak ada di buku induk. Silakan daftar ulang dengan NIK yang benar.",
      arah: "/register?alasan=nik-tidak-sesuai",
    };
  }

  const hasil = await prosesHapusAtauArsipWarga(supabase, wargaId, aktor);
  if (!hasil.success) return { success: false, message: hasil.message };

  await catatAudit(
    supabase,
    aktor,
    "Hapus Warga karena NIK Tidak Sesuai",
    `NIK ${warga.nik} (${warga.nama_lengkap}) dihapus/diarsipkan. Warga wajib lapor diri ulang dengan NIK yang benar.`
  );

  const tambahanArsip =
    hasil.mode === "arsip_pemilu"
      ? " Indeks pemilih e-voting tetap disimpan, tetapi akun portal ini tidak bisa dipakai lagi."
      : "";

  return {
    success: true,
    message: `Data lama dihapus karena NIK tidak sesuai.${tambahanArsip} Silakan daftar ulang dengan NIK yang tertera di KTP.`,
    arah: "/register?alasan=nik-tidak-sesuai",
  };
}

export async function hapusDuplikatPilihan(
  supabase: SupabaseClient,
  idTarget: string,
  idYangDitahan: string,
  aktor: string
): Promise<HasilCarik> {
  if (!POLA_UUID.test(idTarget) || !POLA_UUID.test(idYangDitahan)) {
    return { success: false, message: "ID warga tidak valid." };
  }
  if (idTarget === idYangDitahan) {
    return { success: false, message: "Tidak bisa menghapus data yang sedang dibuka. Pilih data kembar yang lain." };
  }

  const hasil = await prosesHapusAtauArsipWarga(supabase, idTarget, aktor);
  if (!hasil.success) return { success: false, message: hasil.message };

  await catatAudit(
    supabase,
    aktor,
    "Hapus Data Warga Kembar",
    `Menghapus duplikat ${idTarget}; data yang dipertahankan: ${idYangDitahan}.`
  );

  return { success: true, message: hasil.message || "Data kembar berhasil dihapus." };
}

export async function ambilStatusCarik(supabase: SupabaseClient, wargaId: string) {
  const { data, error } = await supabase
    .from("sensus_kesejahteraan")
    .select("id, catatan_tambahan, status_validasi, created_at")
    .eq("warga_id", wargaId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, message: `Gagal membaca status carik: ${error.message}` };
  }

  return { ok: true as const, data: (data as RingkasanCarik | null) ?? null };
}
