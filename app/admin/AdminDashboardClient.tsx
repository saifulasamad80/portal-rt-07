"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TombolNotifikasiPush from "@/components/TombolNotifikasiPush";
import PesanDialog from "@/components/PesanDialog";

const FITUR_KTP_AKTIF = false;

type Notifikasi = { tipe: "sukses" | "gagal"; pesan: string } | null;

type PropsDasborAdmin = {
  adminAktif: any;
  wargaList: any[];
  statistik: any;
  prosesValidasi: any;
  logoutAction: any;
  modeWebmaster: boolean;
  judulDasbor: string;
};

export default function AdminDashboardClient({ adminAktif, wargaList, statistik, prosesValidasi, logoutAction, modeWebmaster, judulDasbor }: PropsDasborAdmin) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [notifikasi, setNotifikasi] = useState<Notifikasi>(null);

  const judulTampil = String(judulDasbor || "").trim() || "Pusat Komando";
  const namaAdmin = String(adminAktif?.nama || "Pengurus");
  const sampahKg = Number(statistik?.sampahKg) || 0;
  const sampahRp = Number(statistik?.sampahRp) || 0;
  const kurbanRp = Number(statistik?.kurbanRp) || 0;
  const jumlahWargaSah = Number(statistik?.warga) || 0;

  useEffect(() => {
    const BATAS_WAKTU_IDLE = 10 * 60 * 1000; 
    let waktuTerakhirAktif = Date.now();

    const perbaruiAktivitas = () => { waktuTerakhirAktif = Date.now(); };

    const cekKematianSesi = async () => {
      if (Date.now() - waktuTerakhirAktif > BATAS_WAKTU_IDLE) {
        setIsLocked(true); 
        try { await fetch('/api/admin/login', { method: 'DELETE' }); } 
        finally { window.location.href = '/admin'; }
      }
    };

    const daftarEvent = ['touchstart', 'mousemove', 'keypress', 'scroll', 'click'];
    daftarEvent.forEach(event => document.addEventListener(event, perbaruiAktivitas));
    const intervalId = setInterval(cekKematianSesi, 60000);
    const handleLayarNyala = () => { if (document.visibilityState === 'visible') cekKematianSesi(); };
    document.addEventListener('visibilitychange', handleLayarNyala);

    return () => {
      daftarEvent.forEach(event => document.removeEventListener(event, perbaruiAktivitas));
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleLayarNyala);
    };
  }, []);

  const handleValidasi = async (idWarga: string, status: string, namaWarga: string, ktpPath: string, kkPath: string) => {
    const isDokumenKosong = FITUR_KTP_AKTIF ? (ktpPath === 'MENYUSUL' || kkPath === 'MENYUSUL') : (kkPath === 'MENYUSUL');

    if (status === 'Disetujui' && isDokumenKosong) {
      const beraniTanggungJawab = confirm(`⚠️ PERINGATAN FATAL: DOKUMEN DIGITAL KOSONG!\nPendaftar atas nama ${namaWarga} BELUM mengunggah file. Berani menjamin fisik ada?`);
      if (!beraniTanggungJawab) return; 
    } else if (status !== "Menunggu" && !confirm(`Yakin menandai ${namaWarga} sebagai: ${status}?`)) { return; }

    setLoadingId(idWarga);
    setNotifikasi(null);
    try {
      // Server Action memakai Result Object Pattern: tidak pernah melempar
      // exception, jadi keberhasilan dibaca dari properti success.
      const hasil = await prosesValidasi(idWarga, status);

      if (hasil?.success) {
        setNotifikasi({ tipe: "sukses", pesan: hasil.message || `${namaWarga} berhasil divalidasi.` });
        router.refresh();
      } else {
        setNotifikasi({
          tipe: "gagal",
          pesan: hasil?.message || "Validasi gagal diproses tanpa keterangan dari server.",
        });
        // Data di layar mungkin sudah usang (mis. baris dihapus admin lain).
        router.refresh();
      }
    } catch (error: any) {
      setNotifikasi({
        tipe: "gagal",
        pesan: "Jaringan atau server tidak merespons: " + (error?.message || "kesalahan tidak diketahui"),
      });
    }
    setLoadingId("");
  };

  if (isLocked) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center text-white p-6 font-sans">
        <div className="text-7xl mb-6 animate-bounce">🔒</div>
        <h1 className="text-2xl md:text-3xl font-black text-rose-500 mb-2 uppercase tracking-widest text-center">Sistem Terkunci Otomatis</h1>
        <p className="text-slate-400 text-sm md:text-base text-center max-w-md mb-8 leading-relaxed">Sesi Anda telah dihancurkan oleh sistem karena 10 menit tanpa aktivitas.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-800">
      <header className="bg-slate-900 relative rounded-b-3xl shadow-xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-500"></div>
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-8 pb-14 flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-2xl font-bold text-white uppercase shrink-0 ring-1 ring-white/15 shadow-lg">
              {namaAdmin.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300 mb-1">Pusat Komando · Wargaku</p>
              <h1 className="text-xl md:text-2xl font-bold text-white leading-tight">{judulTampil}</h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-[10px] font-semibold text-slate-300 bg-white/5 border border-white/10 px-2 py-1 rounded-md truncate max-w-[180px]">
                  {namaAdmin}
                </span>
                <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 px-2 py-1 rounded-md">
                  {adminAktif?.role === 'webmaster' ? 'Super Admin / Webmaster' : 'Pengurus RT'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-row items-start gap-2 shrink-0">
            <TombolNotifikasiPush sasaran="pengurus" />
            <form action={logoutAction} className="shrink-0">
              <button type="submit" className="w-full md:w-auto bg-white/5 hover:bg-rose-600 hover:border-rose-500 text-slate-200 hover:text-white text-xs font-semibold py-2.5 px-4 rounded-lg border border-white/10 transition-colors active:scale-95">
                Keluar Dasbor
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-6 -mt-9 relative z-10 space-y-6">

        <PesanDialog
          pesan={
            notifikasi
              ? {
                  tipe: notifikasi.tipe,
                  teks: notifikasi.pesan,
                  judul: notifikasi.tipe === "gagal" ? "Validasi belum berhasil" : "Validasi berhasil",
                  deskripsi:
                    notifikasi.tipe === "gagal"
                      ? "Periksa keterangan di bawah dan coba ulangi setelah data atau sesi diperbaiki."
                      : "Status warga sudah diperbarui oleh sistem.",
                }
              : null
          }
          onClose={() => setNotifikasi(null)}
        />

        {modeWebmaster && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
            <p className="text-[13px] font-semibold text-amber-900 leading-relaxed">
              Mode webmaster: angka dan antrean di bawah mengikuti RT sesi, bukan agregat seluruh tenant.
            </p>
          </div>
        )}

        {/* HUD STATISTIK (Merespons coretan "Di Depan" Pak RT) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">Warga Sah</span>
              <span className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-xs shrink-0">👥</span>
            </div>
            <div className="text-lg font-bold text-slate-900 tabular-nums tracking-tight">{jumlahWargaSah} KK</div>
            <p className="text-[10px] text-slate-400 mt-1">Kepala keluarga terverifikasi</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">Sampah Berkurang</span>
              <span className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-xs shrink-0">♻️</span>
            </div>
            <div className="text-lg font-bold text-emerald-700 tabular-nums tracking-tight">{sampahKg.toFixed(1)} Kg</div>
            <p className="text-[10px] text-slate-400 mt-1">Total anorganik tersetor</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">Saldo Bank Sampah</span>
              <span className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-xs shrink-0">💸</span>
            </div>
            <div className="text-lg font-bold text-amber-600 tabular-nums tracking-tight">Rp {(sampahRp / 1000).toFixed(0)}k</div>
            <p className="text-[10px] text-slate-400 mt-1">Dana tersimpan warga</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">Dana Qurban</span>
              <span className="w-6 h-6 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-xs shrink-0">🐄</span>
            </div>
            <div className="text-lg font-bold text-rose-600 tabular-nums tracking-tight">Rp {(kurbanRp / 1000000).toFixed(1)} Jt</div>
            <p className="text-[10px] text-slate-400 mt-1">Tabungan Idul Adha</p>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-blue-500 shrink-0"></span> Kependudukan &amp; informasi
            </h2>
            <p className="text-[11px] text-slate-400 hidden md:block">Buku induk, edaran, dan kegiatan keluarga</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Link href="/admin/warga" className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 hover:border-blue-300 transition-all duration-200 block h-full">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-base mb-3 group-hover:scale-105 transition-transform duration-200">👥</div>
              <h2 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight group-hover:text-blue-700 transition-colors">Buku Induk Warga</h2>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Hanya warga yang sudah Disetujui</p>
            </Link>
            <Link href="/admin/kotak-sampah" className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 hover:border-amber-300 transition-all duration-200 block h-full">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-base mb-3 group-hover:scale-105 transition-transform duration-200">🗑️</div>
              <h2 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight group-hover:text-amber-700 transition-colors">Kotak Sampah</h2>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Pulihkan warga yang terhapus</p>
            </Link>
            <Link href="/admin/verifikasi" className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 hover:border-amber-300 transition-all duration-200 block h-full">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-base mb-3 group-hover:scale-105 transition-transform duration-200">🪪</div>
              <h2 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight group-hover:text-amber-700 transition-colors">Verifikasi Pendaftaran</h2>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Antrean status Menunggu</p>
            </Link>
            <Link href="/admin/pengumuman" className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 hover:border-blue-300 transition-all duration-200 block h-full">
              <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-base mb-3 group-hover:scale-105 transition-transform duration-200">📢</div>
              <h2 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight group-hover:text-blue-700 transition-colors">Pengumuman RT</h2>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Buat edaran ke warga</p>
            </Link>
            <Link href="/admin/ibu-ibu" className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 hover:border-blue-300 transition-all duration-200 block h-full">
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-base mb-3 group-hover:scale-105 transition-transform duration-200">🌸</div>
              <h2 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight group-hover:text-blue-700 transition-colors">Modul Ibu-ibu</h2>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Posyandu &amp; arisan</p>
            </Link>
            {adminAktif?.role === 'webmaster' ? (
              <Link href="/admin/pengurus" className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 hover:border-blue-300 transition-all duration-200 block h-full">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-base mb-3 group-hover:scale-105 transition-transform duration-200">👔</div>
                <h2 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight group-hover:text-blue-700 transition-colors">Akses Pengurus</h2>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Tambah &amp; Reset Akun</p>
              </Link>
            ) : (
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-dashed border-slate-300 cursor-not-allowed relative h-full">
                <span className="absolute top-3 right-3 bg-rose-100 text-rose-700 text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">🔒 Webmaster</span>
                <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-base mb-3 grayscale opacity-70">👔</div>
                <h2 className="font-semibold text-slate-500 text-[13px] leading-snug tracking-tight">Akses Pengurus</h2>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Akses khusus Webmaster</p>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-emerald-500 shrink-0"></span> Keuangan &amp; sirkular ekonomi
            </h2>
            <p className="text-[11px] text-slate-400 hidden md:block">Kas, bank sampah, kurban, dan aset RT</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Link href="/admin/kas" className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 hover:border-blue-300 transition-all duration-200 block h-full">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-base mb-3 group-hover:scale-105 transition-transform duration-200">💰</div>
              <h2 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight group-hover:text-blue-700 transition-colors">Kas &amp; Keuangan</h2>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Rekap iuran bulanan</p>
            </Link>
            <Link href="/admin/sampah" className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 hover:border-blue-300 transition-all duration-200 block h-full">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-base mb-3 group-hover:scale-105 transition-transform duration-200">♻️</div>
              <h2 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight group-hover:text-blue-700 transition-colors">Tabungan Sampah</h2>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Manajemen bank sampah</p>
            </Link>
            <Link href="/admin/kurban" className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 hover:border-blue-300 transition-all duration-200 block h-full">
              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-base mb-3 group-hover:scale-105 transition-transform duration-200">🐄</div>
              <h2 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight group-hover:text-blue-700 transition-colors">Tabungan Kurban</h2>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Persiapan Idul Adha</p>
            </Link>
            <Link href="/admin/lapak" className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 hover:border-blue-300 transition-all duration-200 block h-full">
              <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-base mb-3 group-hover:scale-105 transition-transform duration-200">🏪</div>
              <h2 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight group-hover:text-blue-700 transition-colors">Pasar Warga (UMKM)</h2>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Validasi lapak dagangan</p>
            </Link>
            <Link href="/admin/inventaris" className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 hover:border-blue-300 transition-all duration-200 block h-full">
              <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-base mb-3 group-hover:scale-105 transition-transform duration-200">🎪</div>
              <h2 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight group-hover:text-blue-700 transition-colors">Inventaris</h2>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Setujui peminjaman alat</p>
            </Link>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-amber-500 shrink-0"></span> Keamanan &amp; tata kelola
            </h2>
            <p className="text-[11px] text-slate-400 hidden md:block">Ronda, e-voting, dan log pengurus</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Link href="/admin/ronda" className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 hover:border-blue-300 transition-all duration-200 block h-full">
              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-base mb-3 group-hover:scale-105 transition-transform duration-200">🔦</div>
              <h2 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight group-hover:text-blue-700 transition-colors">Jadwal Siskamling</h2>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Atur regu ronda malam</p>
            </Link>
            <Link href="/admin/voting" className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 hover:border-blue-300 transition-all duration-200 block h-full">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-base mb-3 group-hover:scale-105 transition-transform duration-200">📊</div>
              <h2 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight group-hover:text-blue-700 transition-colors">Manajemen Voting</h2>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Buat topik pemilihan</p>
            </Link>
            <Link href="/admin/lapor" className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 hover:border-blue-300 transition-all duration-200 block h-full">
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-base mb-3 group-hover:scale-105 transition-transform duration-200">🚨</div>
              <h2 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight group-hover:text-blue-700 transition-colors">Laporan Warga</h2>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Tiket perubahan data keluarga</p>
            </Link>
            {adminAktif?.role === 'webmaster' ? (
              <Link href="/admin/audit" className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-1 hover:border-blue-300 transition-all duration-200 block h-full">
                <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-base mb-3 group-hover:scale-105 transition-transform duration-200">🔍</div>
                <h2 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight group-hover:text-blue-700 transition-colors">Log Audit</h2>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Pantau pergerakan pengurus</p>
              </Link>
            ) : (
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-dashed border-slate-300 cursor-not-allowed relative h-full">
                <span className="absolute top-3 right-3 bg-rose-100 text-rose-700 text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">🔒 Webmaster</span>
                <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-base mb-3 grayscale opacity-70">🔍</div>
                <h2 className="font-semibold text-slate-500 text-[13px] leading-snug tracking-tight">Log Audit</h2>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Akses khusus Webmaster</p>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-amber-500 shrink-0"></span> Validasi pendaftaran warga baru
            </h2>
            <Link href="/admin/verifikasi" className="text-[10px] font-semibold text-blue-600 hover:underline">
              Buka halaman verifikasi →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">
                  <th className="px-4 py-2.5 font-bold w-[20%]">Nama Kepala Keluarga</th>
                  <th className="px-4 py-2.5 font-bold w-[25%]">NIK &amp; Kontak</th>
                  <th className="px-4 py-2.5 font-bold w-[15%]">Status &amp; Alamat</th>
                  <th className="px-4 py-2.5 font-bold w-[20%]">Anggota Keluarga</th>
                  <th className="px-4 py-2.5 font-bold text-center w-[10%]">Status Saat Ini</th>
                  <th className="px-4 py-2.5 font-bold text-center w-[10%]">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {wargaList.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-[13px] text-slate-400 font-medium italic">Belum ada data pendaftaran warga terbaru.</td></tr>
                ) : (
                  wargaList.map((w) => (
                    <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[13px] text-slate-800">{w.nama_lengkap || <span className="italic font-medium text-slate-400">Tanpa nama</span>}</td>
                      <td className="px-4 py-3"><div className="text-[11px] text-slate-600 font-mono">NIK: {w.nik || '-'}</div><div className="text-[11px] text-slate-600 font-mono mt-0.5">WA: {w.no_whatsapp || '-'}</div></td>
                      <td className="px-4 py-3"><span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider inline-block mb-1">{w.status_tinggal || 'Tidak diisi'}</span><div className="text-[11px] text-slate-500 truncate max-w-[150px] leading-relaxed">{w.detail_alamat || '-'}</div></td>
                      <td className="px-4 py-3">{(!w.anggota_keluarga || w.anggota_keluarga.length === 0) ? <span className="text-[11px] text-slate-400 font-medium">Sendiri</span> : <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5">{w.anggota_keluarga.map((ak: any, idx: number) => <li key={idx}><span className="font-semibold">{ak.nama_lengkap}</span></li>)}</ul>}</td>
                      <td className="px-4 py-3 text-center"><span className={`font-bold text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${w.status_verifikasi === 'Disetujui' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>{w.status_verifikasi}</span></td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1.5">
                          <button onClick={() => handleValidasi(w.id, 'Disetujui', w.nama_lengkap, w.ktp_path, w.kk_path)} disabled={loadingId === w.id} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors active:scale-95">{loadingId === w.id ? '...' : 'Sah'}</button>
                          <button onClick={() => handleValidasi(w.id, 'Ditolak', w.nama_lengkap, w.ktp_path, w.kk_path)} disabled={loadingId === w.id} className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors active:scale-95">Tolak</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
