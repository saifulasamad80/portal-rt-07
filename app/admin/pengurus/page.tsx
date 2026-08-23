"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminPengurus() {
  const [pengurus, setPengurus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [adminAktif, setAdminAktif] = useState<any>(null);
  const router = useRouter();

  // FAKTA: Tambahan state untuk mode Edit
  const [mode, setMode] = useState("tambah");
  const [editId, setEditId] = useState("");

  const [nama, setNama] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const fetchPengurus = async () => {
    setLoading(true);
    const { data } = await supabase.from("pengurus_rt").select("*").order("created_at", { ascending: true });
    if (data) setPengurus(data);
    setLoading(false);
  };

  useEffect(() => {
    const sesi = localStorage.getItem("admin_aktif");
    if (!sesi) {
      router.push("/admin");
      return;
    }
    setAdminAktif(JSON.parse(sesi));
    fetchPengurus();
  }, [router]);

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    if (mode === "tambah") {
      // LOGIKA BIKIN AKUN BARU
      const { data: cekUser } = await supabase.from("pengurus_rt").select("id").eq("username", username);
      if (cekUser && cekUser.length > 0) {
        alert("Username sudah digunakan! Silakan pilih username lain.");
        setSubmitLoading(false);
        return;
      }

      await supabase.from("audit_log").insert([{
        aktor: adminAktif.nama,
        aksi: `Registrasi Pengurus Baru`,
        tabel_target: "pengurus_rt",
        detail: `Nama: ${nama} | Jabatan: ${jabatan}`
      }]);

      const { error } = await supabase.from("pengurus_rt").insert([{
        nama_lengkap: nama, jabatan, username, password
      }]);

      if (error) alert("Gagal menambahkan pengurus: " + error.message);
      else {
        alert("Akun pengurus berhasil dibuat!");
        batalEdit();
        fetchPengurus();
      }

    } else {
      // LOGIKA UPDATE / EDIT AKUN
      const { data: cekUser } = await supabase.from("pengurus_rt").select("id").eq("username", username).neq("id", editId);
      if (cekUser && cekUser.length > 0) {
        alert("Username sudah digunakan oleh orang lain! Pilih yang lain.");
        setSubmitLoading(false);
        return;
      }

      await supabase.from("audit_log").insert([{
        aktor: adminAktif.nama,
        aksi: `Update Data Pengurus`,
        tabel_target: "pengurus_rt",
        detail: `Mengedit data/password akun: ${nama} (${jabatan})`
      }]);

      const { error } = await supabase.from("pengurus_rt").update({
        nama_lengkap: nama, jabatan, username, password
      }).eq("id", editId);

      if (error) alert("Gagal mengupdate pengurus: " + error.message);
      else {
        alert("Data pengurus berhasil diperbarui!");
        batalEdit();
        fetchPengurus();
      }
    }
    
    setSubmitLoading(false);
  };

  const klikEdit = (p: any) => {
    setMode("edit");
    setEditId(p.id);
    setNama(p.nama_lengkap);
    setJabatan(p.jabatan);
    setUsername(p.username);
    setPassword(p.password);
    // Scroll otomatis ke atas biar user nyadar formnya berubah
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const batalEdit = () => {
    setMode("tambah");
    setEditId("");
    setNama(""); setJabatan(""); setUsername(""); setPassword("");
  };

  const handleHapus = async (id: string, namaTarget: string, jabatanTarget: string) => {
    if (id === adminAktif.id) {
      alert("Ditolak! Anda tidak bisa menghapus akun Anda sendiri saat sedang login.");
      return;
    }
    
    if (!confirm(`YAKIN INGIN MENGHAPUS AKUN INI?\nNama: ${namaTarget}\nJabatan: ${jabatanTarget}`)) return;

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: `Penghapusan Akun Pengurus`,
      tabel_target: "pengurus_rt",
      detail: `Menghapus akun ${namaTarget} (${jabatanTarget})`
    }]);

    const { error } = await supabase.from("pengurus_rt").delete().eq("id", id);
    if (error) alert("Gagal menghapus: " + error.message);
    else fetchPengurus();
  };

  if (!adminAktif) return null;
  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Memuat struktur organisasi...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-indigo-600 font-bold hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-8 border-indigo-600 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Manajemen Akses Pengurus</h1>
            <p className="text-slate-500">Kelola akun RT, Sekretaris, Bendahara, dan Seksi lainnya.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* FORM MULTI-FUNGSI (TAMBAH & EDIT) */}
          <div className={`bg-white p-6 rounded-xl shadow-lg lg:col-span-1 h-fit border-t-4 ${mode === 'edit' ? 'border-amber-500 ring-2 ring-amber-200' : 'border-indigo-500'}`}>
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h2 className="font-bold text-lg text-slate-800">
                {mode === "edit" ? "Edit Data Pengurus" : "Buat Akun Baru"}
              </h2>
              {mode === "edit" && (
                <button type="button" onClick={batalEdit} className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2 py-1 rounded">Batal</button>
              )}
            </div>
            
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nama Lengkap</label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900" placeholder="Cth: Budi Santoso" value={nama} onChange={(e) => setNama(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Jabatan</label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900" placeholder="Cth: Bendahara" value={jabatan} onChange={(e) => setJabatan(e.target.value)} />
              </div>
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-sm font-bold text-slate-700 mb-1">Username Login</label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 font-mono" placeholder="Cth: bendahara07" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                <input type="password" required className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900" placeholder="Minimal 6 karakter" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button type="submit" disabled={submitLoading} className={`w-full text-white font-bold rounded-lg p-3 shadow-md transition-colors ${mode === 'edit' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {submitLoading ? "Memproses..." : (mode === "edit" ? "Simpan Perubahan" : "Beri Hak Akses")}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-2">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Daftar Pengurus Aktif</h2>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto relative">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-800 text-white">
                    <th className="p-3 border">Nama & Jabatan</th>
                    <th className="p-3 border">Kredensial Login</th>
                    <th className="p-3 border">Tgl Terdaftar</th>
                    <th className="p-3 border text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pengurus.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 border">
                        <div className="font-bold text-slate-800 text-base">{p.nama_lengkap}</div>
                        <div className="text-xs font-bold text-indigo-600 uppercase mt-0.5">{p.jabatan}</div>
                      </td>
                      <td className="p-3 border">
                        <div className="text-slate-600 font-mono text-xs">User: {p.username}</div>
                        <div className="text-slate-400 font-mono text-xs">Pass: ••••••••</div>
                      </td>
                      <td className="p-3 border text-slate-600">{new Date(p.created_at).toLocaleDateString('id-ID')}</td>
                      <td className="p-3 border text-center">
                        <div className="flex flex-col md:flex-row gap-2 justify-center items-center">
                          {/* FAKTA: Tombol Edit sekarang tersedia untuk semua, termasuk diri sendiri */}
                          <button onClick={() => klikEdit(p)} className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-[10px] font-bold px-3 py-1.5 rounded transition-colors w-full md:w-auto uppercase tracking-wider">
                            Edit
                          </button>

                          {p.id === adminAktif.id ? (
                            <span className="text-[10px] bg-slate-200 text-slate-500 font-bold px-2 py-1.5 rounded w-full md:w-auto text-center border border-slate-300">SAYA (AKTIF)</span>
                          ) : (
                            <button onClick={() => handleHapus(p.id, p.nama_lengkap, p.jabatan)} className="bg-rose-100 text-rose-700 hover:bg-rose-200 text-[10px] font-bold px-3 py-1.5 rounded transition-colors w-full md:w-auto uppercase tracking-wider">
                              Hapus
                            </button>
                          )}
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