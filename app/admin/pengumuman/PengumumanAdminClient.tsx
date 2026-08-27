"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PengumumanAdminClient({ adminAktif, pengumumanList, aksiSimpan, aksiEdit, aksiHapus }: { adminAktif: any, pengumumanList: any[], aksiSimpan: any, aksiEdit: any, aksiHapus: any }) {
  const router = useRouter();
  
  // STATE UNTUK FORM
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [linkDokumen, setLinkDokumen] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // STATE UNTUK MODE EDIT & HAPUS
  const [modeEditId, setModeEditId] = useState<string | null>(null);
  const [loadingHapusId, setLoadingHapusId] = useState<string | null>(null);

  // Memicu Form masuk ke Mode Edit
  const handleKlikEdit = (p: any) => {
    setModeEditId(p.id);
    setJudul(p.judul);
    setDeskripsi(p.deskripsi);
    setLinkDokumen(p.link_dokumen || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const batalkanEdit = () => {
    setModeEditId(null);
    setJudul("");
    setDeskripsi("");
    setLinkDokumen("");
  };

  // INJEKSI MUTLAK: FUNGSI RAKIT TEKS WHATSAPP
  const shareKeWhatsApp = (teksJudul: string, teksDeskripsi: string, teksLink: string) => {
    const pesan = `📢 *PENGUMUMAN RT 07* 📢\n\n*${teksJudul.toUpperCase()}*\n\n${teksDeskripsi}\n${teksLink ? `\n📂 *Lampiran Dokumen/Galeri:*\n${teksLink}` : ''}\n\n🌐 _Informasi ini juga dapat dilihat di Portal Digital Warga._`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(pesan)}`;
    window.open(waUrl, "_blank");
  };

  // EKSEKUSI SIMPAN / UPDATE
  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (linkDokumen && !linkDokumen.startsWith("http")) {
      alert("Format Ditolak: Link dokumen harus diawali dengan http:// atau https://");
      return;
    }

    setSubmitLoading(true);
    try {
      if (modeEditId) {
        await aksiEdit(modeEditId, judul, deskripsi, linkDokumen);
        alert("Sempurna! Pengumuman berhasil diperbarui.");
      } else {
        await aksiSimpan(judul, deskripsi, linkDokumen);
        
        // EFEK DOMINO: Trigger Langsung Share WA setelah buat baru!
        if (confirm("Sempurna! Pengumuman baru berhasil dipublikasikan di Portal.\n\nApakah Anda ingin langsung menyebarkannya ke Grup WhatsApp RT sekarang?")) {
          shareKeWhatsApp(judul, deskripsi, linkDokumen);
        }
      }
      
      batalkanEdit(); // Bersihkan form
      router.refresh();
    } catch (error: any) {
      alert("Terjadi kesalahan: " + error.message);
    }
    setSubmitLoading(false);
  };

  // EKSEKUSI HAPUS
  const handleHapus = async (id: string, judulPengumuman: string) => {
    if (!confirm(`YAKIN INGIN MENGHAPUS PERMANEN pengumuman "${judulPengumuman}"? Siaran ini akan hilang dari halaman warga.`)) return;
    
    setLoadingHapusId(id);
    try {
      await aksiHapus(id);
      if (modeEditId === id) batalkanEdit(); 
      router.refresh();
    } catch (error: any) {
      alert("Gagal menghapus: " + error.message);
    }
    setLoadingHapusId(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-blue-600 font-bold text-sm hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] mb-8 border border-slate-800">
          <h1 className="text-2xl md:text-3xl font-black text-white mb-2">Pusat Informasi RT 07</h1>
          <p className="text-slate-400 text-sm font-medium">Sebarkan, edit, atau tarik siaran edaran resmi dari portal warga.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* PANEL KIRI: FORM DINAMIS (CREATE/EDIT) */}
          <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 lg:col-span-1 h-fit transition-all duration-300 ${modeEditId ? 'ring-2 ring-amber-400 shadow-amber-100/50' : ''}`}>
            
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h2 className="font-black text-lg text-slate-800 flex items-center gap-2">
                {modeEditId ? "✏️ Edit Siaran" : "📢 Buat Siaran Baru"}
              </h2>
              {modeEditId && (
                <button type="button" onClick={batalkanEdit} className="text-[10px] bg-rose-50 text-rose-600 font-bold px-3 py-1.5 rounded hover:bg-rose-100 transition-colors uppercase tracking-widest">
                  Batal Edit
                </button>
              )}
            </div>

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
                <p className="text-[10px] text-slate-400 mt-2 font-medium">*Link GDrive otomatis menjadi Ikon Folder di portal.</p>
              </div>
              
              <button type="submit" disabled={submitLoading} className={`w-full h-12 flex items-center justify-center text-white font-bold rounded-lg shadow-md mt-6 transition-all active:scale-95 ${submitLoading ? 'bg-slate-300 cursor-not-allowed shadow-none' : (modeEditId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700')}`}>
                {submitLoading ? "Memproses..." : (modeEditId ? "Update Siaran" : "Sebarkan Sekarang")}
              </button>
            </form>
          </div>

          {/* PANEL KANAN: DAFTAR PENGUMUMAN */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 lg:col-span-2">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">📋 Riwayat Siaran Anda</h2>
            <div className="space-y-5">
              {pengumumanList.length === 0 ? (
                <div className="p-10 text-center text-slate-400 font-medium italic border border-dashed border-slate-300 rounded-xl bg-slate-50">Belum ada pengumuman yang disebarkan.</div>
              ) : (
                pengumumanList.map((p) => (
                  <div key={p.id} className={`p-6 border rounded-xl transition-all shadow-sm flex flex-col md:flex-row gap-6 ${modeEditId === p.id ? 'border-amber-400 bg-amber-50/30' : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-200 hover:shadow-md'}`}>
                    
                    {/* KONTEN PENGUMUMAN */}
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
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

                    {/* TOMBOL AKSI KANAN */}
                    <div className="flex flex-row md:flex-col gap-2 shrink-0 md:border-l md:border-slate-200 md:pl-6 pt-4 md:pt-0 border-t border-slate-200 md:border-t-0 justify-end md:justify-start">
                      
                      {/* INJEKSI MUTLAK: TOMBOL SHARE WA */}
                      <button 
                        onClick={() => shareKeWhatsApp(p.judul, p.deskripsi, p.link_dokumen)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-4 py-2.5 rounded shadow-sm transition-colors uppercase tracking-wider flex-1 md:flex-none text-center active:scale-95"
                      >
                        📲 Share WA
                      </button>

                      <button 
                        onClick={() => handleKlikEdit(p)} 
                        disabled={loadingHapusId === p.id}
                        className="bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-amber-600 text-[10px] font-bold px-4 py-2.5 rounded shadow-sm transition-colors uppercase tracking-wider disabled:opacity-50 flex-1 md:flex-none text-center"
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => handleHapus(p.id, p.judul)} 
                        disabled={loadingHapusId === p.id}
                        className="bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-rose-600 text-[10px] font-bold px-4 py-2.5 rounded shadow-sm transition-colors uppercase tracking-wider disabled:opacity-50 flex-1 md:flex-none text-center"
                      >
                        {loadingHapusId === p.id ? "⌛" : "🗑️ Hapus"}
                      </button>
                    </div>

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