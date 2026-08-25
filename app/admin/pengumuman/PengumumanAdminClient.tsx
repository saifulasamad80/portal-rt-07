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

        {/* REVISI UX: Hapus border-l-[12px] */}
        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] mb-8 border border-slate-800">
          <h1 className="text-2xl md:text-3xl font-black text-white mb-2">Pusat Informasi RT 07</h1>
          <p className="text-slate-400 text-sm font-medium">Sebarkan surat edaran, undangan, dan galeri resmi ke portal warga.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* REVISI UX: Hapus border-t-[6px] */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 lg:col-span-1 h-fit">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">📢 Buat Siaran Baru</h2>
            <form onSubmit={handleSimpan} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Judul Pengumuman</label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors bg-slate-50 focus:bg-white" placeholder="Cth: Undangan Kerja Bakti" value={judul} onChange={(e) => setJudul(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Isi Pesan / Deskripsi</label>
                <textarea required rows={5} className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors bg-slate-50 focus:bg-white" placeholder="Tuliskan detail waktu, tempat, atau instruksinya di sini..." value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Link GDrive (Opsional)</label>
                <input type="url" className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors bg-slate-50 focus:bg-white" placeholder="https://drive.google.com/..." value={linkDokumen} onChange={(e) => setLinkDokumen(e.target.value)} />
                <p className="text-[10px] text-slate-400 mt-2 font-medium">*Link GDrive akan otomatis menjadi Ikon Folder 📂 di halaman depan warga.</p>
              </div>
              <button type="submit" disabled={submitLoading} className={`w-full h-12 flex items-center justify-center text-white font-bold rounded-lg shadow-md mt-6 transition-all active:scale-95 ${submitLoading ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {submitLoading ? "Mempublikasikan..." : "Sebarkan Sekarang"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 lg:col-span-2">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">📋 Riwayat Siaran Anda</h2>
            <div className="space-y-5">
              {pengumumanList.length === 0 ? (
                <div className="p-10 text-center text-slate-400 font-medium italic border border-dashed border-slate-300 rounded-xl bg-slate-50">Belum ada pengumuman yang disebarkan.</div>
              ) : (
                pengumumanList.map((p) => (
                  <div key={p.id} className="p-6 border border-slate-100 rounded-xl bg-slate-50 hover:bg-white hover:border-blue-200 transition-all shadow-sm hover:shadow-md">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
                      <h3 className="font-black text-slate-800 text-lg leading-tight">{p.judul}</h3>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full font-black uppercase tracking-widest shrink-0">
                        {new Date(p.tanggal_publikasi).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-slate-600 text-sm whitespace-pre-wrap mb-5 leading-relaxed">{p.deskripsi}</p>
                    {p.link_dokumen && (
                      <a href={p.link_dokumen} target="_blank" rel="noopener noreferrer" className="text-xs bg-white border border-slate-200 text-blue-700 px-5 py-2.5 rounded-lg font-bold hover:bg-blue-50 transition-colors inline-flex items-center gap-2 shadow-sm w-fit active:scale-95">
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