#!/usr/bin/env node
/**
 * Menyatukan jiwa warisan menjadi rumah tangga sesuai Hub KK di CSV.
 *
 * Default: dry-run, nol mutasi. Tidak mencetak NIK atau No. KK ke stdout.
 * Rincian nama (tanpa NIK) ditulis ke data-privat/ yang gitignored.
 *
 *   node --env-file=.env.local scripts/rapikan-keluarga-csv.mjs
 *   node --env-file=.env.local scripts/rapikan-keluarga-csv.mjs --apply --konfirmasi=RAPIKAN-KELUARGA
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
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
const BERKAS_ALAMAT = path.join(FOLDER_PRIVAT, "hasil-dry-run-alamat.json");
const BERKAS_RINGKASAN = path.join(FOLDER_PRIVAT, "hasil-dry-run-ringkasan.json");
const BERKAS_KASUS = path.join(FOLDER_PRIVAT, "hasil-dry-run-kasus.json");
const BERKAS_RENCANA = path.join(FOLDER_PRIVAT, "hasil-dry-run-rencana.json");
const BERKAS_DILEWATI = path.join(FOLDER_PRIVAT, "hasil-dry-run-dilewati.json");

const HUBUNGAN_APP = new Set(["Istri", "Suami", "Anak", "Lainnya"]);
const TOKEN_KONFIRMASI = "RAPIKAN-KELUARGA";

function gagal(pesan, kode = 1) {
  console.error(pesan);
  process.exit(kode);
}

function teks(nilai) {
  return String(nilai ?? "").trim();
}

function hashPendek(nilai) {
  return createHash("sha256").update(teks(nilai)).digest("hex").slice(0, 12);
}

function muatEnvLokal() {
  for (const nama of [".env.local", ".env"]) {
    const lokasi = path.join(AKAR, nama);
    if (!fs.existsSync(lokasi)) continue;
    const isi = fs.readFileSync(lokasi, "utf8");
    for (const baris of isi.split(/\r?\n/)) {
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
        } else {
          dalamKutip = false;
        }
      } else {
        medan += huruf;
      }
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
  if (medan.length > 0 || barisIni.length > 0) {
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

function ambil(row, ...kunci) {
  for (const k of kunci) {
    if (row[k] != null && teks(row[k]) !== "") return teks(row[k]);
  }
  return "";
}

function nikBersih(nilai) {
  return teks(nilai).replace(/\D/g, "");
}

function normalisasiNama(nilai) {
  return teks(nilai)
    .toUpperCase()
    .replace(/\b(DRS|DR|IR|HJ|H|NY|TN|S\.H|S\.E|M\.KN)\b\.?/g, "")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalisasiTanggal(nilai) {
  const isi = teks(nilai);
  const iso = isi.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const sl = isi.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!sl) return "";
  const a = Number(sl[1]);
  const b = Number(sl[2]);
  const tahun = sl[3];
  // CSV lawas memakai MM/DD/YYYY. Jika bagian pertama > 12, itu DD/MM.
  let bulan;
  let hari;
  if (a > 12 && b <= 12) {
    hari = a;
    bulan = b;
  } else {
    bulan = a;
    hari = b;
  }
  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return "";
  return `${tahun}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
}

function normalisasiHubungan(mentah) {
  const n = teks(mentah).toLowerCase().replace(/[\s_-]+/g, " ");
  if (!n) return { peran: "kosong", hubungan: "", detail: null };
  if (n === "kk" || n === "kepala keluarga" || n === "kepala") {
    return { peran: "kk", hubungan: "KK", detail: null };
  }
  if (n === "istri") return { peran: "anggota", hubungan: "Istri", detail: null };
  if (n === "suami") return { peran: "anggota", hubungan: "Suami", detail: null };
  if (n === "anak") return { peran: "anggota", hubungan: "Anak", detail: null };
  const label = teks(mentah).slice(0, 80);
  return { peran: "anggota", hubungan: "Lainnya", detail: label || "Lain-lain" };
}

function normalisasiKelamin(nilai) {
  const n = teks(nilai).toLowerCase();
  if (n.startsWith("l")) return "Laki-laki";
  if (n.startsWith("p")) return "Perempuan";
  return teks(nilai);
}

function normalisasiAgama(nilai) {
  const n = teks(nilai).toLowerCase();
  if (n.startsWith("islam")) return "Islam";
  if (
    n.startsWith("kristen") ||
    n.startsWith("protestan") ||
    n.startsWith("kathol") ||
    n.startsWith("katolik")
  ) {
    return "Kristen/Katolik";
  }
  if (n.startsWith("hindu")) return "Hindu";
  if (n.startsWith("bud")) return "Budha";
  if (n.startsWith("kong")) return "Konghucu";
  return "";
}

const SUFFIKS_NAMA_JALAN = /^(I|II|III|IV|V|VI|VII|VIII|IX|X|UJUNG|RAYA|TENGAH)$/i;
const UNIT_NOMOR_RUMAH =
  /^[A-Za-z]?\d+[A-Za-z]?(?:\/\d+[A-Za-z]?)?$|^[A-Za-z]\/?\d+[A-Za-z]?$/;

function normalisasiNoRmh(nilai) {
  const n = teks(nilai);
  if (!n || n === "#N/A" || n === "-" || n === "0") return "";
  if (/^0+\d+[A-Za-z]*$/.test(n)) return n.replace(/^0+/, "") || "0";
  return n.toUpperCase();
}

function potongNomorDiUjungAlamat(alamat) {
  let a = teks(alamat).replace(/\s+/g, " ");
  if (!a || a === "#N/A" || a === "0" || a === "-") return "";
  a = a.replace(/\s+(NO\.?|NOM\.?|NOMOR)\s*[:;]?\s*\S+$/i, "");
  const bagian = a.split(" ");
  while (bagian.length > 1) {
    const terakhir = bagian[bagian.length - 1].replace(/[.,;]+$/, "");
    if (SUFFIKS_NAMA_JALAN.test(terakhir)) break;
    if (UNIT_NOMOR_RUMAH.test(terakhir)) {
      bagian.pop();
      continue;
    }
    break;
  }
  return teks(bagian.join(" ")).replace(/[.,;]+$/, "");
}

function judulTokenJalan(token) {
  const t = teks(token).replace(/,/g, "");
  const huruf = t.replace(/\./g, "").toUpperCase();
  const peta = {
    JL: "Jl.",
    JLN: "Jl.",
    JALAN: "Jl.",
    KJL: "Jl.",
    GG: "Gg.",
    GANG: "Gg.",
    NO: "No.",
    NOM: "No.",
    NOMOR: "No.",
    KEL: "Kel.",
    KP: "Kp.",
    KAMPUNG: "Kp.",
    KOMP: "Komp.",
    BLOK: "Blok",
    SDN: "SDN",
    RT: "RT",
    RW: "RW",
    H: "H.",
  };
  if (peta[huruf]) return peta[huruf];
  if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X)$/i.test(huruf)) return huruf;
  if (/^[0-9]/.test(t)) return t;
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function judulJalan(alamat) {
  return potongNomorDiUjungAlamat(alamat).split(/\s+/).filter(Boolean).map(judulTokenJalan).join(" ");
}

function gabungAlamatKtp(alamatKtp, noRmh) {
  const no = normalisasiNoRmh(noRmh);
  const jalan = judulJalan(alamatKtp);
  if (!jalan && !no) return "";
  if (!jalan) return `No. ${no}`.slice(0, 255);
  if (!no) return jalan.slice(0, 255);
  return `${jalan} No. ${no}`.slice(0, 255);
}

function ujiAlamatWajib() {
  const uji = [
    ["JL. H. BAING 38/89", "089", "Jl. H. Baing No. 89"],
    ["JL. LAPANGAN NO 45", "091", "Jl. Lapangan No. 91"],
    ["JL. BAING NO 99", "100", "Jl. Baing No. 100"],
    ["JL. H. BAING 95H", "95A", "Jl. H. Baing No. 95A"],
    ["PELITA TOWN HOUSE B11", "B11", "Pelita Town House No. B11"],
    ["JL. SEDAP MALAM I", "111", "Jl. Sedap Malam I No. 111"],
    ["JL. PELITA 46B", "046", "Jl. Pelita No. 46"],
  ];
  for (const [alamat, no, harap] of uji) {
    const dapat = gabungAlamatKtp(alamat, no);
    if (dapat !== harap) {
      gagal(`Uji alamat gagal: ${alamat} + ${no} => "${dapat}" (harus "${harap}")`);
    }
  }
}

function normalisasiStatusWarga(nilai) {
  const n = teks(nilai)
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ");
  if (!n) return "";
  if (n.includes("tdk") || n.includes("tidak")) return "Penduduk Tidak Tetap";
  if (n.includes("tetap")) return "Penduduk Tetap";
  return "";
}

function ujiStatusWajib() {
  const uji = [
    ["1. Penduduk Tetap", "Penduduk Tetap"],
    ["2. Penduduk Tdk Tetap", "Penduduk Tidak Tetap"],
    ["Penduduk Tidak Tetap", "Penduduk Tidak Tetap"],
    ["PENDUDUK TETAP", "Penduduk Tetap"],
  ];
  for (const [mentah, harap] of uji) {
    const dapat = normalisasiStatusWarga(mentah);
    if (dapat !== harap) {
      gagal(`Uji status gagal: ${mentah} => "${dapat}" (harus "${harap}")`);
    }
  }
}

function normalisasiPendidikan(nilai) {
  return teks(nilai).replace(/\s+/g, " ").slice(0, 80);
}

function noKkBersih(nilai) {
  const digit = teks(nilai).replace(/\D/g, "");
  return digit.length === 16 ? digit : "";
}

function alasanCacat(baris) {
  const alasan = [];
  const nik = nikBersih(baris.nik);
  if (nik.length !== 16) alasan.push("nik_tidak_sah");
  return alasan;
}

function samaTeks(a, b) {
  return teks(a).toLowerCase() === teks(b).toLowerCase();
}

function isiJikaBerubah(payload, kolom, lama, baru) {
  if (baru == null || teks(baru) === "") return false;
  const a = typeof lama === "string" ? teks(lama) : lama;
  const b = typeof baru === "string" ? teks(baru) : baru;
  if (typeof a === "string" && typeof b === "string" && samaTeks(a, b)) return false;
  if (a === b) return false;
  payload[kolom] = baru;
  return true;
}

function parseArgumen(argv) {
  const apply = argv.includes("--apply");
  const konfirmasi = argv.find((a) => a.startsWith("--konfirmasi="))?.slice("--konfirmasi=".length) || "";
  const csvArg = argv.find((a) => a.startsWith("--csv="))?.slice("--csv=".length) || "";
  return { apply, konfirmasi, csvArg };
}

function lokasiCsv(csvArg) {
  if (csvArg) return path.resolve(csvArg);
  if (process.env.DATA_LAWAS_CSV) return path.resolve(process.env.DATA_LAWAS_CSV);
  for (const kandidat of BERKAS_CSV_BAWAAN) {
    if (fs.existsSync(kandidat)) return kandidat;
  }
  return BERKAS_CSV_BAWAAN[0];
}

function bacaCsv(lokasi) {
  if (!fs.existsSync(lokasi)) {
    gagal(
      [
        `CSV belum ada: ${path.relative(AKAR, lokasi)}`,
        "Letakkan file lengkap (ada kolom No KK dan NIK) di:",
        "  data-privat/Data_lawas_07_lengkap.csv",
        "Jangan tempel NIK/No. KK di chat.",
      ].join("\n"),
      2
    );
  }
  const mentah = fs.readFileSync(lokasi, "utf8");
  const tabel = parseCsv(mentah);
  if (tabel.length < 2) gagal("CSV kosong atau tidak punya baris data.");
  const header = tabel[0].map(kunciHeader);
  const wajib = ["no_kk", "nik", "nama", "hub_kk"];
  const alias = {
    no_kk: ["no_kk", "nokk", "nomor_kk"],
    nik: ["nik"],
    nama: ["nama", "nama_lengkap"],
    hub_kk: ["hub_kk", "hubungan_kk", "hubkk"],
    alamat_ktp: ["alamat_ktp", "alamat"],
    no_rmh: ["no_rmh", "no_rumah"],
    tempat_lahir: ["tempat_lahir"],
    tgl_lahir: ["tgl_lahir", "tanggal_lahir"],
    jenis_kelamin: ["jenis_kelamin"],
    agama: ["agama"],
    pekerjaan: ["pekerjaan"],
    pendidikan: ["pendidikan"],
    status_warga: ["status_warga"],
  };
  const indeks = {};
  for (const [tujuan, daftar] of Object.entries(alias)) {
    indeks[tujuan] = header.findIndex((h) => daftar.includes(h));
  }
  const hilang = wajib.filter((k) => indeks[k] < 0);
  if (hilang.length) gagal(`Header CSV tidak lengkap: ${hilang.join(", ")}`);

  return tabel.slice(1).map((sel, i) => {
    const row = {};
    for (const [k, idx] of Object.entries(indeks)) {
      row[k] = idx >= 0 ? sel[idx] ?? "" : "";
    }
    return { nomorBaris: i + 2, ...row };
  });
}

async function ambilSemua(supabase, tabel, kolom) {
  const ukuran = 1000;
  const hasil = [];
  for (let dari = 0; ; dari += ukuran) {
    const { data, error } = await supabase
      .from(tabel)
      .select(kolom)
      .range(dari, dari + ukuran - 1);
    if (error) throw new Error(`Gagal membaca ${tabel}: ${error.message}`);
    const batch = data || [];
    hasil.push(...batch);
    if (batch.length < ukuran) break;
  }
  return hasil;
}

function susunRencana(barisCsv, wargaDb, anggotaDb) {
  const wargaByNik = new Map();
  for (const w of wargaDb) {
    const nik = nikBersih(w.nik);
    if (nik.length === 16) wargaByNik.set(nik, w);
  }
  const anggotaByNik = new Map();
  for (const a of anggotaDb) {
    const nik = nikBersih(a.nik);
    if (nik.length === 16) anggotaByNik.set(nik, a);
  }

  const kasus = [];
  const dilewati = [];
  const catat = (jenis, payload) => {
    kasus.push({ jenis, ...payload });
  };

  const valid = [];
  for (const baris of barisCsv) {
    const nik = nikBersih(baris.nik);
    const noKk = noKkBersih(baris.no_kk);
    const nama = teks(baris.nama).slice(0, 100);
    const hub = normalisasiHubungan(baris.hub_kk);
    const meta = {
      baris: baris.nomorBaris,
      nama,
      hubCsv: teks(baris.hub_kk),
      alamat: teks(baris.alamat_ktp),
      noRmh: teks(baris.no_rmh),
    };
    const cacat = alasanCacat(baris);
    if (cacat.length) {
      dilewati.push({ ...meta, alasan: cacat });
      continue;
    }

    valid.push({
      ...baris,
      nik,
      noKk,
      hub,
      tanggalLahir: normalisasiTanggal(baris.tgl_lahir),
      kelamin: normalisasiKelamin(baris.jenis_kelamin),
      agama: normalisasiAgama(baris.agama),
      tempatLahir: teks(baris.tempat_lahir).slice(0, 100),
      pekerjaan: teks(baris.pekerjaan).slice(0, 100),
      pendidikan: normalisasiPendidikan(baris.pendidikan),
      hubunganKk: hub.peran === "kk" ? "KK" : hub.hubungan,
    });
  }

  const nikCsv = new Map();
  for (const baris of valid) {
    if (!nikCsv.has(baris.nik)) nikCsv.set(baris.nik, []);
    nikCsv.get(baris.nik).push(baris);
  }
  const nikGanda = new Set();
  for (const [nik, daftar] of nikCsv) {
    if (daftar.length > 1) {
      nikGanda.add(nik);
      catat("csv_nik_ganda", {
        nama: daftar.map((d) => d.nama).join(" | "),
        baris: daftar.map((d) => d.nomorBaris),
        jumlah: daftar.length,
        nikHash: hashPendek(nik),
      });
    }
  }

  const validUnik = valid.filter((baris) => !nikGanda.has(baris.nik));

  const kelompok = new Map();
  for (const baris of validUnik) {
    if (!baris.noKk) continue;
    if (!kelompok.has(baris.noKk)) kelompok.set(baris.noKk, []);
    kelompok.get(baris.noKk).push(baris);
  }

  const konversi = [];
  const kepalaDipakai = new Set();
  let kkSiap = 0;

  for (const anggotaKk of kelompok.values()) {
    const daftarKk = anggotaKk.filter((a) => a.hub.peran === "kk");
    if (daftarKk.length !== 1) continue;
    const kepalaDbAwal = wargaByNik.get(daftarKk[0].nik);
    if (kepalaDbAwal && kepalaDbAwal.status_aktif !== false) {
      kepalaDipakai.add(kepalaDbAwal.id);
    }
  }

  for (const anggotaKk of kelompok.values()) {
    const daftarKk = anggotaKk.filter((a) => a.hub.peran === "kk");
    const bukanKk = anggotaKk.filter((a) => a.hub.peran !== "kk");
    const contoh = anggotaKk[0];
    const labelKk = {
      namaKk: daftarKk.map((d) => d.nama).join(" | ") || "(tidak ada KK)",
      alamat: teks(contoh.alamat_ktp),
      noRmh: teks(contoh.no_rmh),
      jiwa: anggotaKk.length,
      noKkHash: hashPendek(contoh.noKk),
    };

    if (daftarKk.length === 0) {
      catat("kk_tidak_ada_di_kelompok", {
        ...labelKk,
        anggota: bukanKk.map((a) => `${a.nama} (${a.hub.hubungan})`),
      });
      continue;
    }
    if (daftarKk.length > 1) {
      catat("kk_ganda_satu_no_kk", {
        ...labelKk,
        namaKk: daftarKk.map((d) => d.nama),
      });
      continue;
    }

    const kepalaCsv = daftarKk[0];
    const kepalaDb = wargaByNik.get(kepalaCsv.nik);
    if (!kepalaDb) {
      catat("kk_tidak_ada_di_database", {
        ...labelKk,
        nama: kepalaCsv.nama,
        baris: kepalaCsv.nomorBaris,
      });
      continue;
    }
    if (kepalaDb.status_aktif === false) {
      catat("kk_sudah_nonaktif", {
        ...labelKk,
        nama: kepalaCsv.nama,
        baris: kepalaCsv.nomorBaris,
      });
      continue;
    }

    kkSiap += 1;

    if (
      normalisasiNama(kepalaCsv.nama) &&
      normalisasiNama(kepalaDb.nama_lengkap) &&
      normalisasiNama(kepalaCsv.nama) !== normalisasiNama(kepalaDb.nama_lengkap)
    ) {
      catat("nama_kk_beda_dengan_database", {
        namaCsv: kepalaCsv.nama,
        namaDb: kepalaDb.nama_lengkap,
        baris: kepalaCsv.nomorBaris,
      });
    }

    for (const jiwa of bukanKk) {
      if (!HUBUNGAN_APP.has(jiwa.hub.hubungan)) {
        catat("hubungan_tidak_terpetakan", {
          nama: jiwa.nama,
          hubCsv: teks(jiwa.hub_kk),
          baris: jiwa.nomorBaris,
        });
        continue;
      }

      const sudahAnggota = anggotaByNik.get(jiwa.nik);
      if (sudahAnggota) {
        if (String(sudahAnggota.warga_id) === String(kepalaDb.id)) {
          catat("sudah_anggota_kk_ini", { nama: jiwa.nama, baris: jiwa.nomorBaris });
        } else {
          catat("nik_sudah_anggota_kk_lain", { nama: jiwa.nama, baris: jiwa.nomorBaris });
        }
        continue;
      }

      if (jiwa.nik === kepalaCsv.nik) {
        catat("anggota_nik_sama_dengan_kk", { nama: jiwa.nama, baris: jiwa.nomorBaris });
        continue;
      }

      const jiwaDb = wargaByNik.get(jiwa.nik);
      if (jiwaDb && String(jiwaDb.rt_id) !== String(kepalaDb.rt_id)) {
        catat("anggota_beda_rt", { nama: jiwa.nama, baris: jiwa.nomorBaris });
        continue;
      }

      if (jiwaDb && kepalaDipakai.has(jiwaDb.id) && jiwaDb.id !== kepalaDb.id) {
        catat("jiwa_adalah_kk_keluarga_lain", { nama: jiwa.nama, baris: jiwa.nomorBaris });
        continue;
      }

      if (
        jiwaDb &&
        normalisasiNama(jiwa.nama) &&
        normalisasiNama(jiwaDb.nama_lengkap) &&
        normalisasiNama(jiwa.nama) !== normalisasiNama(jiwaDb.nama_lengkap)
      ) {
        catat("nama_anggota_beda_dengan_database", {
          namaCsv: jiwa.nama,
          namaDb: jiwaDb.nama_lengkap,
          baris: jiwa.nomorBaris,
        });
      }

      konversi.push({
        kepalaId: kepalaDb.id,
        kepalaRtId: kepalaDb.rt_id,
        kepalaNama: kepalaDb.nama_lengkap,
        jiwaWargaId: jiwaDb ? jiwaDb.id : null,
        jiwaSudahNonaktif: jiwaDb ? jiwaDb.status_aktif === false : false,
        nik: jiwa.nik,
        nama: jiwa.nama,
        hubungan: jiwa.hub.hubungan,
        hubunganDetail: jiwa.hub.detail,
        tanggalLahir: jiwa.tanggalLahir || jiwaDb?.tanggal_lahir || null,
        tempatLahir: jiwa.tempatLahir || jiwaDb?.tempat_lahir || "-",
        jenisKelamin: jiwa.kelamin || jiwaDb?.jenis_kelamin || "",
        agama: jiwa.agama || jiwaDb?.agama || "",
        pekerjaan: jiwa.pekerjaan || jiwaDb?.pekerjaan || "-",
        pendidikan: jiwa.pendidikan || jiwaDb?.pendidikan || null,
        noKk: jiwa.noKk,
        baris: jiwa.nomorBaris,
        sumber: jiwaDb ? "warga_ke_anggota" : "csv_tanpa_akun",
      });
    }
  }

  const wargaTidakDiCsv = wargaDb.filter((w) => {
    const nik = nikBersih(w.nik);
    return nik.length === 16 && !nikCsv.has(nik) && w.status_aktif !== false;
  });

  const profilByWargaId = new Map();
  for (const baris of validUnik) {
    const warga = wargaByNik.get(baris.nik);
    if (!warga) {
      catat("csv_nik_tidak_ada_di_database", {
        nama: baris.nama,
        baris: baris.nomorBaris,
      });
      continue;
    }
    const alamatBaru = gabungAlamatKtp(baris.alamat_ktp, baris.no_rmh);
    const statusBaru = normalisasiStatusWarga(baris.status_warga);
    if (!alamatBaru) {
      catat("alamat_tidak_bisa_dirakit", {
        nama: baris.nama,
        baris: baris.nomorBaris,
        alamatKtp: teks(baris.alamat_ktp),
        noRmh: teks(baris.no_rmh),
      });
    }
    const item = {
      wargaId: warga.id,
      rtId: warga.rt_id,
      nama: warga.nama_lengkap,
      alamatLama: teks(warga.detail_alamat),
      alamatBaru,
      statusLama: teks(warga.status_tinggal),
      statusBaru,
      namaLama: teks(warga.nama_lengkap),
      namaBaru: teks(baris.nama).slice(0, 100),
      tempatLahirLama: teks(warga.tempat_lahir),
      tempatLahirBaru: baris.tempatLahir,
      tanggalLahirLama: teks(warga.tanggal_lahir).slice(0, 10),
      tanggalLahirBaru: baris.tanggalLahir,
      kelaminLama: teks(warga.jenis_kelamin),
      kelaminBaru: baris.kelamin,
      agamaLama: teks(warga.agama),
      agamaBaru: baris.agama,
      pekerjaanLama: teks(warga.pekerjaan),
      pekerjaanBaru: baris.pekerjaan === "-" ? "" : baris.pekerjaan,
      pendidikanLama: teks(warga.pendidikan),
      pendidikanBaru: baris.pendidikan,
      noKkLama: teks(warga.no_kk),
      noKkBaru: baris.noKk,
      hubunganKkLama: teks(warga.hubungan_kk),
      hubunganKkBaru: baris.hubunganKk,
    };
    profilByWargaId.set(warga.id, item);
  }

  const semuaProfil = [...profilByWargaId.values()];
  const adaPerubahanProfil = (a) => {
    const payload = {};
    isiJikaBerubah(payload, "detail_alamat", a.alamatLama, a.alamatBaru);
    isiJikaBerubah(payload, "status_tinggal", a.statusLama, a.statusBaru);
    isiJikaBerubah(payload, "nama_lengkap", a.namaLama, a.namaBaru);
    isiJikaBerubah(payload, "tempat_lahir", a.tempatLahirLama, a.tempatLahirBaru);
    isiJikaBerubah(payload, "tanggal_lahir", a.tanggalLahirLama, a.tanggalLahirBaru);
    isiJikaBerubah(payload, "jenis_kelamin", a.kelaminLama, a.kelaminBaru);
    isiJikaBerubah(payload, "agama", a.agamaLama, a.agamaBaru);
    isiJikaBerubah(payload, "pekerjaan", a.pekerjaanLama, a.pekerjaanBaru);
    isiJikaBerubah(payload, "pendidikan", a.pendidikanLama, a.pendidikanBaru);
    isiJikaBerubah(payload, "no_kk", a.noKkLama, a.noKkBaru);
    isiJikaBerubah(payload, "hubungan_kk", a.hubunganKkLama, a.hubunganKkBaru);
    return payload;
  };
  const pembaruanAlamat = semuaProfil.filter((a) => a.alamatBaru && !samaTeks(a.alamatLama, a.alamatBaru));
  const pembaruanStatus = semuaProfil.filter((a) => a.statusBaru && !samaTeks(a.statusLama, a.statusBaru));
  const pembaruanProfil = semuaProfil
    .map((a) => ({ ...a, payload: adaPerubahanProfil(a) }))
    .filter((a) => Object.keys(a.payload).length > 0);

  return {
    kasus,
    dilewati,
    konversi,
    pembaruanAlamat,
    pembaruanStatus,
    pembaruanProfil,
    alamatSudahSama: semuaProfil.filter((a) => a.alamatBaru && samaTeks(a.alamatLama, a.alamatBaru)).length,
    statusSudahSama: semuaProfil.filter((a) => a.statusBaru && samaTeks(a.statusLama, a.statusBaru)).length,
    statusPendudukTetap: semuaProfil.filter((a) => a.statusBaru === "Penduduk Tetap").length,
    statusPendudukTidakTetap: semuaProfil.filter((a) => a.statusBaru === "Penduduk Tidak Tetap").length,
    kkSiap,
    jumlahKelompok: kelompok.size,
    wargaTidakDiCsv: wargaTidakDiCsv.length,
  };
}

function ringkasanDari(barisCsv, rencana) {
  const hitung = (jenis) => rencana.kasus.filter((k) => k.jenis === jenis).length;
  const konversiWarga = rencana.konversi.filter((k) => k.sumber === "warga_ke_anggota").length;
  const konversiCsvSaja = rencana.konversi.filter((k) => k.sumber === "csv_tanpa_akun").length;
  return {
    barisCsv: barisCsv.length,
    barisDilewati: rencana.dilewati.length,
    barisSiapDiproses: barisCsv.length - rencana.dilewati.length,
    kelompokNoKkSah: rencana.jumlahKelompok,
    kkSiapDijadikanInduk: rencana.kkSiap,
    akanMasukAnggotaKeluarga: rencana.konversi.length,
    dariAkunWargaYangDinonaktifkan: konversiWarga,
    dariCsvTanpaAkunPortal: konversiCsvSaja,
    csvNikGanda: hitung("csv_nik_ganda"),
    kelompokTanpaKk: hitung("kk_tidak_ada_di_kelompok"),
    kelompokKkGanda: hitung("kk_ganda_satu_no_kk"),
    kkTidakAdaDiDatabase: hitung("kk_tidak_ada_di_database"),
    csvNikTidakAdaDiDatabase: hitung("csv_nik_tidak_ada_di_database"),
    nikSudahAnggotaKkLain: hitung("nik_sudah_anggota_kk_lain"),
    jiwaAdalahKkLain: hitung("jiwa_adalah_kk_keluarga_lain"),
    wargaAktifTidakAdaDiCsv: rencana.wargaTidakDiCsv,
    profilAkanDiubah: rencana.pembaruanProfil.length,
    alamatAkanDiubah: rencana.pembaruanAlamat.length,
    alamatSudahSama: rencana.alamatSudahSama,
    alamatTidakBisaDirakit: hitung("alamat_tidak_bisa_dirakit"),
    statusAkanDiubah: rencana.pembaruanStatus.length,
    statusSudahSama: rencana.statusSudahSama,
    statusPendudukTetap: rencana.statusPendudukTetap,
    statusPendudukTidakTetap: rencana.statusPendudukTidakTetap,
    jumlahKasus: rencana.kasus.length,
  };
}

function tulisLaporan(ringkasan, rencana) {
  fs.mkdirSync(FOLDER_PRIVAT, { recursive: true });
  fs.writeFileSync(BERKAS_RINGKASAN, `${JSON.stringify(ringkasan, null, 2)}\n`);
  const kasusTanpaRahasia = rencana.kasus.map((k) => {
    const { nik, noKk, ...sisa } = k;
    void nik;
    void noKk;
    return sisa;
  });
  fs.writeFileSync(BERKAS_KASUS, `${JSON.stringify(kasusTanpaRahasia, null, 2)}\n`);
  fs.writeFileSync(
    BERKAS_RENCANA,
    `${JSON.stringify(
      {
        dibuatPada: new Date().toISOString(),
        konversi: rencana.konversi,
        pembaruanProfil: rencana.pembaruanProfil,
      },
      null,
      2
    )}\n`
  );
  fs.writeFileSync(
    BERKAS_DILEWATI,
    `${JSON.stringify(
      rencana.dilewati.map(({ nama, baris, alasan, hubCsv }) => ({
        nama,
        baris,
        alasan,
        hubCsv,
      })),
      null,
      2
    )}\n`
  );
  fs.writeFileSync(
    BERKAS_ALAMAT,
    `${JSON.stringify(
      rencana.pembaruanProfil.map((a) => ({
        nama: a.nama,
        alamatLama: a.alamatLama,
        alamatBaru: a.alamatBaru || a.alamatLama,
        statusLama: a.statusLama,
        statusBaru: a.statusBaru || a.statusLama,
        pendidikanBaru: a.pendidikanBaru || a.pendidikanLama,
        hubunganKkBaru: a.hubunganKkBaru || a.hubunganKkLama,
      })),
      null,
      2
    )}\n`
  );
}

function cetakRingkasan(ringkasan, apply) {
  console.log(apply ? "MODE: APPLY" : "MODE: DRY-RUN (nol mutasi)");
  console.log("------------------------------------------------");
  for (const [k, v] of Object.entries(ringkasan)) {
    console.log(`${k}: ${v}`);
  }
  console.log("------------------------------------------------");
  console.log(`Rincian nama (tanpa NIK): ${path.relative(AKAR, BERKAS_KASUS)}`);
  console.log(`Baris dilewati: ${path.relative(AKAR, BERKAS_DILEWATI)}`);
  console.log(`Perubahan profil: ${path.relative(AKAR, BERKAS_ALAMAT)}`);
  console.log(`Ringkasan: ${path.relative(AKAR, BERKAS_RINGKASAN)}`);
}

async function terapkan(supabase, konversi, pembaruanProfil) {
  let insertAnggota = 0;
  let nonaktifWarga = 0;
  let profilDiubah = 0;
  let gagalItem = 0;
  const gagalDetail = [];

  for (const item of pembaruanProfil) {
    try {
      const payload = item.payload;
      if (!payload || Object.keys(payload).length === 0) continue;
      const { data, error } = await supabase
        .from("warga")
        .update(payload)
        .eq("id", item.wargaId)
        .eq("rt_id", item.rtId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (data) profilDiubah += 1;
    } catch (error) {
      gagalItem += 1;
      gagalDetail.push({ nama: item.nama, alasan: error.message || "gagal_profil" });
    }
  }

  for (const item of konversi) {
    try {
      const { data: sudahBaris, error: errCek } = await supabase
        .from("anggota_keluarga")
        .select("id, warga_id")
        .eq("nik", item.nik)
        .limit(2);
      if (errCek) throw errCek;
      const sudah = (sudahBaris || [])[0];

      if (sudah && String(sudah.warga_id) !== String(item.kepalaId)) {
        gagalItem += 1;
        gagalDetail.push({ nama: item.nama, alasan: "nik_sudah_anggota_kk_lain" });
        continue;
      }

      if (!sudah) {
        const { error: errInsert } = await supabase.from("anggota_keluarga").insert({
          warga_id: item.kepalaId,
          rt_id: item.kepalaRtId,
          nama_lengkap: item.nama.slice(0, 100),
          nik: item.nik,
          hubungan_keluarga: item.hubungan,
          hubungan_detail: item.hubungan === "Lainnya" ? item.hubunganDetail : null,
          tanggal_lahir: item.tanggalLahir || null,
          tempat_lahir: (item.tempatLahir || "-").slice(0, 100),
          jenis_kelamin: item.jenisKelamin || null,
          agama: item.agama || null,
          pekerjaan: (item.pekerjaan || "-").slice(0, 100),
          no_kk: item.noKk || null,
          pendidikan: item.pendidikan || null,
        });
        if (errInsert) throw errInsert;
        insertAnggota += 1;
      }

      if (item.jiwaWargaId && !item.jiwaSudahNonaktif) {
        const { data: wargaNonaktif, error: errNonaktif } = await supabase
          .from("warga")
          .update({ status_aktif: false })
          .eq("id", item.jiwaWargaId)
          .eq("rt_id", item.kepalaRtId)
          .eq("status_aktif", true)
          .select("id")
          .maybeSingle();
        if (errNonaktif) throw errNonaktif;
        if (wargaNonaktif) nonaktifWarga += 1;
      }
    } catch (error) {
      gagalItem += 1;
      gagalDetail.push({ nama: item.nama, alasan: error.message || "gagal" });
    }
  }

  return { insertAnggota, nonaktifWarga, profilDiubah, gagalItem, gagalDetail };
}

async function main() {
  ujiAlamatWajib();
  ujiStatusWajib();
  muatEnvLokal();
  const opsi = parseArgumen(process.argv.slice(2));
  const lokasi = lokasiCsv(opsi.csvArg);
  const barisCsv = bacaCsv(lokasi);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunci) {
    gagal("NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum terbaca dari .env.local.");
  }

  const supabase = createClient(url, kunci, { auth: { persistSession: false } });
  const [wargaDb, anggotaDb] = await Promise.all([
    ambilSemua(
      supabase,
      "warga",
      "id, nik, nama_lengkap, tanggal_lahir, tempat_lahir, jenis_kelamin, agama, pekerjaan, rt_id, status_aktif, detail_alamat, status_tinggal, no_kk, pendidikan, hubungan_kk"
    ),
    ambilSemua(supabase, "anggota_keluarga", "id, nik, warga_id, rt_id, nama_lengkap"),
  ]);

  const rencana = susunRencana(barisCsv, wargaDb, anggotaDb);
  const ringkasan = ringkasanDari(barisCsv, rencana);
  tulisLaporan(ringkasan, rencana);
  cetakRingkasan(ringkasan, opsi.apply);

  if (!opsi.apply) {
    console.log("Tidak ada perubahan database. Cek kasus di file rincian, lalu jalankan ulang dengan --apply bila angka masuk akal.");
    return;
  }

  if (opsi.konfirmasi !== TOKEN_KONFIRMASI) {
    gagal(`APPLY ditolak. Tambahkan --konfirmasi=${TOKEN_KONFIRMASI}`);
  }

  const hasil = await terapkan(supabase, rencana.konversi, rencana.pembaruanProfil);
  console.log("------------------------------------------------");
  console.log(`insert anggota_keluarga: ${hasil.insertAnggota}`);
  console.log(`nonaktifkan akun jiwa: ${hasil.nonaktifWarga}`);
  console.log(`ubah profil warga: ${hasil.profilDiubah}`);
  console.log(`gagal: ${hasil.gagalItem}`);
  if (hasil.gagalDetail.length) {
    fs.writeFileSync(
      path.join(FOLDER_PRIVAT, "hasil-apply-gagal.json"),
      `${JSON.stringify(hasil.gagalDetail, null, 2)}\n`
    );
    console.log(`Rincian gagal (nama saja): data-privat/hasil-apply-gagal.json`);
  }
}

main().catch((error) => {
  console.error("Skrip berhenti:", error.message || error);
  process.exit(1);
});
