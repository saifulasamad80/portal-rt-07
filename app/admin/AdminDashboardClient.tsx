"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const FITUR_KTP_AKTIF = false;

type Notifikasi = { tipe: "sukses" | "gagal"; pesan: string } | null;

export default function AdminDashboardClient({ adminAktif, wargaList, statistik, prosesValidasi, logoutAction }: { adminAktif: any, wargaList: any[], statistik: any, prosesValidasi: any, logoutAction: any }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [notifikasi, setNotifikasi] = useState<Notifikasi>(null);

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
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="bg-slate-900 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 gap-4 border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-xl font-black text-white uppercase shadow-inner">
              {namaAdmin.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white mb-1">Pusat Komando RT 07</h1>
              <p className="text-emerald-400 font-bold text-xs uppercase tracking-widest bg-slate-800 px-2 py-0.5 rounded w-fit mt-1 border border-slate-700">
                Akses: {adminAktif?.role === 'webmaster' ? 'Super Admin / Webmaster' : 'Pengurus RT'}
              </p>
            </div>
          </div>
          <form action={logoutAction} className="w-full md:w-auto">
            <button type="submit" className="w-full md:w-auto bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-3 px-6 rounded-lg transition-all shadow-md active:scale-95">
              Keluar Dasbor
            </button>
          </form>
        </div>

        {notifikasi && (
          <div className={`rounded-xl border p-4 flex items-start justify-between gap-4 shadow-sm ${notifikasi.tipe === 'sukses' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            <div className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">{notifikasi.tipe === 'sukses' ? '✅' : '⚠️'}</span>
              <p className="text-xs font-bold leading-relaxed">{notifikasi.pesan}</p>
            </div>
            <button onClick={() => setNotifikasi(null)} className="text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 shrink-0">Tutup</button>
          </div>
        )}

        {/* HUD STATISTIK (Merespons coretan "Di Depan" Pak RT) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center text-center">
            <div className="text-xl mb-1">👥</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Warga Sah</div>
            <div className="text-lg font-black text-blue-600">{jumlahWargaSah} KK</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center text-center border-b-4 border-b-emerald-500">
            <div className="text-xl mb-1">♻️</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sampah Berkurang</div>
            <div className="text-lg font-black text-emerald-600">{sampahKg.toFixed(1)} Kg</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center text-center">
            <div className="text-xl mb-1">💸</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Bank Sampah</div>
            <div className="text-lg font-black text-amber-500">Rp {(sampahRp / 1000).toFixed(0)}k</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center text-center border-b-4 border-b-pink-500">
            <div className="text-xl mb-1">🐄</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dana Qurban</div>
            <div className="text-lg font-black text-pink-600">Rp {(kurbanRp / 1000000).toFixed(1)} Jt</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-2">
          <Link href="/admin/warga" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-blue-500">👥</div><h2 className="font-black text-slate-800 text-sm">Buku Induk Warga</h2><p className="text-[10px] text-slate-500 mt-1">Data demografi & NIK</p>
          </Link>
          <Link href="/admin/pengumuman" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3">📢</div><h2 className="font-black text-slate-800 text-sm">Pengumuman RT</h2><p className="text-[10px] text-slate-500 mt-1">Buat edaran ke warga</p>
          </Link>
          <Link href="/admin/lapak" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-orange-500">🏪</div><h2 className="font-black text-slate-800 text-sm">Pasar Warga (UMKM)</h2><p className="text-[10px] text-slate-500 mt-1">Validasi lapak dagangan</p>
          </Link>
          <Link href="/admin/kas" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-amber-500">💰</div><h2 className="font-black text-slate-800 text-sm">Kas & Keuangan</h2><p className="text-[10px] text-slate-500 mt-1">Rekap iuran bulanan</p>
          </Link>
          <Link href="/admin/sampah" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-emerald-500">♻️</div><h2 className="font-black text-slate-800 text-sm">Tabungan Sampah</h2><p className="text-[10px] text-slate-500 mt-1">Manajemen bank sampah</p>
          </Link>
          <Link href="/admin/kurban" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3">🐄</div><h2 className="font-black text-slate-800 text-sm">Tabungan Kurban</h2><p className="text-[10px] text-slate-500 mt-1">Persiapan Idul Adha</p>
          </Link>
          
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed relative overflow-hidden">
            <div className="absolute top-2 right-2 bg-slate-200 text-slate-600 text-[8px] font-black px-2 py-1 rounded flex items-center gap-1">🔒 DIGEMBOK</div>
            <div className="text-3xl mb-3 grayscale">🚨</div><h2 className="font-black text-slate-500 text-sm">Laporan Warga</h2><p className="text-[10px] text-slate-400 mt-1">Ditunda instruksi RT</p>
          </div>

          <Link href="/admin/inventaris" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3">🎪</div><h2 className="font-black text-slate-800 text-sm">Inventaris</h2><p className="text-[10px] text-slate-500 mt-1">Setujui peminjaman alat</p>
          </Link>
          <Link href="/admin/voting" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3">📊</div><h2 className="font-black text-slate-800 text-sm">Manajemen Voting</h2><p className="text-[10px] text-slate-500 mt-1">Buat topik pemilihan</p>
          </Link>
          <Link href="/admin/ronda" className="bg-slate-900 p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-800 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3">🔦</div><h2 className="font-black text-white text-sm">Jadwal Siskamling</h2><p className="text-[10px] text-slate-400 mt-1">Atur regu ronda malam</p>
          </Link>
          <Link href="/admin/ibu-ibu" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-rose-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3">🌸</div><h2 className="font-black text-slate-800 text-sm">Modul Ibu-ibu</h2><p className="text-[10px] text-slate-500 mt-1">Posyandu & arisan</p>
          </Link>
          
          {adminAktif?.role === 'webmaster' ? (
            <Link href="/admin/audit" className="bg-slate-900 p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-800 hover:shadow-lg hover:-translate-y-1 transition-all block">
              <div className="text-3xl mb-3">🔍</div><h2 className="font-black text-white text-sm">Log Audit</h2><p className="text-[10px] text-slate-400 mt-1">Pantau pergerakan pengurus</p>
            </Link>
          ) : (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed relative overflow-hidden">
              <div className="absolute top-2 right-2 bg-rose-100 text-rose-700 text-[8px] font-black px-2 py-1 rounded">🔒 WEBMASTER</div>
              <div className="text-3xl mb-3 grayscale">🔍</div><h2 className="font-black text-slate-500 text-sm">Log Audit</h2><p className="text-[10px] text-slate-400 mt-1">Akses khusus Webmaster</p>
            </div>
          )}

          {adminAktif?.role === 'webmaster' ? (
            <Link href="/admin/pengurus" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
              <div className="text-3xl mb-3 text-indigo-500">👔</div><h2 className="font-black text-slate-800 text-sm">Akses Pengurus</h2><p className="text-[10px] text-slate-500 mt-1">Tambah & Reset Akun</p>
            </Link>
          ) : (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed relative overflow-hidden">
              <div className="absolute top-2 right-2 bg-rose-100 text-rose-700 text-[8px] font-black px-2 py-1 rounded">🔒 WEBMASTER</div>
              <div className="text-3xl mb-3 grayscale">👔</div><h2 className="font-black text-slate-500 text-sm">Akses Pengurus</h2><p className="text-[10px] text-slate-400 mt-1">Akses khusus Webmaster</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 p-6 md:p-8 overflow-hidden mt-8">
          <h2 className="text-lg font-black text-slate-800 mb-6 border-b border-slate-100 pb-4">Validasi Pendaftaran Warga Baru</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
                  <th className="p-4 font-bold w-[20%]">Nama Kepala Keluarga</th>
                  <th className="p-4 font-bold w-[25%]">NIK & Kontak</th>
                  <th className="p-4 font-bold w-[15%]">Status & Alamat</th>
                  <th className="p-4 font-bold w-[20%]">Anggota Keluarga</th>
                  <th className="p-4 font-bold text-center w-[10%]">Status Saat Ini</th>
                  <th className="p-4 font-bold text-center w-[10%]">Aksi (Validasi)</th>
                </tr>
              </thead>
              <tbody>
                {wargaList.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-medium italic border-b border-slate-100">Belum ada data pendaftaran warga terbaru.</td></tr>
                ) : (
                  wargaList.map((w) => (
                    <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-black text-slate-800">{w.nama_lengkap || <span className="italic font-medium text-slate-400">Tanpa nama</span>}</td>
                      <td className="p-4"><div className="text-[11px] text-slate-600 font-mono">NIK: {w.nik || '-'}</div><div className="text-[11px] text-slate-600 font-mono mt-1">WA: {w.no_whatsapp || '-'}</div></td>
                      <td className="p-4"><span className="bg-slate-200 text-slate-700 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider block w-fit mb-1.5">{w.status_tinggal || 'Tidak diisi'}</span><div className="text-[11px] text-slate-600 truncate max-w-[150px] leading-relaxed">{w.detail_alamat || '-'}</div></td>
                      <td className="p-4">{(!w.anggota_keluarga || w.anggota_keluarga.length === 0) ? <span className="text-[11px] text-slate-400 font-medium">Sendiri</span> : <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1">{w.anggota_keluarga.map((ak: any, idx: number) => <li key={idx}><span className="font-bold">{ak.nama_lengkap}</span></li>)}</ul>}</td>
                      <td className="p-4 text-center"><span className={`font-black text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${w.status_verifikasi === 'Disetujui' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{w.status_verifikasi}</span></td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleValidasi(w.id, 'Disetujui', w.nama_lengkap, w.ktp_path, w.kk_path)} disabled={loadingId === w.id} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors shadow-sm active:scale-95">{loadingId === w.id ? '...' : 'Sah'}</button>
                          <button onClick={() => handleValidasi(w.id, 'Ditolak', w.nama_lengkap, w.ktp_path, w.kk_path)} disabled={loadingId === w.id} className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors shadow-sm active:scale-95">Tolak</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
