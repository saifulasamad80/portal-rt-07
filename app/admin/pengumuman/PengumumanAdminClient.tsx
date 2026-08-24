"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PengumumanAdminClient({ adminAktif, pengumumanList, aksiSimpan }: { adminAktif: any, pengumumanList: any[], aksiSimpan: any }) {
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [linkDokumen, setLinkDokumen] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const router = useRouter();

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (linkDokumen && !linkDokumen.startsWith("http")) {
      alert("Format Ditolak: Link dokumen harus diawali dengan http:// atau https://");
      return;
    }

    setSubmitLoading(true);
    try {
      await aksiSimpan(judul, deskripsi, linkDokumen);
      alert("Sempurna! Pengumuman berhasil dipublikasikan.");
      setJudul(""); setDeskripsi(""); setLinkDokumen(""); 
      router.refresh();
    } catch (error: any) {
      alert("Gagal mempublikasikan: " + error.message);
    }
    setSubmitLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-blue-600 font-bold text-sm hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        {/* HEADER ADMIN PENGUMUMAN */}
        <div className="bg-slate-800 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-blue-500 mb-8">
          <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Pusat Informasi RT 07</h1>
          <p className="text-slate-300 text-sm">Sebarkan surat edaran, undangan, dan galeri resmi ke portal warga.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* FORM RILIS PENGUMUMAN */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit border-t-[6px] border-t-emerald-500">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3 flex items-center gap-2">📢 Buat Siaran Baru</h2>
            <form onSubmit={handleSimpan} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Judul Pengumuman</label>
                <input type="text" required className="w-full border-2 border-slate-200 rounded-lg p-3 text-slate-900 text-sm outline-none focus:border-blue-500 transition-colors" placeholder="Cth: Undangan Kerja Bakti" value={judul} onChange={(e) => setJudul(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Isi Pesan / Deskripsi</label>
                <textarea required rows={5} className="w-full border-2 border-slate-200 rounded-lg p-3 text-slate-900 text-sm outline-none focus:border-blue-500 transition-colors" placeholder="Tuliskan detail waktu, tempat, atau instruksinya di sini..." value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Link GDrive (Opsional)</label>
                <input type="url" className="w-full border-2 border-slate-200 rounded-lg p-3 text-slate-900 text-sm outline-none focus:border-blue-500 transition-colors" placeholder="https://drive.google.com/..." value={linkDokumen} onChange={(e) => setLinkDokumen(e.target.value)} />
                <p className="text-[10px] text-slate-400 font-bold mt-1.5">*Link GDrive akan otomatis menjadi Ikon Folder 📂 di halaman depan warga.</p>
              </div>
              <button type="submit" disabled={submitLoading} className={`w-full text-white font-black rounded-lg p-3.5 shadow-md mt-4 transition-colors ${submitLoading ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {submitLoading ? "Mempublikasikan..." : "Sebarkan Sekarang"}
              </button>
            </form>
          </div>

          {/* DAFTAR RIWAYAT SIARAN */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3 flex items-center gap-2">📋 Riwayat Siaran Anda</h2>
            <div className="space-y-4">
              {pengumumanList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold italic border-2 border-dashed border-slate-200 rounded-xl">Belum ada pengumuman yang disebarkan.</div>
              ) : (
                pengumumanList.map((p) => (
                  <div key={p.id} className="p-5 md:p-6 border-2 border-slate-100 rounded-xl bg-slate-50 hover:bg-white hover:border-blue-200 transition-colors shadow-sm">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
                      <h3 className="font-black text-slate-800 text-lg leading-tight">{p.judul}</h3>
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-3 py-1.5 rounded-md font-black uppercase tracking-widest shrink-0">
                        {new Date(p.tanggal_publikasi).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-slate-600 text-sm whitespace-pre-wrap mb-5 leading-relaxed bg-white p-4 rounded-lg border border-slate-100">{p.deskripsi}</p>
                    {p.link_dokumen && (
                      <a href={p.link_dokumen} target="_blank" rel="noopener noreferrer" className="text-xs bg-blue-100 text-blue-700 px-4 py-2.5 rounded-lg font-bold hover:bg-blue-200 transition-colors inline-flex items-center gap-2 shadow-sm w-fit">
                        <span>{p.link_dokumen.includes("drive.google.com") ? '📂 Buka Folder Galeri' : '📄 Buka Dokumen Lampiran'}</span>
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