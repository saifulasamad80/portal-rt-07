/**
 * Pemetaan teks hasil OCR KTP/KK ke isian formulir.
 *
 * Modul ini sengaja murni: tidak mengimpor Tesseract, tidak menyentuh
 * Supabase, dan tidak menulis tabel. Hasil OCR selalu salah dalam kadar
 * tertentu. NIK 16 digit yang meleset satu angka menabrak identitas orang
 * lain atau mengunci pemilik sah. Satu-satunya jalur ke tabel `warga` /
 * `anggota_keluarga` tetap Server Action Lapor Diri / Carik setelah manusia
 * meninjau isian.
 */

export type JiwaOcr = {
  nik: string;
  nama_lengkap: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  jenis_kelamin: "Laki-laki" | "Perempuan" | "";
  agama: string;
  pekerjaan: string;
  pendidikan: string;
  hubungan_keluarga: "Istri" | "Suami" | "Anak" | "Lainnya" | "";
  hubungan_detail: string;
  hubungan_kk: "KK" | "Istri" | "Suami" | "Anak" | "Lainnya" | "";
};

export type HasilOcrIdentitas = {
  jenis: "ktp" | "kk" | "tidak_dikenali";
  no_kk: string;
  alamat: string;
  kepala: JiwaOcr | null;
  anggota: JiwaOcr[];
  peringatan: string[];
};

export type IsianKepalaOcr = {
  nik: string;
  no_kk: string;
  nama_lengkap: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  jenis_kelamin: string;
  agama: string;
  pekerjaan: string;
  pendidikan: string;
  detail_alamat: string;
  hubungan_kk: string;
};

export type IsianAnggotaOcr = {
  nik: string;
  nama_lengkap: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  jenis_kelamin: string;
  agama: string;
  pekerjaan: string;
  pendidikan: string;
  hubungan_keluarga: string;
  hubungan_detail: string;
};

const NIK_SPAM = new Set(["1234567890123456"]);
const PETA_HURUF_DIGIT: Record<string, string> = {
  O: "0",
  o: "0",
  I: "1",
  l: "1",
  "|": "1",
  S: "5",
  B: "8",
  Z: "2",
  G: "6",
};

function jiwaKosong(): JiwaOcr {
  return {
    nik: "",
    nama_lengkap: "",
    tempat_lahir: "",
    tanggal_lahir: "",
    jenis_kelamin: "",
    agama: "",
    pekerjaan: "",
    pendidikan: "",
    hubungan_keluarga: "",
    hubungan_detail: "",
    hubungan_kk: "",
  };
}

function rapikanSpasi(teks: string): string {
  return teks.replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function judulNama(teks: string): string {
  const bersih = teks
    .replace(/[^A-Za-zÀ-ÿ'’.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!bersih) return "";
  return bersih
    .toLowerCase()
    .replace(/(^|[\s.'’-])(\p{L})/gu, (_, batas: string, huruf: string) => batas + huruf.toUpperCase());
}

function tokenNikKandidat(token: string): string {
  if (token.length < 16 || token.length > 18) return "";
  let digit = "";
  for (const huruf of token) {
    if (/\d/.test(huruf)) digit += huruf;
    else if (PETA_HURUF_DIGIT[huruf]) digit += PETA_HURUF_DIGIT[huruf];
    else return "";
  }
  return digit.length === 16 ? digit : "";
}

export function nikDigitSah(nik: string): boolean {
  if (!/^\d{16}$/.test(nik)) return false;
  if (/^(\d)\1{15}$/.test(nik)) return false;
  if (NIK_SPAM.has(nik)) return false;
  return true;
}

export function uraikanTanggalDariNik(nik: string): {
  tanggal_lahir: string;
  jenis_kelamin: "Laki-laki" | "Perempuan";
} | null {
  if (!nikDigitSah(nik)) return null;
  const hariMentah = Number(nik.slice(6, 8));
  const bulan = Number(nik.slice(8, 10));
  const tahunDua = Number(nik.slice(10, 12));
  const perempuan = hariMentah > 40;
  const hari = perempuan ? hariMentah - 40 : hariMentah;
  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return null;

  const tahunIni = new Date().getUTCFullYear();
  let tahun = Math.floor(tahunIni / 100) * 100 + tahunDua;
  if (tahun > tahunIni) tahun -= 100;
  if (tahunIni - tahun > 120) tahun += 100;

  const iso = `${String(tahun).padStart(4, "0")}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return null;
  if (parsed.getTime() > Date.now()) return null;
  return { tanggal_lahir: iso, jenis_kelamin: perempuan ? "Perempuan" : "Laki-laki" };
}

export function nikKodeTanggalSah(nik: string): boolean {
  return uraikanTanggalDariNik(nik) != null;
}

function kumpulkanDigit16(teks: string): string[] {
  const gabung = teks.replace(/(\d)\s+(?=\d)/g, "$1");
  const ketemu = new Set<string>();
  const pola = /[0-9IlSBOZGo|l]{16,18}/g;
  let untai: RegExpExecArray | null;
  while ((untai = pola.exec(gabung))) {
    const nik = tokenNikKandidat(untai[0]);
    if (nik && nikDigitSah(nik)) ketemu.add(nik);
  }
  const cadangan = gabung.match(/\d{16}/g) || [];
  for (const nik of cadangan) {
    if (nikDigitSah(nik)) ketemu.add(nik);
  }
  return [...ketemu];
}

function ambilSetelahLabel(teks: string, label: RegExp): string {
  const untai = label.exec(teks);
  if (!untai || untai.index == null) return "";
  const potong = teks.slice(untai.index + untai[0].length, untai.index + untai[0].length + 180);
  const baris = potong.split(/\n/)[0] || "";
  return baris.replace(/^[\s.:\-–]+/, "").split(/\s{2,}| {3,}/)[0]?.trim() || baris.trim();
}

function parseTanggalLabel(mentah: string): { tempat: string; tanggal: string } {
  const gabung = mentah.replace(/\s+/g, " ").trim();
  const untai = gabung.match(
    /([A-Za-zÀ-ÿ.'\-\s]+?)[, ]+(\d{1,2})[\/\-.\s](\d{1,2})[\/\-.\s](\d{2,4})/,
  );
  if (!untai) {
    const hanyaTanggal = gabung.match(/(\d{1,2})[\/\-.\s](\d{1,2})[\/\-.\s](\d{2,4})/);
    if (!hanyaTanggal) return { tempat: judulNama(gabung), tanggal: "" };
    return { tempat: "", tanggal: isoDariAngka(hanyaTanggal[1], hanyaTanggal[2], hanyaTanggal[3]) };
  }
  return {
    tempat: judulNama(untai[1]),
    tanggal: isoDariAngka(untai[2], untai[3], untai[4]),
  };
}

function isoDariAngka(hariTeks: string, bulanTeks: string, tahunTeks: string): string {
  const hari = Number(hariTeks);
  const bulan = Number(bulanTeks);
  let tahun = Number(tahunTeks);
  if (tahunTeks.length === 2) {
    const tahunIni = new Date().getUTCFullYear();
    tahun = Math.floor(tahunIni / 100) * 100 + tahun;
    if (tahun > tahunIni) tahun -= 100;
  }
  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31 || tahun < 1900) return "";
  const iso = `${String(tahun).padStart(4, "0")}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return "";
  return iso;
}

export function petaAgamaOcr(nilai: string): string {
  const n = nilai.toLowerCase();
  if (n.includes("islam")) return "Islam";
  if (n.includes("hindu")) return "Hindu";
  if (/bud+h?a/.test(n)) return "Budha";
  if (n.includes("konghucu") || n.includes("khonghucu") || n.includes("confuc")) return "Konghucu";
  if (n.includes("kristen") || n.includes("katolik") || n.includes("katholik") || n.includes("protestan")) {
    return "Kristen/Katolik";
  }
  return "";
}

export function petaKelaminOcr(nilai: string): "Laki-laki" | "Perempuan" | "" {
  const n = nilai.toLowerCase().replace(/[^a-z]/g, " ").trim();
  if (/^(l|laki|lakilaki|pria|male)\b/.test(n) || n.includes("laki")) return "Laki-laki";
  if (/^(p|perempuan|wanita|female)\b/.test(n) || n.includes("perempuan") || n.includes("wanita")) {
    return "Perempuan";
  }
  return "";
}

export function petaPendidikanOcr(nilai: string): string {
  const n = nilai.toLowerCase().replace(/\s+/g, " ").trim();
  if (!n) return "";
  const aturan: { uji: RegExp; nilai: string }[] = [
    { uji: /belum sekolah/, nilai: "Belum sekolah" },
    { uji: /tidak\/?belum sekolah|tdk\/?blm sekolah|tidak sekolah/, nilai: "Tidak/Belum Sekolah" },
    { uji: /belum tamat sd|tdk tamat sd|tidak tamat sd/, nilai: "Tdk Tamat SD/MI" },
    { uji: /masih sd/, nilai: "Masih SD/MI" },
    { uji: /strata\s*(ii|2)|\bs2\b|magister/, nilai: "STRATA 2" },
    { uji: /dip(loma)?\s*iv|strata\s*(iv|1|i)\b|\bs1\b/, nilai: "DIP IV/STRATA 1" },
    { uji: /dip(loma)?\s*iii|\bd[- ]?iii\b|akademi/, nilai: "DIP III" },
    { uji: /dip(loma)?\s*ii|\bd[- ]?ii\b/, nilai: "DII" },
    { uji: /slta|\bsma\b|\bsmk\b|\bma\b/, nilai: "SLTA/MA" },
    { uji: /sltp|\bsmp\b|\bmts/, nilai: "SLTP/MTSN" },
    { uji: /\bsd\b|\bmi\b|tamat sd/, nilai: "SD/MI" },
  ];
  for (const item of aturan) {
    if (item.uji.test(n)) return item.nilai;
  }
  return "";
}

function petaHubungan(nilai: string): Pick<JiwaOcr, "hubungan_keluarga" | "hubungan_detail" | "hubungan_kk"> {
  const n = nilai.toLowerCase().replace(/\s+/g, " ").trim();
  if (/kepala keluarga|\bkk\b/.test(n)) {
    return { hubungan_keluarga: "", hubungan_detail: "", hubungan_kk: "KK" };
  }
  if (n.includes("istri")) return { hubungan_keluarga: "Istri", hubungan_detail: "", hubungan_kk: "Istri" };
  if (n.includes("suami")) return { hubungan_keluarga: "Suami", hubungan_detail: "", hubungan_kk: "Suami" };
  if (n.includes("anak") || n.includes("son") || n.includes("daughter")) {
    return { hubungan_keluarga: "Anak", hubungan_detail: "", hubungan_kk: "Anak" };
  }
  const lain = [
    "menantu",
    "cucu",
    "orang tua",
    "mertua",
    "famili",
    "pembantu",
    "keponakan",
    "adik",
    "kakak",
    "lainnya",
  ];
  for (const kata of lain) {
    if (n.includes(kata)) {
      return { hubungan_keluarga: "Lainnya", hubungan_detail: judulNama(kata), hubungan_kk: "Lainnya" };
    }
  }
  return { hubungan_keluarga: "", hubungan_detail: "", hubungan_kk: "" };
}

export function rapikanAlamatOcr(nilai: string): string {
  let teks = nilai.replace(/\s+/g, " ").trim();
  teks = teks.replace(/\bRT\s*\/?\s*RW\b.*$/i, "");
  teks = teks.replace(/\bRT\.?\s*\d+.*/i, "");
  teks = teks.replace(/\bKEL(\/DESA)?\b.*$/i, "");
  teks = teks.replace(/\bKECAMATAN\b.*$/i, "");
  teks = teks.replace(/\bKAB(UPATEN)?\b.*$/i, "");
  teks = teks.replace(/\bPROVINSI\b.*$/i, "");
  teks = teks.replace(/\bGOL\.?\s*DARAH\b.*$/i, "");
  return teks.replace(/\s+/g, " ").trim().slice(0, 300);
}

function isiDariNik(jiwa: JiwaOcr): JiwaOcr {
  if (!jiwa.nik) return jiwa;
  const uraian = uraikanTanggalDariNik(jiwa.nik);
  if (!uraian) return jiwa;
  return {
    ...jiwa,
    tanggal_lahir: jiwa.tanggal_lahir || uraian.tanggal_lahir,
    jenis_kelamin: jiwa.jenis_kelamin || uraian.jenis_kelamin,
  };
}

function parsePotonganJiwa(potongan: string, nik: string): JiwaOcr {
  const jiwa = jiwaKosong();
  jiwa.nik = nik;
  const indeksNik = potongan.indexOf(nik);
  const jendela = indeksNik >= 0 ? potongan.slice(indeksNik, indeksNik + 280) : potongan.slice(0, 280);
  const namaLabel = ambilSetelahLabel(potongan, /nama(?:\s*lengkap)?\s*:?/i);
  if (namaLabel) jiwa.nama_lengkap = judulNama(namaLabel.split(/nik|jenis|tempat|agama|status/i)[0] || namaLabel);
  const ttl = ambilSetelahLabel(potongan, /tempat\s*(?:\/\s*)?(?:tgl|tanggal)?\s*lahir\s*:?/i);
  if (ttl) {
    const uraian = parseTanggalLabel(ttl);
    jiwa.tempat_lahir = uraian.tempat;
    jiwa.tanggal_lahir = uraian.tanggal;
  }
  jiwa.jenis_kelamin = petaKelaminOcr(ambilSetelahLabel(jendela, /jenis\s*kelamin\s*:?/i) || jendela);
  jiwa.agama = petaAgamaOcr(ambilSetelahLabel(jendela, /agama\s*:?/i) || jendela);
  const kerja = ambilSetelahLabel(jendela, /pekerjaan\s*:?/i);
  if (kerja) jiwa.pekerjaan = judulNama(kerja.split(/kewarganegaraan|status|pendidikan/i)[0] || kerja).slice(0, 100);
  jiwa.pendidikan = petaPendidikanOcr(ambilSetelahLabel(jendela, /pendidikan\s*:?/i) || jendela);
  const hub = petaHubungan(ambilSetelahLabel(jendela, /(?:status\s*)?hub(?:ungan)?(?:\s*dalam\s*keluarga)?\s*:?/i) || jendela);
  jiwa.hubungan_keluarga = hub.hubungan_keluarga;
  jiwa.hubungan_detail = hub.hubungan_detail;
  jiwa.hubungan_kk = hub.hubungan_kk;

  if (!jiwa.nama_lengkap) {
    const tanpaDigit = potongan
      .replace(/\d{16}/g, " ")
      .replace(/[^A-Za-zÀ-ÿ'’.\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const buang = /^(nama|nik|laki|perempuan|islam|kristen|hindu|budha|konghucu|pekerjaan|alamat|keluarga)\s+/i;
    const kandidat = tanpaDigit.replace(buang, "").split(" ").slice(0, 5).join(" ");
    if (kandidat.length >= 3) jiwa.nama_lengkap = judulNama(kandidat);
  }
  return isiDariNik(jiwa);
}

function detectJenis(teks: string, jumlahNik: number): HasilOcrIdentitas["jenis"] {
  const n = teks.toLowerCase();
  if (n.includes("kartu keluarga") || n.includes("nomor kk") || /no\.?\s*kk/.test(n) || jumlahNik > 1) {
    return "kk";
  }
  if (n.includes("nik") || n.includes("provinsi") || n.includes("jenis kelamin")) return "ktp";
  return "tidak_dikenali";
}

function noKkDariTeks(teks: string, daftarDigit: string[]): string {
  const untai = /(?:nomor|no\.?)\s*(?:kk|kartu\s*keluarga)?\s*:?\s*([0-9IlSBOZGo|l ]{16,24})/i.exec(teks);
  if (untai) {
    const dariLabel = kumpulkanDigit16(untai[1])[0] || tokenNikKandidat(untai[1].replace(/\s/g, ""));
    if (dariLabel && nikDigitSah(dariLabel)) return dariLabel;
  }
  const bukanLahir = daftarDigit.find((item) => !nikKodeTanggalSah(item));
  return bukanLahir || "";
}

function alamatDariTeks(teks: string): string {
  const label = ambilSetelahLabel(teks, /alamat\s*:?/i);
  return rapikanAlamatOcr(label);
}

function parseKtp(teks: string, daftarDigit: string[]): HasilOcrIdentitas {
  const nikLabel = ambilSetelahLabel(teks, /nik\s*:?/i);
  const nikDariLabel = kumpulkanDigit16(nikLabel)[0] || "";
  const nik = nikDariLabel || daftarDigit.find((item) => nikKodeTanggalSah(item)) || daftarDigit[0] || "";
  const kepala = parsePotonganJiwa(teks, nik);
  const nama = ambilSetelahLabel(teks, /nama\s*:?/i);
  if (nama) kepala.nama_lengkap = judulNama(nama.split(/tempat|nik|jenis/i)[0] || nama);
  kepala.hubungan_kk = "KK";
  const peringatan: string[] = [];
  if (!kepala.nik) peringatan.push("NIK tidak terbaca. Ketik manual dari KTP.");
  return {
    jenis: "ktp",
    no_kk: "",
    alamat: alamatDariTeks(teks),
    kepala: kepala.nik || kepala.nama_lengkap ? kepala : null,
    anggota: [],
    peringatan,
  };
}

function parseKk(teks: string, daftarDigit: string[]): HasilOcrIdentitas {
  const noKk = noKkDariTeks(teks, daftarDigit);
  const nikAnggota = daftarDigit.filter((item) => item !== noKk && nikKodeTanggalSah(item));
  const namaKepalaLabel = judulNama(ambilSetelahLabel(teks, /nama\s*kepala\s*keluarga\s*:?/i));
  const jiwa: JiwaOcr[] = [];

  if (nikAnggota.length === 0) {
    const cadangan = daftarDigit.filter((item) => item !== noKk);
    for (const nik of cadangan) jiwa.push(parsePotonganJiwa(teks, nik));
  } else {
    for (let i = 0; i < nikAnggota.length; i += 1) {
      const nik = nikAnggota[i];
      const indeks = teks.indexOf(nik);
      const akhir = i + 1 < nikAnggota.length ? teks.indexOf(nikAnggota[i + 1], indeks + 16) : teks.length;
      const potongan = indeks >= 0 ? teks.slice(Math.max(0, indeks - 80), akhir) : teks;
      jiwa.push(parsePotonganJiwa(potongan, nik));
    }
  }

  if (namaKepalaLabel) {
    const sudah = jiwa.find((item) => item.nama_lengkap.toLowerCase() === namaKepalaLabel.toLowerCase());
    if (sudah) sudah.hubungan_kk = "KK";
    else if (jiwa[0] && !jiwa[0].nama_lengkap) jiwa[0].nama_lengkap = namaKepalaLabel;
    else if (jiwa[0]) jiwa[0].hubungan_kk = jiwa[0].hubungan_kk || "KK";
  } else if (jiwa[0]) {
    jiwa[0].hubungan_kk = jiwa[0].hubungan_kk || "KK";
  }

  const kepala = jiwa.find((item) => item.hubungan_kk === "KK") || jiwa[0] || null;
  const anggota = jiwa.filter((item) => item !== kepala);
  const peringatan: string[] = [];
  if (!noKk) peringatan.push("Nomor KK tidak terbaca. Ketik 16 digit dari kartu.");
  if (!kepala) peringatan.push("Tidak ada jiwa yang terbaca dari foto KK.");
  if (anggota.length === 0 && jiwa.length <= 1) {
    peringatan.push("Anggota keluarga tidak terurai. Tabel KK sering buram; tambah anggota manual bila perlu.");
  }
  return {
    jenis: "kk",
    no_kk: noKk,
    alamat: alamatDariTeks(teks),
    kepala,
    anggota,
    peringatan,
  };
}

export function parseTeksOcr(mentah: string): HasilOcrIdentitas {
  const teks = rapikanSpasi(mentah || "");
  const daftarDigit = kumpulkanDigit16(teks);
  if (!teks) {
    return {
      jenis: "tidak_dikenali",
      no_kk: "",
      alamat: "",
      kepala: null,
      anggota: [],
      peringatan: ["Foto tidak menghasilkan teks. Ambil ulang dengan cahaya rata, tanpa kilap plastik."],
    };
  }
  const jenis = detectJenis(teks, daftarDigit.filter((item) => nikKodeTanggalSah(item)).length);
  if (jenis === "kk") return parseKk(teks, daftarDigit);
  if (jenis === "ktp") return parseKtp(teks, daftarDigit);
  return {
    jenis: "tidak_dikenali",
    no_kk: noKkDariTeks(teks, daftarDigit),
    alamat: alamatDariTeks(teks),
    kepala: daftarDigit[0] ? parsePotonganJiwa(teks, daftarDigit.find((item) => nikKodeTanggalSah(item)) || daftarDigit[0]) : null,
    anggota: [],
    peringatan: ["Format kartu tidak dikenali. Cek isian manual sebelum kirim."],
  };
}

function kepalaKeIsian(kepala: JiwaOcr | null, noKk: string, alamat: string): IsianKepalaOcr {
  return {
    nik: kepala?.nik || "",
    no_kk: noKk,
    nama_lengkap: kepala?.nama_lengkap || "",
    tempat_lahir: kepala?.tempat_lahir || "",
    tanggal_lahir: kepala?.tanggal_lahir || "",
    jenis_kelamin: kepala?.jenis_kelamin || "",
    agama: kepala?.agama || "",
    pekerjaan: kepala?.pekerjaan || "",
    pendidikan: kepala?.pendidikan || "",
    detail_alamat: alamat,
    hubungan_kk: kepala?.hubungan_kk || (kepala ? "KK" : ""),
  };
}

function jiwaKeAnggota(jiwa: JiwaOcr): IsianAnggotaOcr {
  return {
    nik: jiwa.nik,
    nama_lengkap: jiwa.nama_lengkap,
    tempat_lahir: jiwa.tempat_lahir,
    tanggal_lahir: jiwa.tanggal_lahir,
    jenis_kelamin: jiwa.jenis_kelamin,
    agama: jiwa.agama,
    pekerjaan: jiwa.pekerjaan,
    pendidikan: jiwa.pendidikan,
    hubungan_keluarga: jiwa.hubungan_keluarga,
    hubungan_detail: jiwa.hubungan_detail,
  };
}

export function susunIsianDariOcr(
  hasil: HasilOcrIdentitas,
  opsi?: { nikTerkunci?: string },
): { kepala: IsianKepalaOcr; anggota: IsianAnggotaOcr[]; peringatan: string[]; bisaDiterapkan: boolean } {
  const nikTerkunci = opsi?.nikTerkunci && nikDigitSah(opsi.nikTerkunci) ? opsi.nikTerkunci : "";
  const semua: JiwaOcr[] = [
    ...(hasil.kepala ? [hasil.kepala] : []),
    ...hasil.anggota,
  ];
  const peringatan = [...hasil.peringatan];

  if (nikTerkunci) {
    const cocok = semua.find((item) => item.nik === nikTerkunci) || null;
    if (!cocok) {
      peringatan.push(
        "NIK di foto tidak sama dengan NIK akun ini. Hasil tidak boleh diterapkan otomatis — itu bisa menempel data KK orang lain ke rumah tangga Anda.",
      );
      return {
        kepala: kepalaKeIsian(null, "", ""),
        anggota: [],
        peringatan,
        bisaDiterapkan: false,
      };
    }
    const anggota = semua.filter((item) => item.nik && item.nik !== nikTerkunci).map(jiwaKeAnggota);
    return {
      kepala: kepalaKeIsian(cocok, hasil.no_kk, hasil.alamat),
      anggota,
      peringatan,
      bisaDiterapkan: Boolean(cocok.nik || hasil.no_kk || anggota.length),
    };
  }

  const bisa = Boolean(hasil.kepala?.nik || hasil.no_kk || hasil.anggota.length);
  if (!bisa) peringatan.push("Tidak ada NIK atau nomor KK yang layak diterapkan.");
  return {
    kepala: kepalaKeIsian(hasil.kepala, hasil.no_kk, hasil.alamat),
    anggota: hasil.anggota.map(jiwaKeAnggota),
    peringatan,
    bisaDiterapkan: bisa,
  };
}
