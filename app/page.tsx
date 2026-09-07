import Image from "next/image";
import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { skemaBelumSiap } from "@/lib/arsip-warga";
import { hitungJiwa, rekapDemografi, type RekamanJiwa } from "@/lib/demografi-publik";
import DemografiClient from "./DemografiClient";
import PengumumanClient from "./PengumumanClient";
import KinerjaSampahClient from "./portal/KinerjaSampahClient";
import PanicButtonClient, { type KontakDarurat } from "./PanicButtonClient";
import GaleriKegiatanClient, { type FotoKegiatan } from "./GaleriKegiatanClient";

export const revalidate = 60;

const TARGET_JUMANTIK = 151;
const UUID_SENTINEL = "00000000-0000-0000-0000-000000000000";
// Pola kanonik proyek (sama seperti lib/session-security): 8-4-4-4-12 hex.
// Jangan pakai RFC 4122 versi/varian — id tenant RT 07 berbentuk
// 00000000-0000-0000-0000-000000000007, yang ditolak regex versi 1-5.
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Landing page bersifat publik, sehingga tenant harus dipilih dari
// konfigurasi deployment. Tanpa nilai ini semua query tenant memakai UUID
// sentinel dan menghasilkan nol baris (fail closed), bukan query global.
const PUBLIC_RT_ID = (() => {
  const nilai = process.env.PUBLIC_RT_ID?.trim() || "";
  if (POLA_UUID.test(nilai) && nilai.toLowerCase() !== UUID_SENTINEL) {
    return nilai;
  }
  if (nilai) {
    console.error("PUBLIC_RT_ID tidak berbentuk UUID yang sah; portal publik fail-closed ke tenant kosong.");
  }
  return UUID_SENTINEL;
})();

type BarisKas = {
  tipe_transaksi: string;
  nominal: number;
  kategori?: string | null;
  keterangan?: string | null;
  tanggal_transaksi?: string | null;
  created_at?: string | null;
};

type BarisKurban = {
  jenis_transaksi: string;
  nominal: number;
  warga_id: string | null;
};

type BarisPosyanduBalita = {
  tanggal_kunjungan: string;
  imunisasi: string | null;
};

type BarisPosyanduLansia = {
  tanggal_kunjungan: string;
};

type DokumenPublik = {
  id: string;
  judul: string;
  deskripsi: string | null;
  kategori: string | null;
  url_berkas: string;
  ukuran_berkas: string | null;
  tanggal_terbit: string | null;
};

type MasterRt = {
  nama_rt: string | null;
  nama_rw: string | null;
  kelurahan: string | null;
};

function formatRp(angka: number) {
  const utuh = Math.round(Number(angka) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Rp ${utuh}`;
}

const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function formatTanggal(nilai: string | null | undefined) {
  if (!nilai) return "—";
  const d = new Date(nilai);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

function setoranKurban(jenis: string) {
  return jenis.toLowerCase().includes("setor");
}

function tarikanKurban(jenis: string) {
  const huruf = jenis.toLowerCase();
  return huruf.includes("tarik") || huruf.includes("penarikan");
}

function dalamBulanIni(tanggal: string) {
  const d = new Date(tanggal);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function dataAtauKosong<T>(
  hasil: { data: unknown; error: { message?: string; code?: string } | null },
  cadangan: T,
  label: string,
): T {
  if (hasil.error) {
    console.warn(`Portal publik gagal memuat ${label}:`, hasil.error.message || hasil.error.code);
    return cadangan;
  }
  return (hasil.data ?? cadangan) as T;
}

async function ambilDemografiSah(supabase: ReturnType<typeof getSupabaseAdminClient>, rtId: string) {
  const pilih =
    "id, rt_id, tanggal_lahir, jenis_kelamin, agama, pekerjaan, anggota_keluarga(id, rt_id, tanggal_lahir, jenis_kelamin, agama, pekerjaan)";
  // Induk sudah dikunci rt_id. Nested C2 menolak rt_id tenant lain, tetapi
  // anggota lama dengan rt_id NULL tetap dihitung sebagai jiwa KK ini.
  const dasar = () =>
    supabase
      .from("warga")
      .select(pilih)
      .eq("status_verifikasi", "Disetujui")
      .eq("rt_id", rtId)
      .or(`rt_id.eq.${rtId},rt_id.is.null`, { foreignTable: "anggota_keluarga" });

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

async function ambilKurbanRt(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rtId: string,
) {
  // transaksi_kurban legacy tidak memiliki rt_id. Resolve allow-list warga
  // terlebih dahulu agar service-role tidak pernah membaca ledger tenant lain.
  const { data: warga, error: errorWarga } = await supabase
    .from("warga")
    .select("id")
    .eq("rt_id", rtId)
    .limit(5000);
  if (errorWarga) return { data: [], error: errorWarga };

  const ids = (warga || []).map((baris) => String(baris.id)).filter((id) => POLA_UUID.test(id));
  if (!ids.length) return { data: [], error: null };

  // PostgREST menaruh .in() di query string. 680 UUID sekali tembak pecah
  // jadi HTTP 400 (URL terlalu panjang) — kartu Dana Kurban jadi Rp 0.
  const UKURAN_KELOMPOK = 80;
  const gabungan: BarisKurban[] = [];
  for (let i = 0; i < ids.length; i += UKURAN_KELOMPOK) {
    const potong = ids.slice(i, i + UKURAN_KELOMPOK);
    const { data, error } = await supabase
      .from("transaksi_kurban")
      .select("jenis_transaksi, nominal, warga_id")
      .in("warga_id", potong);
    if (error) return { data: [], error };
    gabungan.push(...((data || []) as BarisKurban[]));
  }
  return { data: gabungan, error: null };
}

async function ambilKasRt(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  rtId: string,
) {
  const UKURAN = 1000;
  const semua: BarisKas[] = [];
  let dari = 0;
  while (dari < 20000) {
    const { data, error } = await supabase
      .from("kas_rt")
      .select("tipe_transaksi, nominal, kategori, keterangan, tanggal_transaksi, created_at")
      .eq("rt_id", rtId)
      .order("created_at", { ascending: false })
      .range(dari, dari + UKURAN - 1);
    if (error) return { data: [], error };
    const batch = (data || []) as BarisKas[];
    semua.push(...batch);
    if (batch.length < UKURAN) break;
    dari += UKURAN;
  }
  return { data: semua, error: null };
}

async function ambilKunjunganPosyanduRt<T>(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tabel: "kunjungan_balita" | "kunjungan_lansia",
  kolom: string,
  rtId: string,
) {
  const UKURAN = 1000;
  const semua: T[] = [];
  let dari = 0;
  while (dari < 20000) {
    const { data, error } = await supabase
      .from(tabel)
      .select(kolom)
      .eq("rt_id", rtId)
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

export default async function LandingPage() {
  const supabase = getSupabaseAdminClient();

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
    galeriRes,
    dokumenRes,
    kontakRes,
    masterRes,
  ] = await Promise.all([
    supabase.from("pengumuman_rt").select("id, judul, deskripsi, link_dokumen, tanggal_publikasi").eq("rt_id", PUBLIC_RT_ID).order("tanggal_publikasi", { ascending: false }).limit(7),
    supabase.from("voting_rt").select("id, judul, deskripsi, opsi_1, opsi_2, status, created_at").eq("rt_id", PUBLIC_RT_ID).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ambilKasRt(supabase, PUBLIC_RT_ID),
    supabase.from("transaksi_sampah").select("berat_kg, nominal_warga, nominal_kas_rt, tanggal_transaksi").eq("rt_id", PUBLIC_RT_ID).ilike("jenis_transaksi", "%Setor%"),
    ambilDemografiSah(supabase, PUBLIC_RT_ID),
    supabase.from("laporan_jumantik").select("jumlah_rumah_diperiksa, ditemukan_jentik, warga_terjangkit_dbd, created_at").eq("rt_id", PUBLIC_RT_ID).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ambilKurbanRt(supabase, PUBLIC_RT_ID),
    ambilKunjunganPosyanduRt<BarisPosyanduBalita>(supabase, "kunjungan_balita", "tanggal_kunjungan, imunisasi", PUBLIC_RT_ID),
    ambilKunjunganPosyanduRt<BarisPosyanduLansia>(supabase, "kunjungan_lansia", "tanggal_kunjungan", PUBLIC_RT_ID),
    supabase.from("galeri_kegiatan").select("id, judul, deskripsi, url_foto, kategori, tanggal_kegiatan").eq("rt_id", PUBLIC_RT_ID).eq("dipublikasikan", true).order("urutan", { ascending: true }).order("tanggal_kegiatan", { ascending: false }).limit(8),
    supabase.from("dokumen_publik_rt").select("id, judul, deskripsi, kategori, url_berkas, ukuran_berkas, tanggal_terbit").eq("rt_id", PUBLIC_RT_ID).eq("dipublikasikan", true).order("urutan", { ascending: true }).order("tanggal_terbit", { ascending: false }).limit(8),
    supabase.from("kontak_darurat_rt").select("id, nama_layanan, nomor, keterangan, ikon, urutan").eq("rt_id", PUBLIC_RT_ID).eq("aktif", true).order("urutan", { ascending: true }),
    supabase.from("master_rt").select("nama_rt, nama_rw, kelurahan").eq("id", PUBLIC_RT_ID).maybeSingle(),
  ]);

  const pengumumanReguler = dataAtauKosong(pengumumanRes, [], "pengumuman");
  const votingTerbaru = votingTerbaruRes.error ? null : votingTerbaruRes.data;
  const kasData = dataAtauKosong(kasRes, [] as BarisKas[], "kas");
  const sampahGlobal = dataAtauKosong(sampahRes, [], "bank sampah");
  const jumantik = jumantikRes.error ? null : jumantikRes.data;
  const dataKurban = dataAtauKosong(kurbanRes, [] as BarisKurban[], "dana kurban");
  const dataBalita = dataAtauKosong(balitaRes, [] as BarisPosyanduBalita[], "posyandu balita");
  const dataLansia = dataAtauKosong(lansiaRes, [] as BarisPosyanduLansia[], "posyandu lansia");
  const daftarFoto = dataAtauKosong(galeriRes, [] as FotoKegiatan[], "galeri");
  const daftarDokumen = dataAtauKosong(dokumenRes, [] as DokumenPublik[], "dokumen publik");
  const daftarKontak = dataAtauKosong(kontakRes, [] as KontakDarurat[], "kontak darurat");
  const masterRt = (masterRes.error ? null : masterRes.data) as MasterRt | null;

  let rekapVoting: Record<string, unknown> | null = null;
  if (votingTerbaru) {
    let tampilkan = false;
    if (votingTerbaru.status === "Aktif") {
      tampilkan = true;
    } else if (votingTerbaru.status === "Ditutup") {
      // Server component ini hanya membutuhkan epoch saat render. getTime()
      // menghindari lint purity false-positive pada Date.now() tanpa mengubah
      // perilaku perhitungan umur voting.
      const selisihHari = Math.floor((new Date().getTime() - new Date(votingTerbaru.created_at).getTime()) / (1000 * 3600 * 24));
      if (selisihHari <= 7) tampilkan = true;
    }

    if (tampilkan) {
      const { data: suaraRekap } = await supabase.from("suara_voting").select("pilihan").eq("voting_id", votingTerbaru.id);
      const dataSuara = suaraRekap || [];
      const suaraOpsi1 = dataSuara.filter((s) => s.pilihan === votingTerbaru.opsi_1).length;
      const suaraOpsi2 = dataSuara.filter((s) => s.pilihan === votingTerbaru.opsi_2).length;
      const total = suaraOpsi1 + suaraOpsi2;
      rekapVoting = {
        ...votingTerbaru,
        statistik: {
          opsi_1_pct: total === 0 ? 0 : Math.round((suaraOpsi1 / total) * 100),
          opsi_2_pct: total === 0 ? 0 : Math.round((suaraOpsi2 / total) * 100),
          total,
        },
      };
    }
  }

  let pemasukan = 0;
  let pengeluaran = 0;
  kasData.forEach((k) => {
    if (k.tipe_transaksi === "Pemasukan") pemasukan += k.nominal;
    if (k.tipe_transaksi === "Pengeluaran") pengeluaran += k.nominal;
  });
  const saldoAkhir = pemasukan - pengeluaran;
  const mutasiPengeluaran = kasData.filter((k) => k.tipe_transaksi === "Pengeluaran").slice(0, 5);

  const jumlahKkSah = dataDemografiReal.length;
  const jumlahJiwa = hitungJiwa(dataDemografiReal);
  const rekapDemografiPublik = rekapDemografi(dataDemografiReal);

  const rumahDiperiksa = Number(jumantik?.jumlah_rumah_diperiksa || 0);
  const persenJumantik = rumahDiperiksa <= 0 ? 0 : Math.min(100, (rumahDiperiksa / TARGET_JUMANTIK) * 100);
  const jumantikAman = Boolean(jumantik) && !jumantik?.ditemukan_jentik && !jumantik?.warga_terjangkit_dbd;

  const totalKgSampah = sampahGlobal.reduce((sum: number, t: { berat_kg?: number | null }) => sum + Number(t.berat_kg || 0), 0);

  const totalKurban = dataKurban.reduce((sum, t) => {
    if (setoranKurban(t.jenis_transaksi)) return sum + Number(t.nominal || 0);
    if (tarikanKurban(t.jenis_transaksi)) return sum - Number(t.nominal || 0);
    return sum;
  }, 0);
  const pesertaKurban = new Set(dataKurban.filter((t) => setoranKurban(t.jenis_transaksi) && t.warga_id).map((t) => t.warga_id)).size;

  const balitaBulanIni = dataBalita.filter((b) => dalamBulanIni(b.tanggal_kunjungan)).length;
  const lansiaBulanIni = dataLansia.filter((l) => dalamBulanIni(l.tanggal_kunjungan)).length;
  const imunisasiTercatat = dataBalita.filter((b) => Boolean(b.imunisasi && b.imunisasi.trim())).length;

  const namaWilayah = [masterRt?.kelurahan ? `Kel. ${masterRt.kelurahan}` : null, masterRt?.nama_rw, masterRt?.nama_rt || "RT 07"]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-screen bg-[#F6F1E8] text-slate-800 font-sans">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0F241C]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative h-12 w-12 shrink-0">
              <span
                aria-hidden
                className="absolute -inset-[3px] rounded-full bg-gradient-to-br from-[#F3D27A] via-[#C4A35A] to-[#7a5a24]"
              />
              <div className="relative h-full w-full overflow-hidden rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.4)] ring-1 ring-black/25">
                <Image
                  src="/identitas/logo-pengurus-rt07.png"
                  alt="Lambang Pengurus RT 07/09"
                  width={96}
                  height={96}
                  priority
                  className="h-full w-full scale-[1.08] object-cover object-center contrast-[1.08] saturate-[1.15]"
                />
              </div>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-[#E8C56A]">Portal Warga</p>
              <p className="truncate text-sm font-semibold text-white">{namaWilayah}</p>
            </div>
          </div>
          <nav className="hidden lg:flex items-center gap-5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-100/80">
            <a href="#demografi" className="hover:text-white">Demografi</a>
            <a href="#lingkungan" className="hover:text-white">Lingkungan</a>
            <a href="#kesehatan" className="hover:text-white">Kesehatan</a>
            <a href="#kas" className="hover:text-white">Kas</a>
            <a href="#pengumuman" className="hover:text-white">Pengumuman</a>
            <a href="#galeri" className="hover:text-white">Galeri</a>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <a href="#darurat" className="hidden sm:inline-flex items-center rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-rose-500">Panic</a>
            <Link href="/login" className="inline-flex items-center rounded-lg bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#0F241C] hover:bg-[#E8C56A]">Masuk</Link>
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-[#0F241C] px-4 pb-24 pt-14 md:px-6 md:pt-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-600/25 blur-3xl" />
          <div className="absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-[#C4A35A]/15 blur-3xl" />
          <div className="absolute right-[12%] top-[20%] h-56 w-56 rounded-full bg-[#E8C56A]/20 blur-3xl" />

          <div className="absolute -right-[22%] top-1/2 h-[min(46rem,140vw)] w-[min(46rem,140vw)] -translate-y-[48%] sm:-right-[10%] md:right-[-4%] lg:right-[-6%] lg:scale-125">
            <div
              className="relative h-full w-full scale-[1.12] contrast-[1.25] saturate-[1.5] brightness-[1.3] blur-[0.45px] max-lg:opacity-80 lg:blur-3xl lg:opacity-50
                [mask-image:radial-gradient(circle_at_center,black_32%,rgba(0,0,0,0.5)_54%,transparent_76%)]
                [-webkit-mask-image:radial-gradient(circle_at_center,black_32%,rgba(0,0,0,0.5)_54%,transparent_76%)]"
            >
              <Image
                src="/identitas/latar-identitas-rt07.png"
                alt=""
                fill
                sizes="(max-width: 768px) 90vw, 736px"
                quality={70}
                priority
                className="object-contain mix-blend-multiply"
              />
            </div>
          </div>

          <div className="absolute inset-0 bg-gradient-to-r from-[#0F241C] from-[0%] via-[#0F241C]/92 via-[42%] to-[#0F241C]/40 max-md:via-[#0F241C]/95 max-md:to-[#0F241C]/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F241C] from-[0%] via-transparent via-[48%] to-[#0F241C]/60" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0F241C] to-transparent" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#E8C56A]">Buku induk terbuka · ditarik langsung dari database</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-white md:text-6xl md:leading-[1.05]">
              Yang tertib terlihat dari angkanya.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-emerald-100/80 md:text-base">
              Halaman ini tidak menjual janji. Ia menampilkan KK yang sudah disahkan, rumah yang diperiksa Jumantik, sampah yang dialihkan dari TPA, kas yang tercatat, dan jalur darurat yang bisa dihubungi sekarang.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="inline-flex items-center rounded-xl bg-[#C4A35A] px-5 py-3 text-xs font-black uppercase tracking-wider text-[#0F241C] hover:bg-[#d4b56c]">
                Masuk Portal Warga
              </Link>
              <Link href="/admin" className="inline-flex items-center rounded-xl border border-white/20 px-5 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10">
                Dasbor Pengurus
              </Link>
            </div>
          </div>

          <div className="relative mx-auto hidden h-[18.5rem] w-[18.5rem] lg:block xl:h-[20.5rem] xl:w-[20.5rem]">
            <div aria-hidden className="absolute -inset-8 rounded-full bg-[#E8C56A]/20 blur-3xl" />
            <div className="relative h-full w-full rounded-full bg-gradient-to-br from-[#F6DE9A] via-[#C4A35A] to-[#6f521c] p-[3px] shadow-[0_24px_55px_rgba(0,0,0,0.5)]">
              <div className="h-full w-full overflow-hidden rounded-full bg-[#0F241C] p-[3px]">
                <div className="relative h-full w-full overflow-hidden rounded-full">
                  <Image
                    src="/identitas/latar-identitas-rt07.png"
                    alt="Identitas RT 07 RW 09 Kelurahan Tengah"
                    fill
                    sizes="328px"
                    quality={80}
                    priority
                    className="scale-[1.07] object-cover object-center contrast-[1.07] saturate-[1.12]"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/15 via-transparent to-[#0F241C]/20 mix-blend-soft-light" />
                  <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/35" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-14 w-full max-w-6xl space-y-8 px-4 pb-24 md:px-6">
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KartuBukti label="Warga sah" nilai={`${jumlahJiwa}`} satuan="jiwa" catatan={`${jumlahKkSah} KK terverifikasi`} aksen="text-emerald-800" />
          <KartuBukti label="Rumah diperiksa" nilai={`${rumahDiperiksa}`} satuan={`/ ${TARGET_JUMANTIK}`} catatan={jumantikAman ? "Pemeriksaan terakhir: bebas jentik" : jumantik ? "Ada temuan pada pemeriksaan terakhir" : "Belum ada laporan Jumantik"} aksen="text-teal-800" />
          <KartuBukti label="Dialihkan dari TPA" nilai={totalKgSampah.toFixed(1)} satuan="kg" catatan="Setoran bank sampah tercatat" aksen="text-lime-800" />
          <KartuBukti label="Saldo kas RT" nilai={formatRp(saldoAkhir)} satuan="" catatan={`${kasData.length} mutasi terbuka`} aksen="text-amber-800" />
        </section>

        <section id="demografi" className="scroll-mt-24 rounded-3xl border border-[#e4dccb] bg-white p-6 shadow-sm md:p-8">
          <KopBagian
            kicker="Tertib"
            judul="Demografi warga sah"
            deskripsi="Hanya KK berstatus Disetujui yang masuk peta ini. Arsip pemilu dan pendaftar menunggu tidak dihitung."
          />
          <DemografiClient rekap={rekapDemografiPublik} />
        </section>

        <section id="lingkungan" className="scroll-mt-24 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <KinerjaSampahClient dataSampah={sampahGlobal} />
          </div>
          <article className="lg:col-span-2 rounded-2xl border border-[#e4dccb] bg-white p-6 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Bersih · Jumantik</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-slate-900">Kesehatan lingkungan</h2>
            <p className="mt-1 text-[12px] text-slate-500">Target mutlak RT 07: {TARGET_JUMANTIK} rumah diperiksa.</p>

            <div className="mt-6 flex items-end justify-between gap-3">
              <div>
                <p className="text-4xl font-black tabular-nums text-slate-900">{rumahDiperiksa}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">rumah pada laporan terakhir</p>
              </div>
              <p className="text-2xl font-black tabular-nums text-emerald-700">{persenJumantik.toFixed(0)}%</p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${persenJumantik >= 100 ? "bg-emerald-600" : persenJumantik >= 50 ? "bg-amber-500" : "bg-rose-400"}`} style={{ width: `${persenJumantik}%` }} />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <LencanaStatus
                ok={jumantik ? !jumantik.ditemukan_jentik : null}
                ya="Bebas jentik"
                tidak="Jentik ditemukan"
                kosong="Belum diperiksa"
              />
              <LencanaStatus
                ok={jumantik ? !jumantik.warga_terjangkit_dbd : null}
                ya="Tanpa DBD"
                tidak="Ada warga terjangkit"
                kosong="Belum dilaporkan"
              />
            </div>
            <p className="mt-4 text-[11px] text-slate-400">Dicatat {formatTanggal(jumantik?.created_at)}</p>
          </article>
        </section>

        <section id="kesehatan" className="scroll-mt-24 rounded-3xl border border-[#e4dccb] bg-white p-6 shadow-sm md:p-8">
          <KopBagian
            kicker="Guyub"
            judul="Kesehatan warga"
            deskripsi="Rekap Posyandu tanpa nama individu. Yang tampil hanya volume kunjungan dan cakupan imunisasi."
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KartuKesehatan ikon="👶" judul="Posyandu Balita" nilai={String(dataBalita.length)} keterangan="total kunjungan tercatat" />
            <KartuKesehatan ikon="📅" judul="Balita bulan ini" nilai={String(balitaBulanIni)} keterangan="hadir pada bulan berjalan" />
            <KartuKesehatan ikon="💉" judul="Imunisasi tercatat" nilai={String(imunisasiTercatat)} keterangan="dari seluruh kunjungan balita" />
            <KartuKesehatan ikon="🧓" judul="Posyandu Lansia" nilai={`${lansiaBulanIni}`} keterangan={`${dataLansia.length} kunjungan sepanjang waktu`} />
          </div>
        </section>

        <section id="kas" className="scroll-mt-24 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <article className="lg:col-span-3 rounded-3xl border border-[#e4dccb] bg-white p-6 shadow-sm md:p-8">
            <KopBagian kicker="Terbuka" judul="Transparansi kas & pengeluaran" deskripsi="Setiap rupiah yang masuk dan keluar dari kas RT ditampilkan apa adanya." />
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Pemasukan</p>
                <p className="mt-1 text-sm font-black tabular-nums text-emerald-900 md:text-lg">{formatRp(pemasukan)}</p>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Pengeluaran</p>
                <p className="mt-1 text-sm font-black tabular-nums text-rose-900 md:text-lg">{formatRp(pengeluaran)}</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Saldo</p>
                <p className="mt-1 text-sm font-black tabular-nums text-amber-950 md:text-lg">{formatRp(saldoAkhir)}</p>
              </div>
            </div>
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Pengeluaran terbaru</p>
              {mutasiPengeluaran.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#e4dccb] bg-[#fbf8f1] px-4 py-6 text-center text-[12px] text-slate-500">
                  Belum ada pengeluaran tercatat. Saldo di atas adalah sisa seluruh mutasi yang ada.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {mutasiPengeluaran.map((m, i) => (
                    <li key={`${m.created_at}-${i}`} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{m.kategori || "Pengeluaran"}</p>
                        <p className="truncate text-[11px] text-slate-500">{m.keterangan || formatTanggal(m.tanggal_transaksi || m.created_at)}</p>
                      </div>
                      <p className="shrink-0 text-sm font-black tabular-nums text-rose-700">− {formatRp(m.nominal)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>

          <article className="lg:col-span-2 rounded-3xl border border-[#e4dccb] bg-[#3b0d18] p-6 text-white shadow-sm md:p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-200">Dana Kurban</p>
            <h2 className="mt-1 text-lg font-black tracking-tight">Tabungan bersama Idul Adha</h2>
            <p className="mt-6 text-3xl font-black tabular-nums md:text-4xl">{formatRp(totalKurban)}</p>
            <p className="mt-2 text-[12px] text-rose-100/80">{pesertaKurban} warga sudah menyetor · dikelola terpisah dari kas RT</p>
            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[12px] leading-relaxed text-rose-50/90">
              Saldo ini hasil setoran dikurangi tarikan. Nama shohibul tidak ditampilkan di halaman publik.
            </div>
          </article>
        </section>

        <section id="pengumuman" className="scroll-mt-24 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PengumumanClient pengumumanReguler={pengumumanReguler || []} rekapVoting={rekapVoting} />

          <article id="dokumen" className="scroll-mt-24 rounded-2xl border border-[#e4dccb] bg-white p-6 shadow-sm">
            <KopBagian kicker="Berkas" judul="Unduh dokumen warga" deskripsi="Blanko, peraturan, dan arsip yang memang untuk diedarkan. Bukan KTP atau KK pribadi." />
            {daftarDokumen.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#e4dccb] bg-[#fbf8f1] px-4 py-10 text-center text-[12px] text-slate-500">
                Belum ada dokumen publik yang diunggah pengurus.
              </div>
            ) : (
              <ul className="space-y-2">
                {daftarDokumen.map((dok) => (
                  <li key={dok.id}>
                    <a
                      href={dok.url_berkas}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{dok.judul}</p>
                        <p className="text-[11px] text-slate-500">
                          {dok.kategori || "Dokumen"} {dok.tanggal_terbit ? `· ${formatTanggal(dok.tanggal_terbit)}` : ""} {dok.ukuran_berkas ? `· ${dok.ukuran_berkas}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-emerald-700">Unduh</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section id="galeri" className="scroll-mt-24 rounded-3xl border border-[#e4dccb] bg-white p-6 shadow-sm md:p-8">
          <KopBagian kicker="Guyub" judul="Galeri kegiatan" deskripsi="Foto kerja bakti, posyandu, dan hajatan — bukan kamera pengawas." />
          <GaleriKegiatanClient daftarFoto={daftarFoto} />
        </section>

        <section id="darurat" className="scroll-mt-24 overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-rose-100 bg-rose-50 px-6 py-5 md:flex-row md:items-end md:justify-between md:px-8">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-700">Aman</p>
              <h2 className="text-lg font-black tracking-tight text-slate-900">Panic Button</h2>
              <p className="mt-1 text-[12px] text-slate-500">Satu ketukan ke nomor yang memang dijaga 24 jam. Tidak ada tautan CCTV di halaman ini.</p>
            </div>
          </div>
          <div className="p-6 md:p-8">
            <PanicButtonClient daftarKontak={daftarKontak} />
          </div>
        </section>
      </div>

      <footer className="border-t border-[#e4dccb] bg-[#0F241C] px-4 py-10 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#E8C56A]">Sistem Kependudukan RT 07</p>
        <p className="mt-2 text-[12px] text-emerald-100/70">Data disegarkan paling lambat setiap 60 detik dari Buku Induk yang sah.</p>
      </footer>
    </div>
  );
}

function KopBagian({ kicker, judul, deskripsi }: { kicker: string; judul: string; deskripsi: string }) {
  return (
    <div className="mb-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">{kicker}</p>
      <h2 className="mt-1 text-lg font-black tracking-tight text-slate-900 md:text-xl">{judul}</h2>
      <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-slate-500">{deskripsi}</p>
    </div>
  );
}

function KartuBukti({
  label,
  nilai,
  satuan,
  catatan,
  aksen,
}: {
  label: string;
  nilai: string;
  satuan: string;
  catatan: string;
  aksen: string;
}) {
  return (
    <article className="rounded-2xl border border-[#e4dccb] bg-white p-4 shadow-sm md:p-5" suppressHydrationWarning>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-black tabular-nums tracking-tight text-slate-900 md:text-2xl">
        <span className={aksen}>{nilai}</span>
        {satuan ? <span className="text-sm font-semibold text-slate-400"> {satuan}</span> : null}
      </p>
      <p className="mt-1 text-[11px] text-slate-500">{catatan}</p>
    </article>
  );
}

function KartuKesehatan({ ikon, judul, nilai, keterangan }: { ikon: string; judul: string; nilai: string; keterangan: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-[#fbf8f1] p-4">
      <p className="text-lg">{ikon}</p>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{judul}</p>
      <p className="mt-1 text-2xl font-black tabular-nums text-slate-900">{nilai}</p>
      <p className="mt-1 text-[11px] text-slate-500">{keterangan}</p>
    </article>
  );
}

function LencanaStatus({ ok, ya, tidak, kosong }: { ok: boolean | null; ya: string; tidak: string; kosong: string }) {
  if (ok === null) {
    return <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-[11px] font-bold text-slate-500">{kosong}</span>;
  }
  if (ok) {
    return <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-[11px] font-bold text-emerald-800">{ya}</span>;
  }
  return <span className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-[11px] font-bold text-rose-800">{tidak}</span>;
}
