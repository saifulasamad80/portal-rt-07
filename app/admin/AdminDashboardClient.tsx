"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboardClient({ adminAktif, wargaList, prosesValidasi, logoutAction }: { adminAktif: any, wargaList: any[], prosesValidasi: any, logoutAction: any }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState("");

  const handleValidasi = async (idWarga: string, status: string, namaWarga: string) => {
    if (status !== "Menunggu" && !confirm(`Yakin ingin menandai pendaftaran ${namaWarga} sebagai: ${status}?`)) return;

    setLoadingId(idWarga);
    try {
      await prosesValidasi(idWarga, status);
      router.refresh();
    } catch (error: any) {
      alert("Gagal memproses validasi: " + error.message);
    }
    setLoadingId("");
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER PUSAT KOMANDO */}
        <div className="bg-slate-800 rounded-xl shadow-lg flex justify-between items-center p-6 border-l-[12px] border-emerald-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-xl font-black text-white uppercase">
              {adminAktif.nama.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white mb-0">Pusat Komando RT 07</h1>
              <p className="text-slate-400 font-bold text-xs mt-0.5">Dasbor eksklusif pengurus lingkungan.</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 px-6 rounded-md transition-colors shadow-md">
              Keluar Dasbor
            </button>
          </form>
        </div>

        {/* GRID MENU UTAMA (GARIS WARNA DI BAWAH SESUAI FOTO 21:15) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/admin/warga" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-b-[5px] border-b-blue-500 hover:shadow-md transition-all block">
            <div className="text-3xl mb-2 text-blue-500">👥</div>
            <h2 className="font-black text-slate-800 text-sm">Buku Induk Warga</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Data demografi & NIK</p>
          </Link>

          <Link href="/admin/pengumuman" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-b-[5px] border-b-rose-500 hover:shadow-md transition-all block">
            <div className="text-3xl mb-2">📢</div>
            <h2 className="font-black text-slate-800 text-sm">Pengumuman RT</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Buat edaran ke warga</p>
          </Link>

          <Link href="/admin/kas" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-b-[5px] border-b-amber-400 hover:shadow-md transition-all block">
            <div className="text-3xl mb-2 text-amber-500">💰</div>
            <h2 className="font-black text-slate-800 text-sm">Kas & Keuangan</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Rekap iuran bulanan</p>
          </Link>

          <Link href="/admin/sampah" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-b-[5px] border-b-emerald-500 hover:shadow-md transition-all block">
            <div className="text-3xl mb-2 text-emerald-500">♻️</div>
            <h2 className="font-black text-slate-800 text-sm">Tabungan Sampah</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Manajemen bank sampah</p>
          </Link>

          <Link href="/admin/kurban" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-b-[5px] border-b-pink-500 hover:shadow-md transition-all block">
            <div className="text-3xl mb-2">🐄</div>
            <h2 className="font-black text-slate-800 text-sm">Tabungan Kurban</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Persiapan Idul Adha</p>
          </Link>

          <Link href="/admin/lapor" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-b-[5px] border-b-rose-600 hover:shadow-md transition-all block">
            <div className="text-3xl mb-2">🚨</div>
            <h2 className="font-black text-slate-800 text-sm">Laporan Warga</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Tindak lanjut tiket keluhan</p>
          </Link>

          <Link href="/admin/inventaris" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-b-[5px] border-b-orange-500 hover:shadow-md transition-all block">
            <div className="text-3xl mb-2">🎪</div>
            <h2 className="font-black text-slate-800 text-sm">Inventaris</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Setujui peminjaman alat</p>
          </Link>

          <Link href="/admin/voting" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-b-[5px] border-b-indigo-500 hover:shadow-md transition-all block">
            <div className="text-3xl mb-2">📊</div>
            <h2 className="font-black text-slate-800 text-sm">Manajemen Voting</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Buat topik pemilihan warga</p>
          </Link>

          <Link href="/admin/ronda" className="bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-700 border-b-[5px] border-b-slate-400 hover:bg-slate-700 transition-all block">
            <div className="text-3xl mb-2">🔦</div>
            <h2 className="font-black text-white text-sm">Jadwal Siskamling</h2>
            <p className="text-[10px] text-slate-300 font-bold mt-1">Atur regu ronda malam</p>
          </Link>

          <Link href="/admin/audit" className="bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-800 border-b-[5px] border-b-rose-600 hover:bg-slate-800 transition-all block">
            <div className="text-3xl mb-2">🔍</div>
            <h2 className="font-black text-white text-sm">Log Audit</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Pantau pergerakan pengurus</p>
          </Link>

          <Link href="/admin/pengurus" className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-b-[5px] border-b-indigo-500 hover:shadow-md transition-all block">
            <div className="text-3xl mb-2 text-indigo-500">👔</div>
            <h2 className="font-black text-slate-800 text-sm">Akses Pengurus</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Tambah & Reset Akun RT</p>
          </Link>

          {/* KARTU BUKU TAMU & PASAR WARGA (TANPA COL-SPAN-2) */}
          <div className="bg-slate-100 p-5 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed relative overflow-hidden">
            <div className="absolute top-2 right-2 bg-rose-100 text-rose-600 text-[8px] font-black px-2 py-1 rounded flex items-center gap-1">🔒 BUTUH SERVER</div>
            <div className="text-3xl mb-2 grayscale">📸</div>
            <h2 className="font-black text-slate-500 text-sm">Buku Tamu 1x24 Jam</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Sistem lapor tamu dgn E-KTP</p>
          </div>

          <div className="bg-slate-100 p-5 rounded-xl border border-slate-200 opacity-60 cursor-not-allowed relative overflow-hidden">
            <div className="absolute top-2 right-2 bg-rose-100 text-rose-600 text-[8px] font-black px-2 py-1 rounded flex items-center gap-1">🔒 BUTUH SERVER</div>
            <div className="text-3xl mb-2 grayscale">🏪</div>
            <h2 className="font-black text-slate-500 text-sm">Pasar Warga (Lapak)</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Katalog UMKM warga</p>
          </div>
        </div> {/* <-- Penutup div grid */}

        {/* TABEL VALIDASI PENDAFTARAN AKURAT (NO VERTICAL BORDERS) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-300 p-6 overflow-hidden mt-8">
          <h2 className="text-lg font-black text-slate-800 mb-6 border-b-2 border-slate-800 pb-2">Validasi Pendaftaran Warga Baru</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-xs">
                  <th className="p-4 font-bold w-[20%] rounded-tl-md">Nama Kepala Keluarga</th>
                  <th className="p-4 font-bold w-[25%]">NIK & Kontak</th>
                  <th className="p-4 font-bold w-[15%]">Status & Alamat</th>
                  <th className="p-4 font-bold w-[20%]">Anggota Keluarga</th>
                  <th className="p-4 font-bold text-center w-[10%]">Status Saat Ini</th>
                  <th className="p-4 font-bold text-center w-[10%] rounded-tr-md">Aksi (Validasi)</th>
                </tr>
              </thead>
              <tbody>
                {wargaList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-bold italic border-b border-slate-200">Belum ada data pendaftaran warga terbaru.</td>
                  </tr>
                ) : (
                  wargaList.map((w) => (
                    <tr key={w.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="p-4 font-black text-slate-800">{w.nama_lengkap}</td>
                      <td className="p-4">
                        <div className="text-[11px] text-slate-600 font-mono">NIK: {w.nik}</div>
                        <div className="text-[11px] text-slate-600 font-mono mt-1">WA: {w.no_whatsapp}</div>
                        
                        {/* LUBANG LOGIKA DITAMBAL: TOMBOL LIHAT KTP & KK */}
                        {(w.ktp_path || w.kk_path) && (
                          <div className="mt-3 flex gap-2">
                            {w.ktp_path === 'MENYUSUL' ? (
                              <span className="text-[9px] bg-rose-50 text-rose-500 px-2 py-1 rounded font-bold border border-rose-100">KTP Fisik</span>
                            ) : w.ktp_path ? (
                              <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/dokumen_warga/${w.ktp_path}`} target="_blank" className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold border border-indigo-200 hover:bg-indigo-100 transition-colors">📄 Cek KTP</a>
                            ) : null}
                            
                            {w.kk_path === 'MENYUSUL' ? (
                              <span className="text-[9px] bg-rose-50 text-rose-500 px-2 py-1 rounded font-bold border border-rose-100">KK Fisik</span>
                            ) : w.kk_path ? (
                              <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/dokumen_warga/${w.kk_path}`} target="_blank" className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold border border-indigo-200 hover:bg-indigo-100 transition-colors">📄 Cek KK</a>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider block w-fit mb-1">{w.status_tinggal}</span>
                        <div className="text-[11px] text-slate-600 truncate max-w-[150px]">{w.detail_alamat}</div>
                      </td>
                      <td className="p-4">
                        {(!w.anggota_keluarga || w.anggota_keluarga.length === 0) ? (
                          <span className="text-[11px] italic text-slate-400 font-bold">Tidak ada/Sendiri</span>
                        ) : (
                          <ul className="list-disc list-inside text-[11px] text-slate-600 pl-2">
                            {w.anggota_keluarga.map((ak: any, idx: number) => (
                              <li key={idx}>
                                <b>{ak.nama_lengkap}</b> <span className="text-slate-400">({ak.hubungan_keluarga})</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-black text-xs ${w.status_verifikasi === 'Disetujui' ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {w.status_verifikasi}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {w.status_verifikasi === 'Menunggu' ? (
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handleValidasi(w.id, 'Disetujui', w.nama_lengkap)} disabled={loadingId === w.id} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 rounded disabled:opacity-50 transition-colors shadow-sm">
                              Sah
                            </button>
                            <button onClick={() => handleValidasi(w.id, 'Ditolak', w.nama_lengkap)} disabled={loadingId === w.id} className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold px-3 py-1.5 rounded disabled:opacity-50 transition-colors shadow-sm">
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Tervalidasi</span>
                            <button onClick={() => handleValidasi(w.id, 'Menunggu', w.nama_lengkap)} disabled={loadingId === w.id} className="text-[9px] font-bold text-slate-500 underline hover:text-slate-800 transition-colors">
                              Batal
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