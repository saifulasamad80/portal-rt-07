"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const FITUR_KTP_AKTIF = false;

// INJEKSI: Tambahkan properti statistik ke parameter
export default function AdminDashboardClient({ adminAktif, wargaList, statistik, prosesValidasi, logoutAction }: { adminAktif: any, wargaList: any[], statistik: any, prosesValidasi: any, logoutAction: any }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState("");
  const [isLocked, setIsLocked] = useState(false);

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
    try { await prosesValidasi(idWarga, status); router.refresh(); } 
    catch (error: any) { alert("Gagal memproses validasi: " + error.message); }
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
              {adminAktif.nama.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white mb-1">Pusat Komando RT 07</h1>
              <p className="text-emerald-400 font-bold text-xs uppercase tracking-widest bg-slate-800 px-2 py-0.5 rounded w-fit mt-1 border border-slate-700">
                Akses: {adminAktif.role === 'webmaster' ? 'Super Admin / Webmaster' : 'Pengurus RT'}
              </p>
            </div>
          </div>
          <form action={logoutAction} className="w-full md:w-auto">
            <button type="submit" className="w-full md:w-auto bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-3 px-6 rounded-lg transition-all shadow-md active:scale-95">
              Keluar Dasbor
            </button>
          </form>
        </div>

        {/* HUD STATISTIK (Merespons coretan "Di Depan" Pak RT) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center text-center">
            <div className="text-xl mb-1">👥</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Warga Sah</div>
            <div className="text-lg font-black text-blue-600">{statistik.warga} KK</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center text-center border-b-4 border-b-emerald-500">
            <div className="text-xl mb-1">♻️</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sampah Berkurang</div>
            <div className="text-lg font-black text-emerald-600">{statistik.sampahKg.toFixed(1)} Kg</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center text-center">
            <div className="text-xl mb-1">💸</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Bank Sampah</div>
            <div className="text-lg font-black text-amber-500">Rp {(statistik.sampahRp / 1000).toFixed(0)}k</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center text-center border-b-4 border-b-pink-500">
            <div className="text-xl mb-1">🐄</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dana Qurban</div>
            <div className="text-lg font-black text-pink-600">Rp {(statistik.kurbanRp / 1000000).toFixed(1)} Jt</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-2">
          {/* ... (Semua 12 Bento Box Link Tetap Sama Persis) ... */}
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
          
          {adminAktif.role === 'webmaster' ? (
            <Link href="/admin/audit" className="bg-slate-900 p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-800 hover:shadow-lg hover:-translate-y-1 transition-all block">
              <div className="text-3xl mb-3">🔍</div><h2 className="font-black text-white text-sm">Log Audit</h2><p className="text-[10px] text-slate-400 mt-1">Pantau pergerakan pengurus</p>
            </Link>
          ) : (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed relative overflow-hidden">
              <div className="absolute top-2 right-2 bg-rose-100 text-rose-700 text-[8px] font-black px-2 py-1 rounded">🔒 WEBMASTER</div>
              <div className="text-3xl mb-3 grayscale">🔍</div><h2 className="font-black text-slate-500 text-sm">Log Audit</h2><p className="text-[10px] text-slate-400 mt-1">Akses khusus Webmaster</p>
            </div>
          )}

          {adminAktif.role === 'webmaster' ? (
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
          {/* ... (Tabel Validasi Warga Tetap Sama Persis) ... */}
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
                      <td className="p-4 font-black text-slate-800">{w.nama_lengkap}</td>
                      <td className="p-4"><div className="text-[11px] text-slate-600 font-mono">NIK: {w.nik}</div><div className="text-[11px] text-slate-600 font-mono mt-1">WA: {w.no_whatsapp}</div></td>
                      <td className="p-4"><span className="bg-slate-200 text-slate-700 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider block w-fit mb-1.5">{w.status_tinggal}</span><div className="text-[11px] text-slate-600 truncate max-w-[150px] leading-relaxed">{w.detail_alamat}</div></td>
                      <td className="p-4">{(!w.anggota_keluarga || w.anggota_keluarga.length === 0) ? <span className="text-[11px] text-slate-400 font-medium">Sendiri</span> : <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1">{w.anggota_keluarga.map((ak: any, idx: number) => <li key={idx}><span className="font-bold">{ak.nama_lengkap}</span></li>)}</ul>}</td>
                      <td className="p-4 text-center"><span className={`font-black text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${w.status_verifikasi === 'Disetujui' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{w.status_verifikasi}</span></td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleValidasi(w.id, 'Disetujui', w.nama_lengkap, w.ktp_path, w.kk_path)} disabled={loadingId === w.id} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors shadow-sm active:scale-95">Sah</button>
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