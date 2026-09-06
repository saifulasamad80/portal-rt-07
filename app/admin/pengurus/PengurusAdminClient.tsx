"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PengurusAdminClient({ pengurusList, aksiTambah, aksiHapus, aksiReset }: { pengurusList: any[], aksiTambah: any, aksiHapus: any, aksiReset: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState("");

  const [nama, setNama] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await aksiTambah(nama, jabatan, email, password);
      if (res && !res.success) {
        alert("Gagal membuat akun pengurus: " + res.message);
      } else {
        setNama(""); setJabatan(""); setEmail(""); setPassword("");
        alert("Akun pengurus baru berhasil dibuat!");
        router.refresh();
      }
    } catch (error: any) { alert("Terjadi kesalahan sistem: " + error.message); }
    setLoading(false);
  };

  const handleHapus = async (id: string, namaTarget: string) => {
    if (!confirm(`PERINGATAN FATAL: Yakin ingin mencabut akses dan menghapus admin ${namaTarget}?`)) return;
    setLoadingId(id);
    try {
      const res = await aksiHapus(id);
      if (!res?.success) {
        alert(res?.message || "Akun pengurus gagal dihapus.");
      } else {
        alert(`Akses admin ${namaTarget} berhasil dihapus dari sistem!`);
        router.refresh();
      }
    } catch (error: any) { alert(error.message); }
    setLoadingId("");
  };

  const handleReset = async (id: string, namaTarget: string) => {
    const sandiBaru = prompt(`Masukkan PASSWORD BARU untuk admin ${namaTarget} (Minimal 8 karakter):`);
    if (!sandiBaru) return;
    if (sandiBaru.length < 8) return alert("GAGAL: Password baru harus minimal 8 karakter!");

    setLoadingId(id);
    try {
      const res = await aksiReset(id, sandiBaru);
      if (!res?.success) {
        alert(res?.message || "Sandi pengurus gagal diubah.");
      } else {
        alert(`Password untuk ${namaTarget} berhasil diperbarui!`);
        router.refresh();
      }
    } catch (error: any) { alert(error.message); }
    setLoadingId("");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link href="/admin" className="text-indigo-600 font-bold text-sm hover:underline mb-2 inline-block">&larr; Kembali ke Pusat Komando</Link>

        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-indigo-500 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Akses & Hak Pengurus</h1>
            <p className="text-slate-400 text-sm">Manajemen akun admin RT (Ketua, Sekretaris, Bendahara) yang berhak masuk ke Pusat Komando.</p>
          </div>
          <div className="text-5xl hidden md:block grayscale brightness-200">👔</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit border-t-[6px] border-t-indigo-500">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">🛡️ Tambah Akun Admin</h2>
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Nama Lengkap</label>
                <input type="text" required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-indigo-500 text-sm font-bold" value={nama} onChange={(e) => setNama(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Jabatan Struktural</label>
                <input type="text" required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-indigo-500 text-sm" placeholder="Cth: Bendahara Umum" value={jabatan} onChange={(e) => setJabatan(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Email (Untuk Login)</label>
                <input type="email" required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-indigo-500 text-sm" placeholder="bendahara@rt07.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Password Akses</label>
                <input type="password" required minLength={8} className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-indigo-500 text-sm" placeholder="******" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button type="submit" disabled={loading} className={`w-full text-white font-black rounded-lg p-3.5 shadow-md mt-4 transition-colors ${loading ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {loading ? "Membuat Akun..." : "Terbitkan Akses"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 h-fit">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">📋 Daftar Pejabat RT (Admin)</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-100 text-slate-700 text-xs">
                  <tr>
                    <th className="p-4 border-b-2 border-slate-200">Nama & Jabatan</th>
                    <th className="p-4 border-b-2 border-slate-200">Email Login</th>
                    <th className="p-4 border-b-2 border-slate-200 text-center">Aksi (Webmaster)</th>
                  </tr>
                </thead>
                <tbody>
                  {pengurusList.map((p) => (
                    <tr key={p.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                      <td className="p-4 align-top">
                        <div className="font-black text-slate-800 text-base">{p.nama_lengkap}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-sm w-fit mt-1.5 shadow-sm">
                          {p.jabatan}
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="font-mono text-xs font-bold text-slate-600">{p.email}</div>
                        <div className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-widest">
                          Join: {p.created_at ? new Date(p.created_at).toLocaleDateString('id-ID', {day:'2-digit', month:'long', year:'numeric'}) : '-'}
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-col gap-2">
                          <button onClick={() => handleReset(p.id, p.nama_lengkap)} disabled={loadingId === p.id} className="bg-amber-100 hover:bg-amber-500 hover:text-white text-amber-700 border border-amber-200 text-[10px] font-black px-4 py-2 rounded transition-colors shadow-sm disabled:opacity-50 uppercase tracking-wider w-full">
                            {loadingId === p.id ? '...' : 'Reset Sandi'}
                          </button>
                          <button onClick={() => handleHapus(p.id, p.nama_lengkap)} disabled={loadingId === p.id} className="bg-rose-100 hover:bg-rose-500 hover:text-white text-rose-600 border border-rose-200 text-[10px] font-black px-4 py-2 rounded transition-colors shadow-sm disabled:opacity-50 uppercase tracking-wider w-full">
                            {loadingId === p.id ? '...' : 'Hapus Akun'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}