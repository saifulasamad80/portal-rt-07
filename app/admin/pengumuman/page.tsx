"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminPengumuman() {
  const [pengumuman, setPengumuman] = useState<any[]>([]);
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [linkDokumen, setLinkDokumen] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  const [adminAktif, setAdminAktif] = useState<any>(null);
  const router = useRouter();

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pengumuman_rt")
      .select("*")
      .order("tanggal_publikasi", { ascending: false });
    
    if (!error) setPengumuman(data || []);
    setLoading(false);
  };

  useEffect(() => {
    const cekSesi = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin");
        return;
      }
      
      const { data: profil } = await supabase
        .from("pengurus_rt")
        .select("*")
        .eq("email", session.user.email)
        .single();

      if (profil) {
        setAdminAktif({ id: profil.id, nama: profil.nama_lengkap });
        fetchData();
      }
    };
    cekSesi();
  }, [router]);

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (linkDokumen && !linkDokumen.startsWith("http")) {
      alert("Format Ditolak: Link dokumen harus diawali dengan http:// atau https://");
      return;
    }

    setSubmitLoading(true);

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: "Buat Pengumuman Baru",
      tabel_target: "pengumuman_rt",
      detail: `Judul: ${judul}`
    }]);

    const { error } = await supabase.from("pengumuman_rt").insert([
      { judul, deskripsi, link_dokumen: linkDokumen }
    ]);

    if (error) {
      alert("Gagal mempublikasikan: " + error.message);
    } else {
      alert("Sempurna! Pengumuman berhasil dipublikasikan.");
      setJudul(""); setDeskripsi(""); setLinkDokumen(""); 
      fetchData(); 
    }
    setSubmitLoading(false);
  };

  if (!adminAktif) return null;
  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Membuka arsip pengumuman...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-blue-600 font-bold hover:underline">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-8 border-blue-800 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Pusat Informasi RT 07</h1>
            <p className="text-slate-500">Sebarkan surat edaran, undangan, dan pengumuman resmi ke portal warga.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-1 h-fit border-t-4 border-emerald-500">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Buat Siaran Baru</h2>
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Judul Pengumuman</label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900" placeholder="Cth: Undangan Kerja Bakti" value={judul} onChange={(e) => setJudul(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Isi Pesan / Deskripsi</label>
                <textarea required rows={5} className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900" placeholder="Tuliskan detail waktu, tempat, atau instruksinya di sini..." value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Link GDrive (Opsional)</label>
                <input type="url" className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm" placeholder="https://drive.google.com/..." value={linkDokumen} onChange={(e) => setLinkDokumen(e.target.value)} />
              </div>
              <button type="submit" disabled={submitLoading} className={`w-full text-white font-bold rounded-lg p-3 shadow-md mt-2 ${submitLoading ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {submitLoading ? "Mempublikasikan..." : "Sebarkan Sekarang"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg lg:col-span-2">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Riwayat Siaran Anda</h2>
            <div className="space-y-4">
              {pengumuman.length === 0 ? (
                <div className="p-6 text-center text-slate-400 font-bold italic border-2 border-dashed border-slate-200 rounded-lg">Belum ada pengumuman yang disebarkan.</div>
              ) : (
                pengumuman.map((p) => (
                  <div key={p.id} className="p-5 border border-slate-200 rounded-xl bg-slate-50 hover:bg-white transition-colors shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-slate-800 text-lg">{p.judul}</h3>
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded font-bold">
                        {new Date(p.tanggal_publikasi).toLocaleDateString('id-ID')}
                      </span>
                    </div>
                    <p className="text-slate-600 text-sm whitespace-pre-wrap mb-4 leading-relaxed">{p.deskripsi}</p>
                    {p.link_dokumen && (
                      <a href={p.link_dokumen} target="_blank" rel="noopener noreferrer" className="text-sm bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-bold hover:bg-blue-200 transition-colors inline-block shadow-sm">
                        📄 Buka Dokumen Lampiran
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}