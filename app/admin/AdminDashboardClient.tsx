"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const FITUR_KTP_AKTIF = false;

export default function AdminDashboardClient({ adminAktif, wargaList, prosesValidasi, logoutAction }: { adminAktif: any, wargaList: any[], prosesValidasi: any, logoutAction: any }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState("");
  const [isLocked, setIsLocked] = useState(false); // REFACTOR: State kendali UI Kunci

  // ------------------------------------------------------------------
  // REFACTOR: Eksekusi Idle Timeout Non-Blocking (Asynchronous)
  // ------------------------------------------------------------------
  useEffect(() => {
    const BATAS_WAKTU_IDLE = 10 * 60 * 1000; // 10 Menit
    let waktuTerakhirAktif = Date.now();

    const perbaruiAktivitas = () => {
      waktuTerakhirAktif = Date.now();
    };

    const cekKematianSesi = async () => {
      if (Date.now() - waktuTerakhirAktif > BATAS_WAKTU_IDLE) {
        // Mengamankan layar secara visual TERLEBIH DAHULU
        setIsLocked(true); 
        try {
          // Menghancurkan session di backend secara diam-diam
          await fetch('/api/admin/login', { method: 'DELETE' }); 
        } finally {
          window.location.href = '/admin'; // Redirect paksa tanpa block thread
        }
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
  // ------------------------------------------------------------------

  const handleValidasi = async (idWarga: string, status: string, namaWarga: string, ktpPath: string, kkPath: string) => {
    const isDokumenKosong = FITUR_KTP_AKTIF 
      ? (ktpPath === 'MENYUSUL' || kkPath === 'MENYUSUL')
      : (kkPath === 'MENYUSUL');

    if (status === 'Disetujui' && isDokumenKosong) {
      const beraniTanggungJawab = confirm(
        `⚠️ PERINGATAN FATAL: DOKUMEN DIGITAL KOSONG!\n\nPendaftar atas nama ${namaWarga} BELUM mengunggah file ${FITUR_KTP_AKTIF ? 'KTP/KK' : 'KK'} secara digital.\n\nSebagai Pengurus RT, apakah Anda BERANI MENJAMIN bahwa Anda SUDAH MENERIMA DAN MEMERIKSA dokumen fisiknya secara langsung?\n\nKlik OK jika Anda berani bertanggung jawab.`
      );
      if (!beraniTanggungJawab) return; 
    } else if (status !== "Menunggu" && !confirm(`Yakin ingin menandai pendaftaran ${namaWarga} sebagai: ${status}?`)) {
      return;
    }

    setLoadingId(idWarga);
    try {
      await prosesValidasi(idWarga, status);
      router.refresh();
    } catch (error: any) {
      alert("Gagal memproses validasi: " + error.message);
    }
    setLoadingId("");
  };

  // REFACTOR: Render Darurat jika Idle Timeout tercapai
  if (isLocked) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center text-white p-6 font-sans">
        <div className="text-7xl mb-6 animate-bounce">🔒</div>
        <h1 className="text-2xl md:text-3xl font-black text-rose-500 mb-2 uppercase tracking-widest text-center">Sistem Terkunci Otomatis</h1>
        <p className="text-slate-400 text-sm md:text-base text-center max-w-md mb-8 leading-relaxed">
          Tidak ada aktivitas terdeteksi selama 10 Menit. Demi keamanan privasi data Warga, sesi Anda telah dihancurkan oleh sistem.
        </p>
        <div className="flex items-center gap-3 text-emerald-400 font-bold bg-slate-800 px-6 py-3 rounded-full border border-slate-700">
          <span className="animate-spin text-xl">⌛</span> Memulihkan keamanan server...
        </div>
      </div>
    );
  }

  // ... (Sisa kode UI Return dasbor dipertahankan sama persis sesuai sumber V5)
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="bg-slate-900 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 gap-4 border border-slate-800">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <Link href="/admin/warga" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-blue-500">👥</div>
            <h2 className="font-black text-slate-800 text-sm">Buku Induk Warga</h2>
            <p className="text-[10px] text-slate-500 mt-1">Data demografi & NIK</p>
          </Link>
          <Link href="/admin/pengumuman" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3">📢</div>
            <h2 className="font-black text-slate-800 text-sm">Pengumuman RT</h2>
            <p className="text-[10px] text-slate-500 mt-1">Buat edaran ke warga</p>
          </Link>
          
          <Link href="/admin/lapak" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-orange-500">🏪</div>
            <h2 className="font-black text-slate-800 text-sm">Pasar Warga (UMKM)</h2>
            <p className="text-[10px] text-slate-500 mt-1">Validasi lapak dagangan</p>
          </Link>

          <Link href="/admin/kas" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-amber-500">💰</div>
            <h2 className="font-black text-slate-800 text-sm">Kas & Keuangan</h2>
            <p className="text-[10px] text-slate-500 mt-1">Rekap iuran bulanan</p>
          </Link>
          <Link href="/admin/sampah" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3 text-emerald-500">♻️</div>
            <h2 className="font-black text-slate-800 text-sm">Tabungan Sampah</h2>
            <p className="text-[10px] text-slate-500 mt-1">Manajemen bank sampah</p>
          </Link>
          <Link href="/admin/kurban" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3">🐄</div>
            <h2 className="font-black text-slate-800 text-sm">Tabungan Kurban</h2>
            <p className="text-[10px] text-slate-500 mt-1">Persiapan Idul Adha</p>
          </Link>
          
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed relative overflow-hidden">
            <div className="absolute top-2 right-2 bg-slate-200 text-slate-600 text-[8px] font-black px-2 py-1 rounded flex items-center gap-1">🔒 DIGEMBOK</div>
            <div className="text-3xl mb-3 grayscale">🚨</div>
            <h2 className="font-black text-slate-500 text-sm">Laporan Warga</h2>
            <p className="text-[10px] text-slate-400 mt-1">Ditunda instruksi RT</p>
          </div>

          <Link href="/admin/inventaris" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3">🎪</div>
            <h2 className="font-black text-slate-800 text-sm">Inventaris</h2>
            <p className="text-[10px] text-slate-500 mt-1">Setujui peminjaman alat</p>
          </Link>
          <Link href="/admin/voting" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3">📊</div>
            <h2 className="font-black text-slate-800 text-sm">Manajemen Voting</h2>
            <p className="text-[10px] text-slate-500 mt-1">Buat topik pemilihan</p>
          </Link>
          <Link href="/admin/ronda" className="bg-slate-900 p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-800 hover:shadow-lg hover:-translate-y-1 transition-all block">
            <div className="text-3xl mb-3">🔦</div>
            <h2 className="font-black text-white text-sm">Jadwal Siskamling</h2>
            <p className="text-[10px] text-slate-400 mt-1">Atur regu ronda malam</p>
          </Link>
          
          {/* LOGIKA KASTA: LOG AUDIT */}
          {adminAktif.role === 'webmaster' ? (
            <Link href="/admin/audit" className="bg-slate-900 p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-800 hover:shadow-lg hover:-translate-y-1 transition-all block">
              <div className="text-3xl mb-3">🔍</div>
              <h2 className="font-black text-white text-sm">Log Audit</h2>
              <p className="text-[10px] text-slate-400 mt-1">Pantau pergerakan pengurus</p>
            </Link>
          ) : (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed relative overflow-hidden">
              <div className="absolute top-2 right-2 bg-rose-100 text-rose-700 text-[8px] font-black px-2 py-1 rounded flex items-center gap-1">🔒 WEBMASTER</div>
              <div className="text-3xl mb-3 grayscale">🔍</div>
              <h2 className="font-black text-slate-500 text-sm">Log Audit</h2>
              <p className="text-[10px] text-slate-400 mt-1">Akses khusus Webmaster</p>
            </div>
          )}

          {/* LOGIKA KASTA: AKSES PENGURUS */}
          {adminAktif.role === 'webmaster' ? (
            <Link href="/admin/pengurus" className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all block">
              <div className="text-3xl mb-3 text-indigo-500">👔</div>
              <h2 className="font-black text-slate-800 text-sm">Akses Pengurus</h2>
              <p className="text-[10px] text-slate-500 mt-1">Tambah & Reset Akun</p>
            </Link>
          ) : (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed relative overflow-hidden">
              <div className="absolute top-2 right-2 bg-rose-100 text-rose-700 text-[8px] font-black px-2 py-1 rounded flex items-center gap-1">🔒 WEBMASTER</div>
              <div className="text-3xl mb-3 grayscale">👔</div>
              <h2 className="font-black text-slate-500 text-sm">Akses Pengurus</h2>
              <p className="text-[10px] text-slate-400 mt-1">Akses khusus Webmaster</p>
            </div>
          )}

          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed relative overflow-hidden">
            <div className="absolute top-2 right-2 bg-slate-200 text-slate-600 text-[8px] font-black px-2 py-1 rounded flex items-center gap-1">🔒 BUTUH SERVER</div>
            <div className="text-3xl mb-3 grayscale">📸</div>
            <h2 className="font-black text-slate-500 text-sm">Buku Tamu 1x24 Jam</h2>
            <p className="text-[10px] text-slate-400 mt-1">Sistem lapor tamu dgn E-KTP</p>
          </div>
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
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-medium italic border-b border-slate-100">Belum ada data pendaftaran warga terbaru.</td>
                  </tr>
                ) : (
                  wargaList.map((w) => (
                    <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-black text-slate-800">{w.nama_lengkap}</td>
                      <td className="p-4">
                        <div className="text-[11px] text-slate-600 font-mono">NIK: {w.nik}</div>
                        <div className="text-[11px] text-slate-600 font-mono mt-1">WA: {w.no_whatsapp}</div>
                        
                        {( (FITUR_KTP_AKTIF && w.ktp_path) || w.kk_path ) && (
                          <div className="mt-3 flex gap-2">
                            {FITUR_KTP_AKTIF && (
                              w.ktp_path === 'MENYUSUL' ? (
                                <span className="text-[9px] bg-rose-50 text-rose-500 px-2 py-1 rounded font-bold border border-rose-100">KTP Fisik</span>
                              ) : w.ktp_path ? (
                                <a href={`/api/admin/dokumen?path=${w.ktp_path}`} className="text-[9px] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-md font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors shadow-sm">📄 Cek KTP</a>
                              ) : null
                            )}
                            
                            {w.kk_path === 'MENYUSUL' ? (
                              <span className="text-[9px] bg-rose-50 text-rose-500 px-2 py-1 rounded font-bold border border-rose-100">KK Fisik</span>
                            ) : w.kk_path ? (
                              <a href={`/api/admin/dokumen?path=${w.kk_path}`} className="text-[9px] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-md font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors shadow-sm">📄 Cek KK</a>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="bg-slate-200 text-slate-700 px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider block w-fit mb-1.5">{w.status_tinggal}</span>
                        <div className="text-[11px] text-slate-600 truncate max-w-[150px] leading-relaxed">{w.detail_alamat}</div>
                      </td>
                      <td className="p-4">
                        {(!w.anggota_keluarga || w.anggota_keluarga.length === 0) ? (
                          <span className="text-[11px] text-slate-400 font-medium">Tidak ada/Sendiri</span>
                        ) : (
                          <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1">
                            {w.anggota_keluarga.map((ak: any, idx: number) => (
                              <li key={idx}>
                                <span className="font-bold">{ak.nama_lengkap}</span> <span className="text-slate-400">({ak.hubungan_keluarga})</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-black text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${w.status_verifikasi === 'Disetujui' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {w.status_verifikasi}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {w.status_verifikasi === 'Menunggu' ? (
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleValidasi(w.id, 'Disetujui', w.nama_lengkap, w.ktp_path, w.kk_path)} disabled={loadingId === w.id} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors shadow-sm active:scale-95">
                              Sah
                            </button>
                            <button onClick={() => handleValidasi(w.id, 'Ditolak', w.nama_lengkap, w.ktp_path, w.kk_path)} disabled={loadingId === w.id} className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 text-[10px] font-bold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors shadow-sm active:scale-95">
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Tervalidasi</span>
                            <button onClick={() => handleValidasi(w.id, 'Menunggu', w.nama_lengkap, w.ktp_path, w.kk_path)} disabled={loadingId === w.id} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors underline decoration-slate-300">
                              Batalkan
                            </button>
                          </div>
                        )}
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