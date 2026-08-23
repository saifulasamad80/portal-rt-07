"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PortalWarga() {
  const [warga, setWarga] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const cekSesiWarga = async () => {
      setIsInitializing(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }
      
      // Mengambil profil asli berdasarkan auth_email dummy
      const { data: profilWarga } = await supabase
        .from("warga")
        .select("*")
        .eq("auth_email", session.user.email)
        .single();

      if (profilWarga) {
        setWarga(profilWarga);
      } else {
        router.push("/login");
      }
      setIsInitializing(false);
    };
    
    cekSesiWarga();
  }, [router]);

  const handleLogout = async () => {
    if (confirm("Yakin ingin keluar dari portal?")) {
      await supabase.auth.signOut();
      router.push("/");
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 font-mono text-blue-600">
        <div className="text-4xl mb-4 animate-spin">🛡️</div>
        <div className="font-bold tracking-widest uppercase">MEMVERIFIKASI TOKEN WARGA...</div>
      </div>
    );
  }

  if (!warga) return null;

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-blue-700 text-white p-4 shadow-md flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 left-0 bg-blue-800 text-blue-200 text-[8px] font-bold px-2 py-0.5 rounded-br-lg">JWT PROTECTED</div>
        <div className="font-bold text-lg mt-2">Portal RT 07</div>
        <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-1.5 px-4 rounded transition-colors shadow">
          Keluar Sesi
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
            <p className="text-sm text-slate-500">Buat tiket laporan fasilitas rusak dengan auto-tracking dari Pak RT.</p>
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
      </div>
    </div>
  );
}