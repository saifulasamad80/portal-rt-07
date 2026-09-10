import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import TombolNotifikasiPush from "@/components/TombolNotifikasiPush";
import KartuLayanan from "@/components/portal/KartuLayanan";
import { adalahCapCarikDisetujui, adalahCapCarikMenunggu } from "@/lib/kebijakan-sensus";
import { otentikasiWargaAktif } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";

const FITUR_LAPOR_AKTIF = false;

function formatTanggalId(nilai: string) {
  return new Date(nilai).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PortalWarga() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");
  const wargaAktif = otentikasi.sesi;

  const supabaseAdmin = await buatKlienTerautentikasi(wargaAktif);

  const currDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const currentMonth = currDate.getMonth() + 1;
  const currentDay = currDate.getDate();
  const todayStr = `${currDate.getFullYear()}-${String(currentMonth).padStart(2, "0")}-${String(currentDay).padStart(2, "0")}`;

  const threeDaysAgo = new Date(currDate);
  threeDaysAgo.setDate(currDate.getDate() - 3);
  const threeDaysAgoStr = `${threeDaysAgo.getFullYear()}-${String(threeDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(threeDaysAgo.getDate()).padStart(2, "0")}`;

  const { data: profilWarga } = await supabaseAdmin
    .from("warga")
    .select("id, nik, nama_lengkap, status_tinggal, tanggal_lahir, anggota_keluarga(id, nama_lengkap, tanggal_lahir)")
    .eq("id", wargaAktif.id)
    .eq("nik", wargaAktif.nik)
    .eq("rt_id", wargaAktif.rtId)
    .single();

  const [{ data: statusCarik }, { data: jadwalRonda }, { data: pengumumanBaru }, { data: iuranTerakhir }] = await Promise.all([
    supabaseAdmin.from("sensus_kesejahteraan").select("id, status_validasi").eq("warga_id", wargaAktif.id).eq("rt_id", wargaAktif.rtId).maybeSingle(),
    supabaseAdmin.from("jadwal_ronda").select("id, tanggal_tugas, status").eq("warga_id", wargaAktif.id).eq("rt_id", wargaAktif.rtId).gte("tanggal_tugas", todayStr).order("tanggal_tugas", { ascending: true }).limit(1).maybeSingle(),
    supabaseAdmin.from("pengumuman_rt").select("id, judul, tanggal_publikasi").eq("rt_id", wargaAktif.rtId).gte("tanggal_publikasi", threeDaysAgoStr).order("tanggal_publikasi", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("kas_rt").select("created_at, nominal, tipe_transaksi").eq("warga_id", wargaAktif.id).eq("tipe_transaksi", "Pemasukan").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const capDisetujui = adalahCapCarikDisetujui(statusCarik?.status_validasi);
  const capMenunggu = adalahCapCarikMenunggu(statusCarik?.status_validasi);
  const layananTerkunci = !capDisetujui;

  const birthdayNames: string[] = [];
  if (profilWarga?.tanggal_lahir) {
    const bdate = new Date(profilWarga.tanggal_lahir);
    if (bdate.getMonth() + 1 === currentMonth && bdate.getDate() === currentDay) {
      birthdayNames.push(`Anda (${profilWarga.nama_lengkap})`);
    }
  }
  if (profilWarga?.anggota_keluarga) {
    profilWarga.anggota_keluarga.forEach((ak: { nama_lengkap: string | null; tanggal_lahir: string | null }) => {
      if (ak.tanggal_lahir) {
        const bdate = new Date(ak.tanggal_lahir);
        if (bdate.getMonth() + 1 === currentMonth && bdate.getDate() === currentDay) {
          birthdayNames.push(ak.nama_lengkap || "Anggota keluarga");
        }
      }
    });
  }

  const handleLogout = async () => {
    "use server";
    const store = await cookies();
    store.delete("warga_session");
    redirect("/");
  };

  const namaTampil = profilWarga?.nama_lengkap || wargaAktif.nama;
  const inisial = String(namaTampil || "W").charAt(0).toUpperCase();
  const jumlahJiwa = 1 + (profilWarga?.anggota_keluarga?.length || 0);

  let statusIuran = "Belum ada catatan iuran";
  let aksenIuran = "text-slate-600";
  if (iuranTerakhir?.created_at) {
    const lastDate = new Date(iuranTerakhir.created_at);
    const diffMonths = (currDate.getFullYear() - lastDate.getFullYear()) * 12 + (currDate.getMonth() - lastDate.getMonth());
    if (diffMonths <= 0) {
      statusIuran = "Iuran bulan ini tercatat lunas";
      aksenIuran = "text-emerald-700";
    } else if (diffMonths >= 3) {
      statusIuran = `Tunggakan ${diffMonths} bulan`;
      aksenIuran = "text-rose-700";
    } else {
      statusIuran = `Menunggak ${diffMonths} bulan`;
      aksenIuran = "text-amber-700";
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-800">
      <header className="bg-slate-900 relative rounded-b-3xl shadow-xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500"></div>
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-8 pb-14 flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-2xl font-bold text-white shrink-0 ring-1 ring-white/15 shadow-lg">
              {inisial}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300 mb-1">Portal Warga · Wargaku</p>
              <h1 className="text-xl md:text-2xl font-bold text-white leading-tight truncate">Halo, {namaTampil}</h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-[10px] font-semibold text-slate-300 bg-white/5 border border-white/10 px-2 py-1 rounded-md tabular-nums">
                  NIK {wargaAktif.nik}
                </span>
                <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 px-2 py-1 rounded-md">
                  {profilWarga?.status_tinggal || "Warga aktif"}
                </span>
                <span className="text-[10px] font-semibold text-slate-300 bg-white/5 border border-white/10 px-2 py-1 rounded-md">
                  {jumlahJiwa} jiwa dalam KK
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-row items-start gap-2 shrink-0">
            <TombolNotifikasiPush />
            <form action={handleLogout}>
              <button type="submit" className="bg-white/5 hover:bg-rose-600 hover:border-rose-500 text-slate-200 hover:text-white text-xs font-semibold py-2.5 px-4 rounded-lg border border-white/10 transition-colors">
                Keluar
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-6 -mt-9 relative z-10 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Siskamling</p>
              <span className="w-6 h-6 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-xs shrink-0">🔦</span>
            </div>
            <p className="text-sm font-semibold text-slate-900 leading-snug">
              {jadwalRonda ? formatTanggalId(jadwalRonda.tanggal_tugas) : "Tidak ada jadwal terdekat"}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">{jadwalRonda?.status || "Anda sedang tidak bertugas"}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Iuran RT</p>
              <span className="w-6 h-6 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-xs shrink-0">💰</span>
            </div>
            <p className={`text-sm font-semibold leading-snug ${aksenIuran}`}>{statusIuran}</p>
            {layananTerkunci ? (
              <p className="text-[11px] text-slate-400 font-semibold mt-1.5">Transparansi kas terkunci</p>
            ) : (
              <Link href="/portal/keuangan" className="text-[11px] text-blue-700 font-semibold mt-1.5 inline-block hover:underline">
                Lihat transparansi kas →
              </Link>
            )}
          </div>
        </section>

        <section className="space-y-3">
          {birthdayNames.length > 0 && (
            <div className="bg-white border border-rose-100 rounded-2xl p-4 flex gap-3.5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-xl shrink-0">🎉</div>
              <div>
                <h3 className="font-bold text-rose-800 text-[13px] mb-0.5">Selamat ulang tahun</h3>
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  Pengurus RT 07 mengucapkan selamat bertambah usia untuk <strong>{birthdayNames.join(", ")}</strong>. Semoga sehat dan berkah.
                </p>
              </div>
            </div>
          )}

          {jadwalRonda && (
            <div className={`rounded-2xl p-4 border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 ${jadwalRonda.tanggal_tugas === todayStr ? "bg-rose-50 border-rose-200" : "bg-white border-amber-200"}`}>
              <div className="flex gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200/70 flex items-center justify-center text-xl shrink-0">🔦</div>
                <div className="min-w-0">
                  <h3 className="font-bold text-[13px] text-slate-900 mb-0.5">
                    {jadwalRonda.tanggal_tugas === todayStr ? "Tugas siskamling malam ini" : "Jadwal siskamling Anda"}
                  </h3>
                  <p className="text-[13px] text-slate-600 leading-relaxed">
                    {formatTanggalId(jadwalRonda.tanggal_tugas)}
                    {" · "}
                    {jadwalRonda.status || "Menunggu konfirmasi"}
                  </p>
                </div>
              </div>
              {layananTerkunci ? (
                <span className="shrink-0 text-center text-[11px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg bg-slate-200 text-slate-500">
                  Terkunci
                </span>
              ) : (
                <Link href="/portal/ronda" className="shrink-0 text-center text-[11px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors">
                  Konfirmasi
                </Link>
              )}
            </div>
          )}

          {pengumumanBaru && (
            <div className="bg-white border border-blue-100 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
              <div className="flex gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-xl shrink-0">📢</div>
                <div className="min-w-0">
                  <h3 className="font-bold text-[13px] text-slate-900 mb-0.5">Pengumuman pengurus</h3>
                  <p className="text-[13px] text-slate-600 truncate">{pengumumanBaru.judul}</p>
                </div>
              </div>
              <Link href="/#pengumuman" className="shrink-0 text-center text-[11px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
                Baca di mading
              </Link>
            </div>
          )}

          {capDisetujui ? (
            <div className="bg-white border border-emerald-100 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
              <div className="flex gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-xl shrink-0">📋</div>
                <div className="min-w-0">
                  <h3 className="font-bold text-[13px] text-emerald-900 mb-0.5">Data carik keluarga sudah diverifikasi</h3>
                  <p className="text-[13px] text-slate-600 leading-relaxed">NIK terkunci. Anda dapat melihat KK tercatat; perubahan diajukan ke pengurus RT.</p>
                </div>
              </div>
              <Link href="/portal/keluarga" className="shrink-0 text-center text-[11px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg border border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                Lihat data
              </Link>
            </div>
          ) : capMenunggu ? (
            <div className="bg-white border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
              <div className="flex gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-xl shrink-0">📋</div>
                <div className="min-w-0">
                  <h3 className="font-bold text-[13px] text-amber-900 mb-0.5">Revisi data keluarga belum lengkap</h3>
                  <p className="text-[13px] text-slate-600">Pengurus mengizinkan koreksi. Layanan portal terbuka kembali setelah form Carik disimpan. NIK tetap terkunci.</p>
                </div>
              </div>
              <Link href="/portal/sensus" className="shrink-0 text-center text-[11px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                Lanjutkan revisi
              </Link>
            </div>
          ) : (
            <div className="bg-white border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
              <div className="flex gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-xl shrink-0">📋</div>
                <div className="min-w-0">
                  <h3 className="font-bold text-[13px] text-amber-900 mb-0.5">Verifikasi data Carik masih diperlukan</h3>
                  <p className="text-[13px] text-slate-600">Periksa data keluarga warisan, termasuk istri/anak yang sempat tercatat sebagai KK terpisah.</p>
                </div>
              </div>
              <Link href="/portal/sensus" className="shrink-0 text-center text-[11px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                Periksa data
              </Link>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-blue-500 shrink-0"></span> Layanan administrasi
            </h2>
            <p className="text-[11px] text-slate-400 hidden md:block">Urusan surat, kas, suara, dan aset RT</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KartuLayanan href="/portal/keluarga" ikon="👪" judul="Data keluarga" deskripsi="KK yang tercatat" terkunci={layananTerkunci} />
            <KartuLayanan href="/portal/surat" ikon="📄" judul="Layanan surat" deskripsi="Pengantar mandiri" terkunci={layananTerkunci} />
            <KartuLayanan href="/portal/keuangan" ikon="💰" judul="Transparansi kas" deskripsi="Tagihan & riwayat iuran" terkunci={layananTerkunci} />
            <KartuLayanan href="/portal/voting" ikon="📊" judul="E-voting" deskripsi="Suara digital warga" terkunci={layananTerkunci} />
            <KartuLayanan href="/portal/inventaris" ikon="🎪" judul="Inventaris RT" deskripsi="Pinjam tenda & kursi" terkunci={layananTerkunci} />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-emerald-500 shrink-0"></span> Ekonomi, lingkungan, dan keluarga
            </h2>
            <p className="text-[11px] text-slate-400 hidden md:block">Sirkular ekonomi &amp; kegiatan keluarga</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KartuLayanan href="/portal/lapak" ikon="🏪" judul="Pasar warga" deskripsi="Daftar lapak & hubungi penjual" terkunci={layananTerkunci} />
            <KartuLayanan href="/portal/sampah" ikon="♻️" judul="Tabungan sampah" deskripsi="Saldo setor anorganik" terkunci={layananTerkunci} />
            <KartuLayanan href="/portal/kurban" ikon="🐄" judul="Tabungan kurban" deskripsi="Persiapan Idul Adha" terkunci={layananTerkunci} />
            <KartuLayanan href="/portal/ibu-ibu" ikon="🌸" judul="Modul Ibu-ibu" deskripsi="Posyandu & arisan" terkunci={layananTerkunci} />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-amber-500 shrink-0"></span> Keamanan lingkungan
            </h2>
            <p className="text-[11px] text-slate-400 hidden md:block">Ronda dan pelaporan fasilitas</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <KartuLayanan href="/portal/ronda" ikon="🔦" judul="Siskamling" deskripsi="Jadwal ronda dan konfirmasi kehadiran" terkunci={layananTerkunci} />
            {FITUR_LAPOR_AKTIF && (
              <KartuLayanan href="/portal/lapor" ikon="🚨" judul="Lapor warga" deskripsi="Tiket kerusakan fasilitas" terkunci={layananTerkunci} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
