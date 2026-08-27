"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";

export default function LapakClient({ wargaAktif, katalog, lapakKu, aksiBuat, aksiHapus }: { wargaAktif: any, katalog: any[], lapakKu: any[], aksiBuat: any, aksiHapus: any }) {
  const router = useRouter();
  const [tab, setTab] = useState<"katalog" | "lapak_saya">("katalog");
  const [loading, setLoading] = useState(false);

  const [namaUsaha, setNamaUsaha] = useState("");
  const [kategori, setKategori] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [wa, setWa] = useState("");
  const [fileFoto, setFileFoto] = useState<File | null>(null);

  // INJEKSI MUTLAK: Hitung jumlah lapak milik warga ini
  const jumlahLapakKu = lapakKu.length;
  const MAKSIMAL_LAPAK = 2;
  const kuotaHabis = jumlahLapakKu >= MAKSIMAL_LAPAK;

  const formatWA = (nomor: string) => {
    let bersih = nomor.replace(/\D/g, '');
    if (bersih.startsWith('0')) bersih = '62' + bersih.slice(1);
    return bersih;
  };

  const handleSimpanLapak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (kuotaHabis) return alert("Batas maksimal kepemilikan lapak telah tercapai!");
    if (!fileFoto) return alert("Pilih satu foto brosur/produk andalan Anda!");
    
    setLoading(true);
    try {
      // FIX: useWebWorker: false (Mencegah Corrupted Blob di HP kentang)
      const options = { maxSizeMB: 0.1, maxWidthOrHeight: 800, useWebWorker: false, fileType: "image/jpeg" };
      const fileKompresi = await imageCompression(fileFoto, options);
      
      const fotoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(fileKompresi);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
      });

      // FIX: Payload dibungkus Object
      await aksiBuat({
        namaUsaha: namaUsaha,
        kategori: kategori,
        deskripsi: deskripsi,
        wa: formatWA(wa),
        fotoBase64: fotoBase64
      });

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
            
            <div className="space-y-6 h-fit">
              {/* PANEL ATURAN MAIN (INJEKSI MUTLAK) */}
              <div className="bg-orange-50 border border-orange-200 p-6 rounded-2xl shadow-sm">
                <h3 className="font-black text-orange-800 text-sm mb-3 uppercase tracking-widest flex items-center gap-2">
                  <span>📜</span> Aturan Pasar Warga
                </h3>
                <ul className="text-xs text-orange-900 space-y-2.5 leading-relaxed font-medium">
                  <li><strong className="text-orange-700">1. Kuota Lapak:</strong> Setiap KK hanya diizinkan memiliki maksimal <strong>{MAKSIMAL_LAPAK} Lapak Aktif</strong> secara bersamaan.</li>
                  <li><strong className="text-orange-700">2. Etalase Toko:</strong> Pasang iklan berupa <strong>Nama Usaha/Jasa</strong> (Contoh: "Katering Bu Ani"), BUKAN barang satuan (Contoh: "Jual Risol 1 biji").</li>
                  <li><strong className="text-orange-700">3. Transaksi:</strong> Seluruh komunikasi & pembayaran dilakukan secara pribadi melalui tombol WhatsApp.</li>
                  <li><strong className="text-orange-700">4. Perubahan Data:</strong> Jika ingin mengganti usaha, hapus lapak lama Anda terlebih dahulu untuk mengosongkan kuota.</li>
                </ul>
              </div>

              {/* DAFTAR LAPAK MILIK SENDIRI */}
              <div className="space-y-4">
                <h3 className="font-black text-slate-800 text-sm border-b border-slate-200 pb-2">Lapak Anda Saat Ini ({jumlahLapakKu}/{MAKSIMAL_LAPAK})</h3>
                {lapakKu.length === 0 ? (
                  <div className="bg-slate-100 p-8 text-center rounded-2xl border border-dashed border-slate-300">
                    <p className="text-slate-400 text-sm font-bold">Anda belum mendaftarkan usaha apapun.</p>
                  </div>
                ) : (
                  lapakKu.map(k => (
                    <div key={k.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center md:items-start transition-all hover:border-orange-300">
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
                          if(confirm('Yakin ingin menghapus lapak ini secara permanen?')) {
                            try { await aksiHapus(k.id); router.refresh(); } catch(e:any) { alert(e.message); }
                          }
                        }} className="text-[10px] font-bold text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded border border-rose-200 transition-colors w-full md:w-auto text-center mt-2 shadow-sm active:scale-95">
                          Tutup / Hapus Lapak
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* FORM PENDAFTARAN LAPAK */}
            <div className={`bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] ${kuotaHabis ? 'border-t-slate-400 opacity-80' : 'border-t-orange-500'} h-fit relative overflow-hidden`}>
              
              {/* OVERLAY JIKA KUOTA HABIS */}
              {kuotaHabis && (
                <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-6">
                  <div className="text-4xl mb-3">🔒</div>
                  <h3 className="font-black text-slate-800 text-lg">Kuota Lapak Penuh</h3>
                  <p className="text-xs font-bold text-slate-600 mt-2">Anda sudah memiliki {MAKSIMAL_LAPAK} lapak yang terdaftar. Hapus salah satu lapak Anda untuk membuka pendaftaran baru.</p>
                </div>
              )}

              <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-100 pb-3">Daftarkan Lapak UMKM</h2>
              <form onSubmit={handleSimpanLapak} className="space-y-4">
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Nama Usaha / Toko</label><input type="text" required disabled={kuotaHabis} className="w-full border border-slate-300 rounded-lg p-3 text-sm font-bold text-slate-800 outline-none focus:border-orange-500 disabled:bg-slate-100" placeholder="Cth: Katering Bu RT" value={namaUsaha} onChange={e => setNamaUsaha(e.target.value)} /></div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Kategori</label>
                  <select required disabled={kuotaHabis} className="w-full border border-slate-300 rounded-lg p-3 text-sm font-bold text-slate-800 outline-none focus:border-orange-500 bg-white disabled:bg-slate-100" value={kategori} onChange={e => setKategori(e.target.value)}>
                    <option value="" disabled>Pilih Kategori...</option>
                    <option value="Makanan & Minuman">Makanan & Minuman</option>
                    <option value="Jasa & Servis">Jasa & Servis (AC, Pipa, dll)</option>
                    <option value="Sembako & Kebutuhan Harian">Sembako & Kebutuhan Harian</option>
                    <option value="Pakaian & Fashion">Pakaian & Fashion</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Deskripsi & Harga Singkat</label><textarea required disabled={kuotaHabis} rows={3} className="w-full border border-slate-300 rounded-lg p-3 text-sm text-slate-800 outline-none focus:border-orange-500 disabled:bg-slate-100" placeholder="Jual risol mayo isi daging. Menerima pesanan arisan..." value={deskripsi} onChange={e => setDeskripsi(e.target.value)} /></div>
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Nomor WhatsApp Aktif</label><input type="tel" required disabled={kuotaHabis} className="w-full border border-slate-300 rounded-lg p-3 text-sm font-mono text-slate-800 outline-none focus:border-orange-500 disabled:bg-slate-100" placeholder="081234567890" value={wa} onChange={e => setWa(e.target.value.replace(/\D/g, ''))} /></div>
                
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                  <label className="block text-[11px] font-black text-orange-800 mb-2 uppercase">📸 Upload 1 Foto Andalan</label>
                  <input type="file" accept="image/*" required disabled={kuotaHabis} onChange={e => setFileFoto(e.target.files?.[0] || null)} className="w-full text-xs text-orange-900 font-medium disabled:opacity-50" />
                  <p className="text-[9px] text-orange-600 mt-2 font-bold leading-relaxed">*Sistem hanya mengizinkan 1 foto brosur/produk. Pembeli yang tertarik akan meminta foto lainnya via WhatsApp.</p>
                </div>

                <button type="submit" disabled={loading || kuotaHabis} className={`w-full text-white font-black uppercase tracking-widest text-xs rounded-lg p-4 shadow-md transition-all mt-2 active:scale-95 ${loading || kuotaHabis ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-orange-600 hover:bg-orange-700'}`}>
                  {loading ? "Menyimpan & Mengompresi..." : "Ajukan Buka Lapak"}
                </button>
              </form>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}