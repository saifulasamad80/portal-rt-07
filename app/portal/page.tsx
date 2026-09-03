import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import TombolNotifikasiPush from "@/components/TombolNotifikasiPush";
import KartuLayanan from "@/components/portal/KartuLayanan";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

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
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;

  if (!token) redirect("/login");

  let wargaAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    wargaAktif = payload;
  } catch {
    redirect("/login");
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const currDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const currentMonth = currDate.getMonth() + 1;
  const currentDay = currDate.getDate();
  const todayStr = `${currDate.getFullYear()}-${String(currentMonth).padStart(2, "0")}-${String(currentDay).padStart(2, "0")}`;

  const threeDaysAgo = new Date(currDate);
  threeDaysAgo.setDate(currDate.getDate() - 3);
  const threeDaysAgoStr = `${threeDaysAgo.getFullYear()}-${String(threeDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(threeDaysAgo.getDate()).padStart(2, "0")}`;

  const { data: profilWarga } = await supabaseAdmin
    .from("warga")
    .select("*, anggota_keluarga(*)")
    .eq("id", wargaAktif.id)
    .single();

  if (profilWarga?.status_aktif === false) {
    redirect("/api/warga/logout");
  }

  const [{ data: statusCarik }, { data: jadwalRonda }, { data: pengumumanBaru }, { data: iuranTerakhir }] = await Promise.all([
    supabaseAdmin.from("sensus_kesejahteraan").select("id").eq("warga_id", wargaAktif.id).maybeSingle(),
    supabaseAdmin.from("jadwal_ronda").select("*").eq("warga_id", wargaAktif.id).gte("tanggal_tugas", todayStr).order("tanggal_tugas", { ascending: true }).limit(1).maybeSingle(),
    supabaseAdmin.from("pengumuman_rt").select("id, judul, tanggal_publikasi").gte("tanggal_publikasi", threeDaysAgoStr).order("tanggal_publikasi", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("kas_rt").select("created_at, nominal, tipe_transaksi").eq("warga_id", wargaAktif.id).eq("tipe_transaksi", "Pemasukan").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const isDataTervalidasiWarga = !!statusCarik;

  const birthdayNames: string[] = [];
  if (profilWarga?.tanggal_lahir) {
    const bdate = new Date(profilWarga.tanggal_lahir);
    if (bdate.getMonth() + 1 === currentMonth && bdate.getDate() === currentDay) {
      birthdayNames.push(`Anda (${profilWarga.nama_lengkap})`);
    }
  }
  if (profilWarga?.anggota_keluarga) {
    profilWarga.anggota_keluarga.forEach((ak: any) => {
      if (ak.tanggal_lahir) {
        const bdate = new Date(ak.tanggal_lahir);
        if (bdate.getMonth() + 1 === currentMonth && bdate.getDate() === currentDay) {
          birthdayNames.push(ak.nama_lengkap);
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
    <div className="min-h-screen bg-[#eef2f6] pb-20 font-sans text-slate-800">
      <header className="bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-7 md:py-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-500 flex items-center justify-center text-2xl font-black text-white shrink-0 shadow-inner">
              {inisial}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300 mb-1">Portal Warga · Wargaku</p>
              <h1 className="text-2xl font-bold text-white leading-tight">Halo, {namaTampil}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-200 bg-white/10 px-2.5 py-1 rounded-md">
                  NIK {wargaAktif.nik}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200 bg-emerald-500/15 px-2.5 py-1 rounded-md">
                  {profilWarga?.status_tinggal || "Warga aktif"}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-200 bg-white/10 px-2.5 py-1 rounded-md">
                  {jumlahJiwa} jiwa dalam KK
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <TombolNotifikasiPush />
            <form action={handleLogout}>
              <button type="submit" className="w-full bg-white/10 hover:bg-rose-600 text-white text-xs font-semibold py-2.5 px-5 rounded-lg border border-white/10 transition-colors">
                Keluar
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-6 -mt-5 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">Siskamling</p>
            <p className="text-sm font-semibold text-slate-900 leading-snug">
              {jadwalRonda ? formatTanggalId(jadwalRonda.tanggal_tugas) : "Tidak ada jadwal terdekat"}
            </p>
            <p className="text-xs text-slate-500 mt-1">{jadwalRonda?.status || "Anda sedang tidak bertugas"}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">Iuran RT</p>
            <p className={`text-sm font-semibold leading-snug ${aksenIuran}`}>{statusIuran}</p>
            <Link href="/portal/keuangan" className="text-xs text-blue-700 font-semibold mt-2 inline-block hover:underline">
              Lihat transparansi kas
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">Pengumuman</p>
            <p className="text-sm font-semibold text-slate-900 leading-snug truncate">
              {pengumumanBaru?.judul || "Tidak ada siaran baru"}
            </p>
            <Link href="/" className="text-xs text-blue-700 font-semibold mt-2 inline-block hover:underline">
              Buka mading RT
            </Link>
          </div>
        </section>

        <section className="space-y-3">
          {birthdayNames.length > 0 && (
            <div className="bg-white border border-rose-100 rounded-2xl p-5 flex gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-2xl shrink-0">🎉</div>
              <div>
                <h3 className="font-bold text-rose-800 text-sm mb-1">Selamat ulang tahun</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Pengurus RT 07 mengucapkan selamat bertambah usia untuk <strong>{birthdayNames.join(", ")}</strong>. Semoga sehat dan berkah.
                </p>
              </div>
            </div>
          )}

          {jadwalRonda && (
            <div className={`rounded-2xl p-5 border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${jadwalRonda.tanggal_tugas === todayStr ? "bg-rose-50 border-rose-200" : "bg-white border-amber-200"}`}>
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-2xl shrink-0">🔦</div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 mb-1">
                    {jadwalRonda.tanggal_tugas === todayStr ? "Tugas siskamling malam ini" : "Jadwal siskamling Anda"}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {formatTanggalId(jadwalRonda.tanggal_tugas)}
                    {" · "}
                    {jadwalRonda.status || "Menunggu konfirmasi"}
                  </p>
                </div>
              </div>
              <Link href="/portal/ronda" className="text-center text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                Konfirmasi
              </Link>
            </div>
          )}

          {pengumumanBaru && (
            <div className="bg-white border border-blue-100 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="flex gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl shrink-0">📢</div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-slate-900 mb-1">Pengumuman pengurus</h3>
                  <p className="text-sm text-slate-600 truncate">{pengumumanBaru.judul}</p>
                </div>
              </div>
              <Link href="/" className="text-center text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-xl border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">
                Baca
              </Link>
            </div>
          )}

          {!isDataTervalidasiWarga && (
            <div className="bg-white border border-amber-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div>
                <h3 className="font-bold text-sm text-amber-900 mb-1">Verifikasi data Carik masih diperlukan</h3>
                <p className="text-sm text-slate-600">Mohon periksa kesesuaian data keluarga dengan catatan kelurahan.</p>
              </div>
              <Link href="/portal/sensus" className="text-center text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-xl bg-amber-500 text-white hover:bg-amber-600">
                Periksa data
              </Link>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Layanan administrasi</h2>
            <p className="text-[11px] text-slate-400 hidden md:block">Urusan surat, kas, suara, dan aset RT</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KartuLayanan href="/portal/surat" ikon="📄" judul="Layanan surat" deskripsi="Pengantar mandiri" />
            <KartuLayanan href="/portal/keuangan" ikon="💰" judul="Transparansi kas" deskripsi="Tagihan & riwayat iuran" />
            <KartuLayanan href="/portal/voting" ikon="📊" judul="E-voting" deskripsi="Suara digital warga" />
            <KartuLayanan href="/portal/inventaris" ikon="🎪" judul="Inventaris RT" deskripsi="Pinjam tenda & kursi" />
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Ekonomi, lingkungan, dan keluarga</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KartuLayanan href="/portal/lapak" ikon="🏪" judul="Pasar warga" deskripsi="UMKM & jasa tetangga" />
            <KartuLayanan href="/portal/sampah" ikon="♻️" judul="Tabungan sampah" deskripsi="Saldo setor anorganik" />
            <KartuLayanan href="/portal/kurban" ikon="🐄" judul="Tabungan kurban" deskripsi="Persiapan Idul Adha" />
            {/* Atribut warna pink dicabut */}
            <KartuLayanan href="/portal/ibu-ibu" ikon="🌸" judul="Modul Ibu-ibu" deskripsi="Posyandu & arisan" />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 mb-3">Keamanan lingkungan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Atribut warna gelap dicabut */}
            <KartuLayanan href="/portal/ronda" ikon="🔦" judul="Siskamling" deskripsi="Jadwal ronda dan konfirmasi kehadiran" />
            {FITUR_LAPOR_AKTIF && (
              <KartuLayanan href="/portal/lapor" ikon="🚨" judul="Lapor warga" deskripsi="Tiket kerusakan fasilitas" />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}