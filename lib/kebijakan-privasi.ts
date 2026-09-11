/**
 * Naskah dan versi Kebijakan Privasi. Modul ini sengaja murni (tanpa
 * server-only) agar halaman publik, formulir register, dan Server Action
 * memakai teks serta nomor versi yang sama.
 */
export const VERSI_KEBIJAKAN_PRIVASI = "2026-09-11";
export const PATH_KEBIJAKAN_PRIVASI = "/kebijakan-privasi";
export const PATH_SURAT_PERSETUJUAN = "/kebijakan-privasi/surat";
export const USIA_ANAK_PDP = 18;
export const TANGGAL_PEMBERITAHUAN_PDP = "2026-09-11";
export const HARI_TENGGAT_DATA_SPESIFIK = 60;
export const JUDUL_PENGUMUMAN_PDP = "Pemberitahuan pelindungan data pribadi";

export const PESAN_PERSETUJUAN_WAJIB =
  "Pendaftaran ditolak: baca dan setujui Kebijakan Privasi terlebih dahulu.";
export const PESAN_PERSETUJUAN_CARIK =
  "Carik ditolak: baca Kebijakan Privasi dan setujui pemrosesan data administrasi RT terlebih dahulu.";
export const PESAN_IMPOR_CSV_DITOLAK =
  "Impor CSV NIK dimatikan. Pendaftaran warga baru lewat Lapor Diri atau surat pernyataan kertas yang naskahnya sama dengan Kebijakan Privasi. Impor massal tanpa dasar dan tanpa pemberitahuan ke subjek tidak diperbolehkan.";

export type SumberPersetujuan = "lapor_diri" | "carik" | "kertas" | "portal";

export type PersetujuanLaporDiri = {
  versi_naskah: string;
  baca_kebijakan: boolean;
  data_pribadi: boolean;
  data_anggota: boolean;
  data_anak: boolean;
  data_keuangan: boolean;
};

export type JejakPersetujuan = {
  id: string;
  warga_id: string;
  sumber: SumberPersetujuan;
  versi_naskah: string;
  data_pribadi: boolean;
  data_keuangan: boolean;
  data_anggota: boolean;
  data_anak: boolean;
  berkas_path: string | null;
  dicatat_pada: string;
};

export type InventoriPdp = {
  tanpaJejak: number;
  pendapatanTanpaKeuangan: number;
  fotoKkTanpaJejak: number;
  tenggat: string;
  pemberitahuan: string;
  tenggatLewat: boolean;
};

export type BagianKebijakanPrivasi = {
  id: string;
  judul: string;
  pengantar?: string;
  paragraf: string[];
};

export const PENGANTAR_KEBIJAKAN_PRIVASI =
  `Versi ${VERSI_KEBIJAKAN_PRIVASI}. Portal ini membantu kami mengurus buku induk, surat, iuran, dan pengumuman lingkungan. Agar itu tertib, kami perlu data Anda — sama seperti catatan di sekretariat, hanya disimpan di sistem digital yang dikunci.`;

export const PENUTUP_KEBIJAKAN_PRIVASI =
  "Kalau ada yang kurang jelas, tanyakan langsung ke pengurus RT Anda. Kami lebih suka Anda bertanya daripada merasa ragu saat memakai portal ini.";

export const BAGIAN_KEBIJAKAN_PRIVASI: BagianKebijakanPrivasi[] = [
  {
    id: "janji",
    judul: "Janji kami kepada Anda",
    pengantar:
      "Kami memakai nama, nomor kontak, dan data kependudukan Anda murni untuk ketertiban administrasi lingkungan. Bukan untuk dijual, bukan untuk dibagikan ke RT lain, dan bukan untuk disalahgunakan.",
    paragraf: [
      "Data Anda hanya dipegang pengurus RT yang berwenang dan kami yang merawat sistem. Bukan untuk iklan, bukan untuk dijual.",
      "Centang di formulir Lapor Diri berarti Anda setuju dengan versi dokumen ini pada saat Anda mengirim data.",
    ],
  },
  {
    id: "pengendali",
    judul: "1. Siapa yang menjaga data Anda",
    paragraf: [
      "Yang memutuskan untuk apa data dipakai adalah pengurus RT di wilayah tempat Anda mendaftar: buku induk, verifikasi warga, surat, iuran, dan layanan RT.",
      "Kami, pengelola aplikasi, merawat lemarinya yang digital: tempat data disimpan, cara Anda masuk portal, dan pengiriman pemberitahuan.",
      "Kalau Anda ingin data dibetulkan atau dihapus, sampaikan ke pengurus RT Anda. Kami tidak menghapus data suatu RT tanpa keputusan pengurus.",
    ],
  },
  {
    id: "dasar",
    judul: "2. Atas dasar apa kami memakai data",
    paragraf: [
      "Kami memakai data yang Anda kirim lewat Lapor Diri karena Anda memberi izin di formulir. Izin itu sesuai Pasal 20 Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.",
      "Hal yang lebih pribadi — keuangan rumah tangga, data anak, dan foto Kartu Keluarga — hanya kami pakai jika Anda mencentang izin khusus. Centang itu terpisah dari pernyataan bahwa data Anda benar.",
      "Anda boleh menarik izin kapan saja dengan menghubungi pengurus RT. Yang sudah dikerjakan sebelum izin ditarik tetap sah.",
      "Tanpa data identitas, beberapa layanan tidak bisa jalan: surat pengantar, iuran, dan pengecekan bahwa Anda memang warga di sini.",
    ],
  },
  {
    id: "data",
    judul: "3. Data yang kami minta",
    pengantar: "Kami hanya minta yang dibutuhkan untuk administrasi RT. Ini rinciannya:",
    paragraf: [
      "Identitas: NIK, nomor KK, nama lengkap, tempat dan tanggal lahir, jenis kelamin, agama, pekerjaan, pendidikan, status tinggal, dan alamat.",
      "Kontak: nomor WhatsApp, supaya pengurus bisa menghubungi Anda untuk verifikasi, pengumuman, atau keperluan lingkungan.",
      "Dokumen: foto Kartu Keluarga, jika Anda mengunggahnya. Unggah foto KTP sedang dimatikan.",
      "Gambaran rumah tangga: kisaran pendapatan bulanan dan daya listrik. Ini untuk program lingkungan (misalnya santunan atau pendataan), bukan data DTKS Kemensos, dan bukan untuk menyalurkan bansos pemerintah. Kalau suatu saat pengurus ingin memakainya untuk itu, kami akan minta izin baru.",
      "Anggota keluarga: data serupa untuk orang yang Anda daftarkan, termasuk anak di bawah 18 tahun jika Anda mengisinya sebagai orang tua atau wali.",
      "Kunci masuk portal: PIN Anda tidak disimpan apa adanya. Kami hanya menyimpan jejak acaknya, sehingga angka asli tidak terbaca. Saat Anda masuk, portal memakai cookie yang tidak bisa dibaca sembarang situs.",
      "Pemberitahuan di HP atau komputer: hanya jika Anda menyalakan notifikasi. Penyedia notifikasi menerima alias akun, bukan NIK.",
    ],
  },
  {
    id: "tujuan",
    judul: "4. Untuk apa data dipakai",
    paragraf: [
      "Mencatat dan memverifikasi Anda di buku induk RT.",
      "Memberi akses portal: pengumuman, iuran, surat pengantar, laporan, dan layanan RT lain yang Anda pilih.",
      "Menghubungi Anda soal verifikasi, iuran, atau keadaan darurat di lingkungan.",
      "Menampilkan angka ringkas di halaman publik (jumlah jiwa, sebaran usia atau agama) tanpa nama dan tanpa NIK. Ibarat menghitung jumlah rumah, bukan menempelkan papan nama di pagar.",
      "Menjaga keamanan akun: membatasi percobaan masuk yang mencurigakan dan mencatat jejak kerja pengurus.",
    ],
  },
  {
    id: "penerima",
    judul: "5. Siapa yang boleh melihat",
    paragraf: [
      "Pengurus RT Anda: biodata, dokumen KK, dan data keluarga, untuk verifikasi dan administrasi.",
      "Anda sendiri, setelah akun disetujui: data rumah tangga Anda di portal.",
      "Tempat penyimpanan digital (Supabase) dan tempat aplikasi dijalankan (Vercel): mereka menyimpan dan menampilkan data atas instruksi kami. Server mereka bisa berada di luar Indonesia — seperti menitipkan brankas di gedung yang terjaga, bukan di rumah ketua RT.",
      "Penyedia notifikasi (OneSignal), hanya jika Anda menyalakan notifikasi: alias akun dan isi pemberitahuan, bukan NIK.",
      "WhatsApp/Meta, hanya jika pengurus mengetuk tautan chat ke nomor Anda (misalnya menagih iuran): nomor dan teks yang diketik pengurus.",
      "Kami tidak menjual data. Kami tidak membagikannya ke RT lain.",
    ],
  },
  {
    id: "retensi",
    judul: "6. Berapa lama data disimpan",
    paragraf: [
      "Selama Anda tercatat sebagai warga RT dan akun masih dibutuhkan untuk layanan portal.",
      "Jika pengurus menghapus data, salinan sementara bisa masuk kotak sampah internal. Saat ini kotak itu belum dikosongkan otomatis. Untuk hapus permanen, sampaikan ke pengurus.",
      "Salinan pengaman (cadangan) bisa bertahan lebih lama, sesuai jadwal harian, mingguan, atau tahunan. Cadangan tidak boleh dipakai untuk menghidupkan kembali data yang sudah sah dihapus, kecuali ada kewajiban hukum.",
    ],
  },
  {
    id: "hak",
    judul: "7. Hak Anda sebagai warga",
    paragraf: [
      "Hak tahu: dokumen ini, plus penjelasan di formulir lapor diri.",
      "Hak melihat dan membetulkan: lewat portal (menu Carik / keluarga) setelah akun disetujui, atau lewat pengurus RT.",
      "Hak menarik izin, membatasi pemakaian, dan meminta penghapusan: sampaikan ke pengurus RT. Portal belum punya tombol hapus akun atau unduh salinan sendiri. Itu keterbatasan sistem, bukan berarti hak Anda hilang.",
      "Hak mengadu ke lembaga pengawas pelindungan data pribadi, sesuai peraturan yang berlaku.",
    ],
  },
  {
    id: "keamanan",
    judul: "8. Cara kami menjaga data",
    paragraf: [
      "PIN disimpan dalam bentuk yang tidak bisa dibaca balik. Cookie sesi dikunci agar tidak bisa disalin sembarangan. Foto KK disimpan di ruang privat, bukan tautan yang bisa dibuka siapa pun.",
      "Draf formulir di peramban tidak menyimpan PIN. Anda harus mengetik ulang PIN sebelum mengirim.",
      "Tidak ada sistem yang benar-benar kebal. Kalau terjadi insiden yang berisiko terhadap data Anda, kami akan berupaya memberitahu sesuai kewajiban hukum.",
    ],
  },
  {
    id: "anak",
    judul: "9. Data anak",
    paragraf: [
      "Anak di sini artinya belum berusia 18 tahun. Data anak hanya boleh diisi oleh orang tua atau wali yang berwenang.",
      "Jika Anda mendaftarkan anak, Anda wajib mencentang izin khusus data anak. Mengisi data anak orang lain tanpa wewenang tidak diperbolehkan.",
    ],
  },
  {
    id: "perubahan",
    judul: "10. Jika ketentuan ini berubah",
    paragraf: [
      `Versi dokumen ini: ${VERSI_KEBIJAKAN_PRIVASI}.`,
      "Kalau isinya berubah secara penting, nomor versinya akan kami ganti.",
      "Lapor diri baru harus menyetujui versi yang berlaku pada saat Anda mengirim formulir.",
    ],
  },
];

export function tanggalTenggatDataSpesifik(): string {
  const awal = new Date(`${TANGGAL_PEMBERITAHUAN_PDP}T00:00:00.000Z`);
  awal.setUTCDate(awal.getUTCDate() + HARI_TENGGAT_DATA_SPESIFIK);
  return awal.toISOString().slice(0, 10);
}

export function tenggatPdpSudahLewat(acuan = new Date()): boolean {
  return acuan.toISOString().slice(0, 10) >= tanggalTenggatDataSpesifik();
}

export function formatTanggalPdp(tanggalIso: string): string {
  const [tahun, bulan, hari] = tanggalIso.split("-").map((n) => Number(n));
  if (!tahun || !bulan || !hari) return tanggalIso;
  const label = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  return `${hari} ${label[bulan - 1]} ${tahun}`;
}

export const TEKS_PEMBERITAHUAN_DATA_LAMA =
  `Pengurus RT memakai data buku induk (nama, alamat, NIK, WhatsApp) untuk surat, iuran, ronda, dan pengumuman. Data yang lebih pribadi — kisaran pendapatan, daya listrik, dan foto Kartu Keluarga — hanya dipakai jika Anda atau wali memberi izin. Tanpa izin, data itu akan dikosongkan setelah ${formatTanggalPdp(tanggalTenggatDataSpesifik())}. Login dan layanan administrasi RT tidak dikunci hanya karena izin itu ditunda.`;

export const ISI_PENGUMUMAN_PDP =
  `${TEKS_PEMBERITAHUAN_DATA_LAMA}\n\nBaca naskah lengkap di portal (Kebijakan Privasi versi ${VERSI_KEBIJAKAN_PRIVASI}). Kepala keluarga yang memakai portal dapat mengisi izin di Carik atau di beranda portal. Yang tidak membuka situs dapat menandatangani surat kertas dengan naskah yang sama, lalu serahkan ke pengurus.`;

export function umurDariTanggalIso(tanggal: string, acuan = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return null;
  const lahir = new Date(`${tanggal}T00:00:00.000Z`);
  if (Number.isNaN(lahir.getTime()) || lahir.toISOString().slice(0, 10) !== tanggal) return null;
  let umur = acuan.getUTCFullYear() - lahir.getUTCFullYear();
  const belumUlangTahun =
    acuan.getUTCMonth() < lahir.getUTCMonth()
    || (acuan.getUTCMonth() === lahir.getUTCMonth() && acuan.getUTCDate() < lahir.getUTCDate());
  if (belumUlangTahun) umur -= 1;
  return umur;
}

export function jumlahAnakDariTanggal(tanggalLahir: string[]): number {
  return tanggalLahir.filter((nilai) => {
    const umur = umurDariTanggalIso(nilai);
    return umur != null && umur < USIA_ANAK_PDP;
  }).length;
}

function booleanWajib(value: unknown): boolean {
  return value === true;
}

export function normalisasiPersetujuanLaporDiri(
  value: unknown,
  jumlahAnggota: number,
  jumlahAnak: number,
  opsi?: { wajibKeuangan?: boolean; pesanWajib?: string }
): { ok: true; data: PersetujuanLaporDiri } | { ok: false; message: string } {
  const pesanWajib = opsi?.pesanWajib || PESAN_PERSETUJUAN_WAJIB;
  const wajibKeuangan = opsi?.wajibKeuangan !== false;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: pesanWajib };
  }
  const sumber = value as Record<string, unknown>;
  const versi = typeof sumber.versi_naskah === "string" ? sumber.versi_naskah.trim() : "";
  if (versi !== VERSI_KEBIJAKAN_PRIVASI) {
    return { ok: false, message: "Kebijakan Privasi sudah diperbarui. Muat ulang halaman, baca naskah terbaru, lalu setujui lagi." };
  }

  const data: PersetujuanLaporDiri = {
    versi_naskah: versi,
    baca_kebijakan: booleanWajib(sumber.baca_kebijakan),
    data_pribadi: booleanWajib(sumber.data_pribadi),
    data_anggota: booleanWajib(sumber.data_anggota),
    data_anak: booleanWajib(sumber.data_anak),
    data_keuangan: booleanWajib(sumber.data_keuangan),
  };

  if (!data.baca_kebijakan || !data.data_pribadi || (wajibKeuangan && !data.data_keuangan)) {
    return { ok: false, message: pesanWajib };
  }
  if (jumlahAnggota === 0) data.data_anggota = false;
  if (jumlahAnak === 0) data.data_anak = false;
  if (jumlahAnggota > 0 && !data.data_anggota) {
    return { ok: false, message: "Pendaftaran anggota keluarga membutuhkan persetujuan tersendiri dari penanggung jawab." };
  }
  if (jumlahAnak > 0 && !data.data_anak) {
    return { ok: false, message: "Data anak di bawah 18 tahun membutuhkan persetujuan orang tua atau wali." };
  }
  return { ok: true, data };
}

export function ringkasanAuditPersetujuan(
  persetujuan: PersetujuanLaporDiri,
  meta: { wargaId: string; jumlahAnggota: number; jumlahAnak: number; sumber?: SumberPersetujuan }
): string {
  const sumber = meta.sumber || "lapor_diri";
  return [
    `Persetujuan ${sumber} v${persetujuan.versi_naskah}`,
    `warga_id=${meta.wargaId}`,
    `anggota=${meta.jumlahAnggota}`,
    `anak=${meta.jumlahAnak}`,
    `baca=${persetujuan.baca_kebijakan ? "ya" : "tidak"}`,
    `pribadi=${persetujuan.data_pribadi ? "ya" : "tidak"}`,
    `keluarga=${persetujuan.data_anggota ? "ya" : "tidak"}`,
    `anak_ok=${persetujuan.data_anak ? "ya" : "tidak"}`,
    `keuangan=${persetujuan.data_keuangan ? "ya" : "tidak"}`,
  ].join("; ");
}
