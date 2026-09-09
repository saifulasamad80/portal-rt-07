#!/usr/bin/env node
/**
 * Menyelaraskan warga dengan CSV lawas.
 * Default: dry-run. Tidak mencetak NIK / No. KK.
 *
 *   node --env-file=.env.local scripts/selaraskan-warga-csv.mjs
 *   node --env-file=.env.local scripts/selaraskan-warga-csv.mjs --apply --konfirmasi=SELARASKAN-WARGA
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FOLDER_PRIVAT = path.join(AKAR, "data-privat");
const BERKAS_CSV_BAWAAN = [
  path.join(FOLDER_PRIVAT, "Data_lawas_07_lengkap.csv"),
  path.join(FOLDER_PRIVAT, "Data_lawas_07.csv"),
  path.join(FOLDER_PRIVAT, "Data_lawas_07_rev.csv"),
];
const TOKEN_KONFIRMASI = "SELARASKAN-WARGA";
const TABEL_TURUNAN = [
  "anggota_keluarga",
  "jadwal_ronda",
  "kas_rt",
  "lapak_warga",
  "laporan_warga",
  "limbah_ekonomis",
  "peminjaman_inventaris",
  "push_langganan",
  "sensus_kesejahteraan",
  "tabungan_kurban",
  "transaksi_kurban",
  "transaksi_sampah",
];

function gagal(pesan, kode = 1) {
  console.error(pesan);
  process.exit(kode);
}

function teks(nilai) {
  return String(nilai ?? "").trim();
}

function nikSah(nilai) {
  const digit = teks(nilai).replace(/\D/g, "");
  return digit.length === 16 ? digit : "";
}

function muatEnvLokal() {
  for (const nama of [".env.local", ".env"]) {
    const lokasi = path.join(AKAR, nama);
    if (!fs.existsSync(lokasi)) continue;
    for (const baris of fs.readFileSync(lokasi, "utf8").split(/\r?\n/)) {
      const potong = baris.trim();
      if (!potong || potong.startsWith("#")) continue;
      const posisi = potong.indexOf("=");
      if (posisi <= 0) continue;
      const kunci = potong.slice(0, posisi).trim();
      let nilai = potong.slice(posisi + 1).trim();
      if (
        (nilai.startsWith('"') && nilai.endsWith('"')) ||
        (nilai.startsWith("'") && nilai.endsWith("'"))
      ) {
        nilai = nilai.slice(1, -1);
      }
      if (process.env[kunci] == null || process.env[kunci] === "") {
        process.env[kunci] = nilai;
      }
    }
  }
}

function parseCsv(mentah) {
  const baris = [];
  let barisIni = [];
  let medan = "";
  let dalamKutip = false;
  const teksCsv = mentah.replace(/^\uFEFF/, "");
  for (let i = 0; i < teksCsv.length; i += 1) {
    const huruf = teksCsv[i];
    if (dalamKutip) {
      if (huruf === '"') {
        if (teksCsv[i + 1] === '"') {
          medan += '"';
          i += 1;
        } else dalamKutip = false;
      } else medan += huruf;
      continue;
    }
    if (huruf === '"') {
      dalamKutip = true;
      continue;
    }
    if (huruf === ",") {
      barisIni.push(medan);
      medan = "";
      continue;
    }
    if (huruf === "\n") {
      barisIni.push(medan.replace(/\r$/, ""));
      baris.push(barisIni);
      barisIni = [];
      medan = "";
      continue;
    }
    medan += huruf;
  }
  if (medan.length || barisIni.length) {
    barisIni.push(medan.replace(/\r$/, ""));
    baris.push(barisIni);
  }
  return baris.filter((r) => r.some((sel) => teks(sel) !== ""));
}

function kunciHeader(nama) {
  return teks(nama)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function setNikCsv() {
  const csvArg = process.argv.find((a) => a.startsWith("--csv="))?.slice("--csv=".length) || "";
  const kandidat = csvArg
    ? [path.resolve(csvArg)]
    : BERKAS_CSV_BAWAAN;
  const lokasi = kandidat.find((p) => fs.existsSync(p));
  if (!lokasi) gagal("CSV lawas tidak ditemukan di data-privat/.");
  const tabel = parseCsv(fs.readFileSync(lokasi, "utf8"));
  const header = tabel[0].map(kunciHeader);
  const iNik = header.findIndex((h) => h === "nik");
  if (iNik < 0) gagal("CSV tidak punya kolom NIK.");
  const set = new Set();
  for (const r of tabel.slice(1)) {
    const nik = nikSah(r[iNik]);
    if (nik) set.add(nik);
  }
  return { lokasi, unikSah: set, barisData: tabel.length - 1 };
}

async function muatSemua(supabase, tabel, kolom) {
  const semua = [];
  let dari = 0;
  const ukuran = 1000;
  for (;;) {
    const { data, error } = await supabase.from(tabel).select(kolom).range(dari, dari + ukuran - 1);
    if (error) throw error;
    const batch = data || [];
    semua.push(...batch);
    if (batch.length < ukuran) break;
    dari += ukuran;
  }
  return semua;
}

async function bersihkanRelasi(supabase, wargaId, rtId) {
  const { data: lapak } = await supabase.from("lapak_warga").select("id").eq("warga_id", wargaId);
  if (lapak?.length) {
    await supabase.from("limbah_ekonomis").update({ teknisi_id: null }).in(
      "teknisi_id",
      lapak.map((l) => l.id)
    );
  }
  for (const tabel of TABEL_TURUNAN) {
    if (rtId) {
      await supabase.from(tabel).update({ rt_id: rtId }).eq("warga_id", wargaId).is("rt_id", null);
    }
    let hapus = supabase.from(tabel).delete().eq("warga_id", wargaId);
    if (rtId) hapus = hapus.eq("rt_id", rtId);
    const { error } = await hapus;
    if (!error) continue;
    const pesan = `${error.message || ""} ${error.code || ""}`;
    if (error.code === "42P01" || error.code === "42703" || /rt_id wajib/i.test(pesan)) {
      continue;
    }
    throw new Error(`${tabel}: ${error.message}`);
  }
}

async function relatedCount(supabase, tabel, kolom, id) {
  const { count, error } = await supabase.from(tabel).select(kolom, { count: "exact", head: true }).eq(kolom, id);
  if (error && (error.code === "42P01" || error.code === "42703")) return 0;
  if (error) throw error;
  return count || 0;
}

async function main() {
  muatEnvLokal();
  const apply = process.argv.includes("--apply");
  const konfirmasi = process.argv.find((a) => a.startsWith("--konfirmasi="))?.slice("--konfirmasi=".length) || "";
  if (apply && konfirmasi !== TOKEN_KONFIRMASI) {
    gagal(`Apply ditolak. Tambahkan --konfirmasi=${TOKEN_KONFIRMASI}`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunci) gagal("SUPABASE_SERVICE_ROLE_KEY / URL belum ada di .env.local");
  const supabase = createClient(url, kunci, { auth: { persistSession: false, autoRefreshToken: false } });

  const csv = setNikCsv();
  const wargaDb = await muatSemua(supabase, "warga", "id, nik, status_aktif, status_verifikasi, rt_id");
  const anggotaDb = await muatSemua(supabase, "anggota_keluarga", "id, nik, warga_id");

  const anggotaByNik = new Map();
  const anggotaByKk = new Map();
  for (const a of anggotaDb) {
    const nik = nikSah(a.nik);
    if (nik) anggotaByNik.set(nik, a);
    if (!anggotaByKk.has(a.warga_id)) anggotaByKk.set(a.warga_id, []);
    anggotaByKk.get(a.warga_id).push(a);
  }

  const wargaNikKosong = [];
  const wargaTidakDiCsv = [];
  const pindahTanggungan = [];
  const antrekanMenunggu = [];

  for (const w of wargaDb) {
    const nik = nikSah(w.nik);
    if (!nik) {
      wargaNikKosong.push(w);
      continue;
    }
    if (!csv.unikSah.has(nik)) {
      wargaTidakDiCsv.push(w);
      continue;
    }
    const status = teks(w.status_verifikasi);
    if (w.status_aktif !== false && status && status !== "Disetujui" && status !== "Menunggu") {
      antrekanMenunggu.push(w);
    }
    if (w.status_aktif === false && (anggotaByKk.get(w.id) || []).length) {
      const rumah = anggotaByNik.get(nik);
      if (rumah && rumah.warga_id !== w.id) {
        pindahTanggungan.push({ dariId: w.id, keId: rumah.warga_id, jumlah: anggotaByKk.get(w.id).length });
      }
    }
  }

  const idWargaHapus = new Set([...wargaNikKosong, ...wargaTidakDiCsv].map((w) => w.id));
  const anggotaNikKosong = anggotaDb.filter((a) => !nikSah(a.nik));
  const anggotaTidakDiCsv = anggotaDb.filter((a) => {
    const nik = nikSah(a.nik);
    return nik && !csv.unikSah.has(nik) && !idWargaHapus.has(a.warga_id);
  });

  const tertahanPemilu = [];
  const amanHapusWarga = [];
  for (const w of [...wargaNikKosong, ...wargaTidakDiCsv]) {
    const pemilu = await relatedCount(supabase, "partisipasi_pemilihan", "warga_id", w.id);
    const tanggunganCsv = (anggotaByKk.get(w.id) || []).filter((a) => {
      const nik = nikSah(a.nik);
      return nik && csv.unikSah.has(nik);
    });
    if (pemilu > 0) tertahanPemilu.push({ id: w.id, alasan: "terikat_pemilu" });
    else if (tanggunganCsv.length) tertahanPemilu.push({ id: w.id, alasan: "punya_tanggungan_ada_di_csv", jumlah: tanggunganCsv.length });
    else if ((await relatedCount(supabase, "peminjaman_inventaris", "warga_id", w.id)) > 0) {
      tertahanPemilu.push({ id: w.id, alasan: "terikat_peminjaman_inventaris" });
    } else amanHapusWarga.push(w);
  }

  const relasiSisa = [];
  for (const w of amanHapusWarga) {
    const isi = {};
    for (const tabel of [...TABEL_TURUNAN, "partisipasi_pemilihan", "suara_voting", "kas_rt"]) {
      isi[tabel] = await relatedCount(supabase, tabel, "warga_id", w.id);
    }
    relasiSisa.push(isi);
  }

  console.log(apply ? "MODE: APPLY" : "MODE: DRY-RUN (nol mutasi)");
  console.log("------------------------------------------------");
  console.log(`barisCsv: ${csv.barisData}`);
  console.log(`nikUnikSahCsv: ${csv.unikSah.size}`);
  console.log(`wargaDiDatabase: ${wargaDb.length}`);
  console.log(`anggotaDiDatabase: ${anggotaDb.length}`);
  console.log(`wargaNikKosongAtauTidakSah: ${wargaNikKosong.length}`);
  console.log(`wargaNikTidakAdaDiCsv: ${wargaTidakDiCsv.length}`);
  console.log(`anggotaNikKosongAtauTidakSah: ${anggotaNikKosong.length}`);
  console.log(`anggotaNikTidakAdaDiCsv: ${anggotaTidakDiCsv.length}`);
  console.log(`tanggunganDipindahKeKkAsli: ${pindahTanggungan.reduce((n, x) => n + x.jumlah, 0)}`);
  console.log(`akanDiantrekanVerifikasi: ${antrekanMenunggu.length}`);
  console.log(`wargaAmanDihapus: ${amanHapusWarga.length}`);
  for (const w of amanHapusWarga) {
    console.log(
      `  target: aktif=${w.status_aktif !== false} status=${teks(w.status_verifikasi) || "-"} rt_id=${w.rt_id ? "ada" : "kosong"}`
    );
  }
  if (relasiSisa.length) {
    for (const isi of relasiSisa) {
      const terisi = Object.entries(isi).filter(([, n]) => n > 0);
      console.log(`  relasi: ${terisi.length ? terisi.map(([t, n]) => `${t}=${n}`).join(", ") : "kosong"}`);
    }
  }
  console.log(`wargaTertahan: ${tertahanPemilu.length}`);
  for (const item of tertahanPemilu) {
    console.log(`  tertahan: ${item.alasan}${item.jumlah ? ` (${item.jumlah})` : ""}`);
  }
  console.log("------------------------------------------------");

  if (!apply) {
    console.log("Tidak ada perubahan database. Jalankan ulang dengan --apply --konfirmasi=SELARASKAN-WARGA bila angka masuk akal.");
    return;
  }

  let pindah = 0;
  for (const item of pindahTanggungan) {
    const { error } = await supabase
      .from("anggota_keluarga")
      .update({ warga_id: item.keId })
      .eq("warga_id", item.dariId);
    if (error) throw error;
    pindah += item.jumlah;
  }

  let hapusAnggota = 0;
  const idAnggotaHapus = [...anggotaNikKosong, ...anggotaTidakDiCsv].map((a) => a.id);
  if (idAnggotaHapus.length) {
    const { error } = await supabase.from("anggota_keluarga").delete().in("id", idAnggotaHapus);
    if (error) throw error;
    hapusAnggota = idAnggotaHapus.length;
    await supabase
      .from("kotak_sampah")
      .update({ aktor: "skrip-selaraskan-warga-csv", alasan: "selaras_csv_anggota" })
      .in("baris_id", idAnggotaHapus)
      .is("dipulihkan_pada", null);
  }

  let hapusWarga = 0;
  let dilewatiHapus = 0;
  for (const w of amanHapusWarga) {
    try {
      await bersihkanRelasi(supabase, w.id, w.rt_id);
      const { error } = await supabase.from("warga").delete().eq("id", w.id);
      if (error) throw error;
      await supabase
        .from("kotak_sampah")
        .update({ aktor: "skrip-selaraskan-warga-csv", alasan: "selaras_csv_warga" })
        .eq("bundel_id", w.id)
        .is("dipulihkan_pada", null);
      hapusWarga += 1;
    } catch (err) {
      dilewatiHapus += 1;
      const e = err && typeof err === "object" ? err : { message: String(err) };
      const pesan = [e.code, e.message].filter(Boolean).join(" | ") || String(err);
      console.error("Hapus warga dilewati:", pesan);
    }
  }

  let diantrekan = 0;
  if (antrekanMenunggu.length) {
    const { error } = await supabase
      .from("warga")
      .update({ status_verifikasi: "Menunggu" })
      .in("id", antrekanMenunggu.map((w) => w.id));
    if (error) throw error;
    diantrekan = antrekanMenunggu.length;
  }

  const rtIdAudit = amanHapusWarga[0]?.rt_id || wargaDb[0]?.rt_id || null;
  if (rtIdAudit) {
    const { error: errAudit } = await supabase.from("audit_log").insert({
      aktor: "skrip-selaraskan-warga-csv",
      aksi: "Selaraskan warga vs CSV lawas",
      tabel_target: "warga/anggota_keluarga",
      detail: `hapus_warga=${hapusWarga}; hapus_anggota=${hapusAnggota}; pindah_tanggungan=${pindah}; antrekan=${diantrekan}; dilewati=${dilewatiHapus}; tertahan=${tertahanPemilu.length}`,
      rt_id: rtIdAudit,
    });
    if (errAudit) console.error("Audit log gagal:", errAudit.message);
  }

  console.log(`pindah tanggungan: ${pindah}`);
  console.log(`hapus anggota: ${hapusAnggota}`);
  console.log(`hapus warga: ${hapusWarga}`);
  console.log(`diantrekan verifikasi: ${diantrekan}`);
  console.log(`dilewati hapus: ${dilewatiHapus}`);
}

main().catch((err) => gagal(err instanceof Error ? err.message : String(err)));
