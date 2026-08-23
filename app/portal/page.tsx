"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PortalWarga() {
  const [warga, setWarga] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const sesi = localStorage.getItem("warga_aktif");
    if (!sesi) {
      router.push("/login");
      return;
    }
    setWarga(JSON.parse(sesi));
  }, [router]);

  const handleLogout = () => {
    if (confirm("Yakin ingin keluar dari portal?")) {
      localStorage.removeItem("warga_aktif");
      router.push("/");
    }
  };

  if (!warga) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Memverifikasi Sesi...</div>;

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-blue-700 text-white p-4 shadow-md flex justify-between items-center">
        <div className="font-bold text-lg">Portal RT 07</div>
        <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-1.5 px-4 rounded transition-colors">
          Keluar
        </button>
      </nav>

      <div className="p-6 max-w-4xl mx-auto space-y-6 mt-4">
        
        <div className="bg-white p-6 rounded-xl shadow border-l-4 border-blue-500 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Halo, {warga.nama_lengkap}!</h1>
            <p className="text-sm text-slate-500 mt-1">NIK: <span className="font-mono">{warga.nik}</span> | Status: <span className="font-bold text-blue-700">{warga.status_tinggal}</span></p>
          </div>
          <div className="bg-green-100 text-green-700 p-2 rounded-lg text-center shadow-inner">
            <div className="text-xs font-bold uppercase">Status Akun</div>
            <div className="font-bold">{warga.status_verifikasi}</div>
          </div>
        </div>

        {/* FAKTA: Pengumuman & Panic Button ditiadakan dari sini karena sudah di halaman depan */}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/portal/keuangan" className="bg-white p-5 rounded-xl shadow hover:shadow-lg transition-all border-l-4 border-emerald-500 block">
            <h2 className="font-bold text-slate-800 mb-2">💰 Transparansi & Iuran</h2>
            <p className="text-sm text-slate-500">Cek saldo kas RT dan riwayat pembayaran.</p>
          </Link>
          <Link href="/portal/surat" className="bg-white p-5 rounded-xl shadow hover:shadow-lg transition-all border-l-4 border-blue-500 block">
            <h2 className="font-bold text-slate-800 mb-2">📄 Layanan Surat</h2>
            <p className="text-sm text-slate-500">Cetak surat pengantar RT secara mandiri.</p>
          </Link>
          <Link href="/portal/sampah" className="bg-white p-5 rounded-xl shadow hover:shadow-lg transition-all border-l-4 border-emerald-600 block">
            <h2 className="font-bold text-slate-800 mb-2">♻️ Tabungan Sampah</h2>
            <p className="text-sm text-slate-500">Pantau saldo hasil setor sampah anorganik.</p>
          </Link>
          <Link href="/portal/kurban" className="bg-white p-5 rounded-xl shadow hover:shadow-lg transition-all border-l-4 border-amber-500 block">
            <h2 className="font-bold text-slate-800 mb-2">🐄 Tabungan Kurban</h2>
            <p className="text-sm text-slate-500">Pantau persiapan dana kurban Idul Adha.</p>
          </Link>
          
          <Link href="/portal/lapor" className="bg-white p-5 rounded-xl shadow hover:shadow-lg transition-all border-l-4 border-rose-500 block md:col-span-2">
            <h2 className="font-bold text-slate-800 mb-2">🚨 Sistem Lapor Warga</h2>
            <p className="text-sm text-slate-500">Buat tiket laporan fasilitas rusak (lampu mati/selokan mampet) dengan auto-tracking dari Pak RT.</p>
          </Link>
          <Link href="/portal/inventaris" className="bg-white p-5 rounded-xl shadow hover:shadow-lg transition-all border-l-4 border-amber-600 block">
            <h2 className="font-bold text-slate-800 mb-2">🎪 Kalender Inventaris</h2>
            <p className="text-sm text-slate-500">Booking tenda, kursi, atau sound system RT dengan sistem anti-bentrok jadwal.</p>
          </Link>
          <Link href="/portal/voting" className="bg-white p-5 rounded-xl shadow hover:shadow-lg transition-all border-l-4 border-indigo-500 block">
            <h2 className="font-bold text-slate-800 mb-2">📊 E-Voting Warga</h2>
            <p className="text-sm text-slate-500">Pemungutan suara digital untuk keputusan RT. Transparan & anti-curang.</p>
          </Link>
          <Link href="/portal/ronda" className="bg-slate-800 p-5 rounded-xl shadow hover:shadow-lg transition-all border-l-4 border-slate-500 block">
            <h2 className="font-bold text-white mb-2 flex items-center gap-2">🔦 Jadwal Siskamling</h2>
            <p className="text-sm text-slate-400">Cek jadwal tugas ronda malam Anda dan konfirmasi kehadiran secara digital.</p>
          </Link>
        </div>

        <div className="mt-8 border-t-2 border-dashed border-slate-300 pt-6">
          <h2 className="font-bold text-lg text-slate-500 mb-4">🚀 Layanan Ekstra <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-1 rounded-full">BUTUH DANA SERVER</span></h2>
          {/* FAKTA: Grid disesuaikan jadi 2 kolom karena CCTV dihapus */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75">
            <div className="bg-slate-100 p-5 rounded-xl border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-rose-100 text-rose-600 text-[10px] font-bold px-2 py-1 rounded-bl-lg">🔒 Upgrade Storage</div>
              <h2 className="font-bold text-slate-500 mb-2">📸 Buku Tamu</h2>
              <p className="text-xs text-slate-400">Lapor tamu menginap dgn upload E-KTP.</p>
            </div>
            <div className="bg-slate-100 p-5 rounded-xl border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-rose-100 text-rose-600 text-[10px] font-bold px-2 py-1 rounded-bl-lg">🔒 Upgrade Storage</div>
              <h2 className="font-bold text-slate-500 mb-2">🏪 Pasar Warga</h2>
              <p className="text-xs text-slate-400">Jual-beli dengan foto resolusi tinggi.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}