"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";

export default function LapakClient({ wargaAktif, katalog, lapakKu, aksiBuat, aksiHapus }: { wargaAktif: any, katalog: any[], lapakKu: any[], aksiBuat: any, aksiHapus: any }) {
  const router = useRouter();
  const [tab, setTab] = useState<"katalog" | "lapak_saya">("katalog");
  const [loading, setLoading] = useState(false);

  // Form State
  const [namaUsaha, setNamaUsaha] = useState("");
  const [kategori, setKategori] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [wa, setWa] = useState("");
  const [fileFoto, setFileFoto] = useState<File | null>(null);

  const formatWA = (nomor: string) => {
    let bersih = nomor.replace(/\D/g, '');
    if (bersih.startsWith('0')) bersih = '62' + bersih.slice(1);
    return bersih;
  };

  const handleSimpanLapak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileFoto) return alert("Pilih satu foto brosur/produk andalan Anda!");
    
    setLoading(true);
    try {
      // Kompres ekstrem jadi max 100KB agar database ringan
      const options = { maxSizeMB: 0.1, maxWidthOrHeight: 800, useWebWorker: true, fileType: "image/jpeg" };
      const fileKompresi = await imageCompression(fileFoto, options);
      
      const fotoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(fileKompresi);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
      });

      await aksiBuat(namaUsaha, kategori, deskripsi, formatWA(wa), fotoBase64);
      alert("Lapak berhasil diajukan! Menunggu persetujuan Pengurus RT.");
      
      setNamaUsaha(""); setKategori(""); setDeskripsi(""); setWa(""); setFileFoto(null);
      setTab("lapak_saya");
      router.refresh();
    } catch (error: any) {
      alert("Gagal membuka lapak: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <Link href="/portal" className="text-orange-600 font-bold hover:underline mb-2 inline-block text-sm">&larr; Kembali ke Dasbor</Link>

        {/* HEADER */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-6 md:p-8 rounded-2xl shadow-lg text-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black mb-1">Pasar Warga RT 07</h1>
            <p className="text-orange-100 text-xs md:text-sm font-medium">Katalog Etalase UMKM. Pesan jasa & makanan langsung ke tetangga.</p>
          </div>
          <div className="text-5xl hidden md:block grayscale brightness-200">🏪</div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
          <button onClick={() => setTab("katalog")} className={`flex-1 py-3 text-sm font-black rounded-lg transition-all ${tab === "katalog" ? "bg-orange-100 text-orange-700" : "text-slate-500 hover:bg-slate-50"}`}>🛒 Katalog Lapak</button>
          <button onClick={() => setTab("lapak_saya")} className={`flex-1 py-3 text-sm font-black rounded-lg transition-all ${tab === "lapak_saya" ? "bg-orange-100 text-orange-700" : "text-slate-500 hover:bg-slate-50"}`}>🏪 Lapak Saya</button>
        </div>

        {/* TAB 1: KATALOG PASAR */}
        {tab === "katalog" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {katalog.length === 0 ? (
              <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
                <div className="text-4xl grayscale opacity-40 mb-3">🛍️</div>
                <p className="text-slate-500 font-bold">Belum ada lapak warga yang buka.</p>
              </div>
            ) : (
              katalog.map(k => (
                <div key={k.id} className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden flex flex-col hover:-translate-y-1 transition-transform">
                  <div className="h-48 bg-slate-100 relative overflow-hidden">
                    <img src={k.foto_url} alt={k.nama_usaha} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded">
                      {k.kategori}
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-lg font-black text-slate-800 leading-tight mb-1">{k.nama_usaha}</h3>
                    <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">Milik: {k.warga?.nama_lengkap}</p>
                    <p className="text-xs text-slate-600 mb-6 flex-1">{k.deskripsi}</p>
                    
                    <a href={`https://wa.me/${k.nomor_wa}?text=Halo%20tetangga,%20saya%20warga%20RT%2007%20melihat%20lapak%20*${encodeURIComponent(k.nama_usaha)}*%20di%20Portal.%20Saya%20ingin%20bertanya/memesan...`} 
                       target="_blank" rel="noopener noreferrer" 
                       className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-3.5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-md active:scale-95">
                      <span>💬</span> Hubungi Penjual
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: LAPAK SAYA */}
        {tab === "lapak_saya" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-orange-500 h-fit">
              <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-100 pb-3">Daftarkan Lapak UMKM</h2>
              <form onSubmit={handleSimpanLapak} className="space-y-4">
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Nama Usaha / Toko</label><input type="text" required className="w-full border border-slate-300 rounded-lg p-3 text-sm font-bold text-slate-800 outline-none focus:border-orange-500" placeholder="Cth: Katering Bu RT" value={namaUsaha} onChange={e => setNamaUsaha(e.target.value)} /></div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Kategori</label>
                  <select required className="w-full border border-slate-300 rounded-lg p-3 text-sm font-bold text-slate-800 outline-none focus:border-orange-500 bg-white" value={kategori} onChange={e => setKategori(e.target.value)}>
                    <option value="" disabled>Pilih Kategori...</option>
                    <option value="Makanan & Minuman">Makanan & Minuman</option>
                    <option value="Jasa & Servis">Jasa & Servis (AC, Pipa, dll)</option>
                    <option value="Sembako & Kebutuhan Harian">Sembako & Kebutuhan Harian</option>
                    <option value="Pakaian & Fashion">Pakaian & Fashion</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Deskripsi & Harga Singkat</label><textarea required rows={3} className="w-full border border-slate-300 rounded-lg p-3 text-sm text-slate-800 outline-none focus:border-orange-500" placeholder="Jual risol mayo isi daging. Harga Rp 5.000/pcs. Menerima pesanan arisan..." value={deskripsi} onChange={e => setDeskripsi(e.target.value)} /></div>
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Nomor WhatsApp Aktif</label><input type="tel" required className="w-full border border-slate-300 rounded-lg p-3 text-sm font-mono text-slate-800 outline-none focus:border-orange-500" placeholder="081234567890" value={wa} onChange={e => setWa(e.target.value.replace(/\D/g, ''))} /></div>
                
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                  <label className="block text-[11px] font-black text-orange-800 mb-2 uppercase">📸 Upload 1 Foto Andalan</label>
                  <input type="file" accept="image/*" required onChange={e => setFileFoto(e.target.files?.[0] || null)} className="w-full text-xs text-orange-900 font-medium" />
                  <p className="text-[9px] text-orange-600 mt-2 font-bold leading-relaxed">*Sistem hanya mengizinkan 1 foto brosur/produk. Pembeli yang tertarik akan meminta foto lainnya via WhatsApp.</p>
                </div>

                <button type="submit" disabled={loading} className={`w-full text-white font-black uppercase tracking-widest text-xs rounded-lg p-4 shadow-md transition-colors mt-2 ${loading ? 'bg-slate-400' : 'bg-orange-600 hover:bg-orange-700'}`}>
                  {loading ? "Menyimpan & Mengompresi Foto..." : "Ajukan Buka Lapak"}
                </button>
              </form>
            </div>

            <div className="space-y-4">
              {lapakKu.length === 0 ? (
                <div className="bg-slate-100 p-8 text-center rounded-2xl border border-dashed border-slate-300">
                  <p className="text-slate-400 text-sm font-bold">Anda belum mendaftarkan usaha apapun.</p>
                </div>
              ) : (
                lapakKu.map(k => (
                  <div key={k.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center md:items-start">
                    <img src={k.foto_url} alt={k.nama_usaha} className="w-24 h-24 object-cover rounded-xl shadow-sm shrink-0" />
                    <div className="flex-1 w-full">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-black text-slate-800 text-base">{k.nama_usaha}</h3>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shrink-0 ${k.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : k.status === 'Ditolak' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {k.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold mb-2 uppercase">{k.kategori}</p>
                      <button onClick={async () => {
                        if(confirm('Yakin ingin menghapus lapak ini?')) {
                          try { await aksiHapus(k.id); router.refresh(); } catch(e:any) { alert(e.message); }
                        }
                      }} className="text-[10px] font-bold text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded border border-rose-200 transition-colors w-full md:w-auto text-center mt-2">Tutup / Hapus Lapak</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}