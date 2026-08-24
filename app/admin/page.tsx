"use client";
import { useState, useEffect } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const { adminAktif, loading: authLoading, login, logout } = useAdminAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // FAKTA: State baru untuk menampung data dari Server API
  const [wargaPending, setWargaPending] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Otomatis tarik data warga ketika admin berhasil login
  useEffect(() => {
    if (adminAktif) {
      const fetchWargaPending = async () => {
        try {
          const res = await fetch("/api/admin/warga");
          const json = await res.json();
          if (json.success) {
            setWargaPending(json.data);
          }
        } catch (error) {
          console.error("Gagal menarik data warga:", error);
        } finally {
          setLoadingData(false);
        }
      };
      fetchWargaPending();
    }
  }, [adminAktif]);

  const handleLoginAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const response = await login(username, password);
    if (!response.success) {
      alert("Akses Ditolak: " + response.error);
    }
    setLoginLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 font-mono text-emerald-500">
        <div className="text-4xl mb-4 animate-spin">⚙️</div>
        <div className="font-bold tracking-widest uppercase">MEMVERIFIKASI COOKIE JWT...</div>
      </div>
    );
  }

  if (!adminAktif) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <form onSubmit={handleLoginAdmin} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm text-center border-t-8 border-emerald-600 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-bl-lg">SECURE JWT AUTH</div>
          <div className="text-4xl mb-4">🏛️</div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Pusat Komando</h2>
          <p className="text-slate-500 text-sm mb-6">Sistem terenkripsi khusus Pengurus RT.</p>
          <div className="space-y-4 mb-6 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Username Admin</label>
              <input type="text" required className="w-full border-2 border-slate-300 rounded-lg p-3 outline-none focus:border-emerald-500 transition-colors" placeholder="Masukkan username..." value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Password</label>
              <input type="password" required className="w-full border-2 border-slate-300 rounded-lg p-3 outline-none focus:border-emerald-500 transition-colors" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <button type="submit" disabled={loginLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg">
            {loginLoading ? "Mengotentikasi Server..." : "Otorisasi Masuk"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Profil Admin */}
        <div className="bg-slate-800 p-6 rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-center text-white border-l-8 border-emerald-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-xl font-black uppercase">
              {adminAktif.nama.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-black mb-0 leading-none">{adminAktif.nama}</h1>
              <p className="text-emerald-400 font-bold text-sm mt-1">{adminAktif.jabatan} | RT 07</p>
            </div>
          </div>
          <button onClick={logout} className="mt-4 md:mt-0 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow">
            Tutup Sesi (Logout)
          </button>
        </div>

        {/* Menu Navigasi Modul */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Link href="/admin/warga" className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-blue-600 hover:shadow-md hover:-translate-y-1 transition-all">
            <div className="text-3xl mb-2">👥</div>
            <h2 className="font-bold text-slate-800 text-sm">Induk Warga</h2>
          </Link>
          <Link href="/admin/kas" className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-emerald-500 hover:shadow-md hover:-translate-y-1 transition-all">
            <div className="text-3xl mb-2">💰</div>
            <h2 className="font-bold text-slate-800 text-sm">Kas RT</h2>
          </Link>
          <Link href="/admin/sampah" className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-emerald-700 hover:shadow-md hover:-translate-y-1 transition-all">
            <div className="text-3xl mb-2">♻️</div>
            <h2 className="font-bold text-slate-800 text-sm">Bank Sampah</h2>
          </Link>
          <Link href="/admin/kurban" className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-amber-700 hover:shadow-md hover:-translate-y-1 transition-all">
            <div className="text-3xl mb-2">🐄</div>
            <h2 className="font-bold text-slate-800 text-sm">Kurban</h2>
          </Link>
          <Link href="/admin/inventaris" className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-amber-600 hover:shadow-md hover:-translate-y-1 transition-all">
            <div className="text-3xl mb-2">🎪</div>
            <h2 className="font-bold text-slate-800 text-sm">Inventaris</h2>
          </Link>
        </div>

        {/* Data Tarikan API - Validasi Pendaftaran Warga Baru */}
        <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-slate-800">
          <h2 className="text-xl font-bold text-slate-700 mb-4 border-b pb-2 flex items-center gap-2">
            <span>Validasi Pendaftaran Warga Baru</span>
            <span className="bg-rose-500 text-white text-xs px-2 py-1 rounded-full">{wargaPending.length} Antrean</span>
          </h2>
          
          {loadingData ? (
            <div className="p-8 text-center text-slate-500 animate-pulse">Menghubungkan ke Server API...</div>
          ) : wargaPending.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg">
              <div className="text-3xl mb-2">✅</div>
              <h3 className="font-bold text-slate-800 mb-1">Semua Bersih!</h3>
              <p className="text-sm text-slate-500">Tidak ada pendaftaran warga baru yang menunggu persetujuan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="p-3 rounded-tl-lg">Nama Lengkap</th>
                    <th className="p-3">NIK</th>
                    <th className="p-3">Status Tinggal</th>
                    <th className="p-3 rounded-tr-lg text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {wargaPending.map((w) => (
                    <tr key={w.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{w.nama_lengkap}</td>
                      <td className="p-3 font-mono text-slate-500">{w.nik}</td>
                      <td className="p-3"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">{w.status_tinggal}</span></td>
                      <td className="p-3 text-right">
                        <Link href={`/admin/warga/${w.id}`} className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded font-bold text-xs transition-colors">Periksa</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}