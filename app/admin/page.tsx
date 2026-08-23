"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const [warga, setWarga] = useState<any[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [adminAktif, setAdminAktif] = useState<any>(null);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    cekSesi();
  }, []);

  const cekSesi = async () => {
    setIsInitializing(true); 
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      const { data: profil } = await supabase
        .from("pengurus_rt")
        .select("*")
        .eq("email", session.user.email)
        .single();

      if (profil) {
        setAdminAktif({ id: profil.id, nama: profil.nama_lengkap, jabatan: profil.jabatan, email: profil.email });
        fetchWarga();
      } else {
        setIsInitializing(false);
      }
    } else {
      setIsInitializing(false);
    }
  };

  const handleLoginAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error || !data.user) {
      alert("Akses Ditolak! Kredensial tidak valid.");
      setLoginLoading(false);
    } else {
      const { data: profil } = await supabase
        .from("pengurus_rt")
        .select("*")
        .eq("email", email)
        .single();

      if (profil) {
        setAdminAktif({ id: profil.id, nama: profil.nama_lengkap, jabatan: profil.jabatan, email: profil.email });
        fetchWarga();
      } else {
        alert("Sistem Error: Akun Auth tidak tertaut ke Profil Pengurus.");
      }
      setLoginLoading(false);
    }
  };

  const handleLogoutAdmin = async () => {
    if (confirm("Tutup Pusat Komando dan kembali ke halaman utama?")) {
      await supabase.auth.signOut();
      setAdminAktif(null);
      router.push("/");
    }
  };

  const fetchWarga = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("warga")
      .select("*, anggota_keluarga(*)")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Gagal menarik data: " + error.message);
    } else {
      setWarga(data || []);
    }
    setLoading(false);
    setIsInitializing(false); 
  };

  const updateStatus = async (id: string, statusBaru: string) => {
    const konfirmasi = confirm(`Yakin ingin mengubah status warga ini menjadi: ${statusBaru}?`);
    if (!konfirmasi) return;

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: `Ubah Status Warga: ${statusBaru}`,
      tabel_target: "warga",
      detail: `ID Warga: ${id}`
    }]);

    const { error } = await supabase
      .from("warga")
      .update({ status_verifikasi: statusBaru })
      .eq("id", id);

    if (error) alert("Gagal update status: " + error.message);
    else fetchWarga();
  };

  const hapusWarga = async (id: string, namaLengkap: string) => {
    const konfirmasi = confirm(`PERINGATAN FATAL: Yakin ingin MENGHAPUS PERMANEN warga bernama ${namaLengkap}?`);
    if (!konfirmasi) return;

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: `Hapus Permanen Warga`,
      tabel_target: "warga",
      detail: `Menghapus warga: ${namaLengkap}`
    }]);

    const { error } = await supabase.from("warga").delete().eq("id", id);

    if (error) {
      alert("GAGAL MENGHAPUS: Warga ini kemungkinan sudah memiliki riwayat transaksi.\n\nDetail Error: " + error.message);
    } else {
      fetchWarga();
    }
  };

  // FAKTA: Fungsi penembus brankas dokumen Private
  const lihatDokumen = async (path: string, tipe: string) => {
    if (!path) {
      alert("Dokumen tidak ditemukan di database.");
      return;
    }
    if (path === "MENYUSUL") {
      alert(`Warga belum mengunggah ${tipe} (Status: Menyusul Fisik).`);
      return;
    }

    // Generate URL yang hanya valid selama 60 detik untuk mencegah kebocoran link
    const { data, error } = await supabase.storage.from('dokumen_warga').createSignedUrl(path, 60);
    
    if (error) {
      alert("Akses ditolak oleh brankas Supabase: " + error.message);
    } else if (data) {
      // Buka dokumen di tab baru
      window.open(data.signedUrl, '_blank');
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 font-mono text-emerald-500">
        <div className="text-4xl mb-4 animate-spin">⚙️</div>
        <div className="font-bold tracking-widest uppercase">OTENTIKASI SISTEM...</div>
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
              <label className="block text-xs font-bold text-slate-600 mb-1">Email Pengurus</label>
              <input type="email" required className="w-full border-2 border-slate-300 rounded-lg p-3 outline-none focus:border-emerald-500 transition-colors" placeholder="Masukkan email resmi..." value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Password</label>
              <input type="password" required className="w-full border-2 border-slate-300 rounded-lg p-3 outline-none focus:border-emerald-500 transition-colors" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          <button type="submit" disabled={loginLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg">
            {loginLoading ? "Memverifikasi..." : "Otorisasi Masuk"}
          </button>
          <button type="button" onClick={() => router.push("/")} className="w-full text-slate-400 font-bold py-3 mt-2 hover:text-slate-600 transition-colors">Batal</button>
        </form>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500 bg-slate-200">Memuat brankas data RT...</div>;

  return (
    <div className="min-h-screen bg-slate-200 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="bg-slate-800 p-6 rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-center text-white border-l-8 border-emerald-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-xl font-black">
              {adminAktif.nama.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-black mb-0 leading-none">{adminAktif.nama}</h1>
              <p className="text-emerald-400 font-bold text-sm mt-1">{adminAktif.jabatan} | RT 07</p>
            </div>
          </div>
          <button onClick={handleLogoutAdmin} className="mt-4 md:mt-0 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow">
            Keluar Sesi
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Link href="/admin/warga" className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-blue-600 hover:shadow-md hover:-translate-y-1 transition-all">
            <div className="text-3xl mb-2">👥</div>
            <h2 className="font-bold text-slate-800 text-sm">Induk Warga</h2>
            <p className="text-[10px] text-slate-500 mt-1">Data & NIK</p>
          </Link>
          <Link href="/admin/kas" className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-emerald-500 hover:shadow-md hover:-translate-y-1 transition-all">
            <div className="text-3xl mb-2">💰</div>
            <h2 className="font-bold text-slate-800 text-sm">Kas RT</h2>
            <p className="text-[10px] text-slate-500 mt-1">Rekap iuran</p>
          </Link>
          <Link href="/admin/sampah" className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-emerald-700 hover:shadow-md hover:-translate-y-1 transition-all">
            <div className="text-3xl mb-2">♻️</div>
            <h2 className="font-bold text-slate-800 text-sm">Bank Sampah</h2>
            <p className="text-[10px] text-slate-500 mt-1">Manajemen saldo</p>
          </Link>
          <Link href="/admin/kurban" className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-amber-700 hover:shadow-md hover:-translate-y-1 transition-all">
            <div className="text-3xl mb-2">🐄</div>
            <h2 className="font-bold text-slate-800 text-sm">Kurban</h2>
            <p className="text-[10px] text-slate-500 mt-1">Tabungan Idul Adha</p>
          </Link>
          <Link href="/admin/inventaris" className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-amber-600 hover:shadow-md hover:-translate-y-1 transition-all">
            <div className="text-3xl mb-2">🎪</div>
            <h2 className="font-bold text-slate-800 text-sm">Inventaris</h2>
            <p className="text-[10px] text-slate-500 mt-1">Setujui peminjaman</p>
          </Link>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-slate-800">
          <h2 className="text-xl font-bold text-slate-700 mb-4 border-b pb-2">Validasi Pendaftaran Warga Baru</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-sm">
                  <th className="p-3 border">Nama & Kontak</th>
                  <th className="p-3 border">Dokumen Warga</th>
                  <th className="p-3 border">Status & Alamat</th>
                  <th className="p-3 border text-center">Status Saat Ini</th>
                  <th className="p-3 border text-center">Aksi (Validasi)</th>
                </tr>
              </thead>
              <tbody>
                {warga.map((w) => (
                  <tr key={w.id} className="border-b hover:bg-slate-50 text-sm">
                    <td className="p-3 border">
                      <div className="font-bold text-slate-800">{w.nama_lengkap}</div>
                      <div className="text-xs text-slate-600 font-mono mt-1">NIK: {w.nik}</div>
                      <div className="text-xs text-slate-600">WA: {w.no_whatsapp}</div>
                    </td>
                    
                    {/* FAKTA: Blok Tombol Buka KTP & KK */}
                    <td className="p-3 border">
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => lihatDokumen(w.ktp_path, 'KTP')} 
                          className={`flex items-center justify-center gap-1 text-[10px] px-2 py-1.5 rounded font-bold w-full transition-colors border ${w.ktp_path === 'MENYUSUL' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                        >
                          📸 {w.ktp_path === 'MENYUSUL' ? 'KTP Menyusul' : 'Cek KTP'}
                        </button>
                        <button 
                          onClick={() => lihatDokumen(w.kk_path, 'KK')} 
                          className={`flex items-center justify-center gap-1 text-[10px] px-2 py-1.5 rounded font-bold w-full transition-colors border ${w.kk_path === 'MENYUSUL' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'}`}
                        >
                          📸 {w.kk_path === 'MENYUSUL' ? 'KK Menyusul' : 'Cek KK'}
                        </button>
                      </div>
                    </td>

                    <td className="p-3 border">
                      <span className="bg-slate-100 text-slate-700 border border-slate-300 text-[10px] px-2 py-1 rounded font-bold uppercase">{w.status_tinggal}</span>
                      <div className="text-xs mt-1 text-slate-600">{w.detail_alamat}</div>
                    </td>
                    <td className="p-3 border font-bold text-center">
                      {w.status_verifikasi === 'Disetujui' && <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 block">Disetujui</span>}
                      {w.status_verifikasi === 'Ditolak' && <span className="text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-200 block">Ditolak</span>}
                      {w.status_verifikasi === 'Menunggu' && <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200 block">Menunggu</span>}
                    </td>
                    <td className="p-3 border text-center">
                      {w.status_verifikasi === 'Menunggu' ? (
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => updateStatus(w.id, 'Disetujui')} className="bg-emerald-500 text-white text-xs px-3 py-1.5 rounded shadow hover:bg-emerald-600 font-bold">Sah</button>
                          <button onClick={() => updateStatus(w.id, 'Ditolak')} className="bg-rose-500 text-white text-xs px-3 py-1.5 rounded shadow hover:bg-rose-600 font-bold">Tolak</button>
                          <button onClick={() => hapusWarga(w.id, w.nama_lengkap)} className="bg-slate-700 text-white text-xs px-3 py-1.5 rounded shadow hover:bg-slate-800 font-bold">Hapus</button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 items-center">
                          <span className="text-[10px] uppercase text-slate-400 font-bold mb-1">Tervalidasi</span>
                          <div className="flex gap-1">
                            {w.status_verifikasi === 'Disetujui' ? (
                              <button onClick={() => updateStatus(w.id, 'Menunggu')} className="bg-amber-500 text-white text-[10px] px-2 py-1 rounded shadow hover:bg-amber-600 font-bold">Batal Setuju</button>
                            ) : (
                              <button onClick={() => updateStatus(w.id, 'Menunggu')} className="bg-blue-500 text-white text-[10px] px-2 py-1 rounded shadow hover:bg-blue-600 font-bold">Tinjau Ulang</button>
                            )}
                            <button onClick={() => hapusWarga(w.id, w.nama_lengkap)} className="bg-rose-600 text-white text-[10px] px-2 py-1 rounded shadow hover:bg-rose-700 font-bold">Hapus</button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}