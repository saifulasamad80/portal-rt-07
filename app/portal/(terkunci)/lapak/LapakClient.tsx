"use client";
import { useState } from "react";
import TautanHalus from "@/components/TautanHalus";
import { useRouter } from "next/navigation";
import PesanDialog, { type PesanDialogData } from "@/components/PesanDialog";
import { kompresGambarKeDataUrl } from "@/lib/kompresi-gambar-klien";

export default function LapakClient({ wargaAktif, nomorWaDefault, katalog, lapakKu, orderanJasa, aksiBuat, aksiHapus, aksiSelesaikanOrder }: { wargaAktif: any, nomorWaDefault: string, katalog: any[], lapakKu: any[], orderanJasa: any[], aksiBuat: any, aksiHapus: any, aksiSelesaikanOrder: any }) {
  const router = useRouter();
  const [tab, setTab] = useState<"katalog" | "lapak_saya" | "order_servis">("katalog");
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<PesanDialogData | null>(null);

  // Form Lapak Baru
  const [namaUsaha, setNamaUsaha] = useState("");
  const [kategori, setKategori] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [wa, setWa] = useState(nomorWaDefault);
  const [fileFoto, setFileFoto] = useState<File | null>(null);

  // Cek apakah warga ini buka Jasa Servis (Kasta VIP)
  const isJasaProfesional = lapakKu.some(l => l.kategori === "Jasa & Servis");
  const jumlahLapakKu = lapakKu.length;
  const MAKSIMAL_LAPAK = 2;
  const kuotaHabis = jumlahLapakKu >= MAKSIMAL_LAPAK;

  const formatWA = (nomor: string) => { let bersih = nomor?.replace(/\D/g, '') || ''; if (bersih.startsWith('0')) bersih = '62' + bersih.slice(1); return bersih; };
  const formatRp = (angka: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

  const handleSimpanLapak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (kuotaHabis) {
      setPesan({
        tipe: "gagal",
        judul: "Lapak belum dapat dibuka",
        teks: "Batas maksimal kepemilikan lapak telah tercapai.",
      });
      return;
    }
    if (!fileFoto) {
      setPesan({
        tipe: "gagal",
        judul: "Foto lapak belum dipilih",
        teks: "Pilih satu foto brosur atau produk andalan Anda sebelum mengirim.",
      });
      return;
    }
    
    setLoading(true);
    try {
      const fotoBase64 = await kompresGambarKeDataUrl(fileFoto, "fotoLapak");

      await aksiBuat({ namaUsaha, kategori, deskripsi, wa: formatWA(wa), fotoBase64 });
      setPesan({
        tipe: "sukses",
        judul: "Lapak berhasil diajukan",
        teks: "Lapak Anda menunggu persetujuan Pengurus RT.",
      });
      
      setNamaUsaha(""); setKategori(""); setDeskripsi(""); setWa(nomorWaDefault); setFileFoto(null);
      setTab("lapak_saya");
      router.refresh();
    } catch (error: unknown) {
      setPesan({
        tipe: "gagal",
        judul: "Lapak belum dapat dibuka",
        teks: error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui.",
      });
    }
    setLoading(false);
  };

  const handleSelesaikanOrder = async (idBarang: string, isGagal: boolean) => {
    let biaya = 0;
    if (!isGagal) {
      const inputBiaya = prompt("Masukkan TOTAL TAGIHAN REPARASI (Tanpa titik/koma, contoh: 150000)\n\nSistem akan otomatis memotong 10% untuk Kas RT.");
      if (!inputBiaya) return;
      biaya = parseInt(inputBiaya);
      if (isNaN(biaya) || biaya < 1000) {
        setPesan({
          tipe: "gagal",
          judul: "Biaya reparasi tidak valid",
          teks: "Masukkan nominal angka minimal Rp1.000 tanpa titik atau koma.",
        });
        return;
      }
      if (!confirm(`Total Tagihan: Rp ${biaya.toLocaleString('id-ID')}\nFee Kas RT (10%): Rp ${(biaya * 0.1).toLocaleString('id-ID')}\nPenghasilan Bersih Anda: Rp ${(biaya * 0.9).toLocaleString('id-ID')}\n\nLanjutkan?`)) return;
    } else {
      if (!confirm("Barang tidak bisa diperbaiki? Sistem akan mengembalikannya ke Gudang Rak Bin.")) return;
    }

    setLoading(true);
    try {
      await aksiSelesaikanOrder(idBarang, biaya, isGagal);
      setPesan({
        tipe: "sukses",
        judul: isGagal ? "Barang dikembalikan" : "Order reparasi selesai",
        teks: isGagal
          ? "Barang sudah dikembalikan ke Gudang Rak Bin."
          : "Order selesai. Hubungi pemilik barang untuk pembayaran.",
      });
      router.refresh();
    } catch (error: unknown) {
      setPesan({
        tipe: "gagal",
        judul: "Order belum dapat diproses",
        teks: error instanceof Error ? error.message : "Terjadi kesalahan yang tidak diketahui.",
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <TautanHalus href="/portal" className="text-orange-600 font-bold hover:underline mb-2 inline-block text-sm">&larr; Kembali ke Dasbor</TautanHalus>

        {/* HEADER */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-6 md:p-8 rounded-2xl shadow-lg text-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black mb-1">Pasar Warga RT 07</h1>
            <p className="text-orange-100 text-xs md:text-sm font-medium">Katalog Etalase UMKM. Pesan jasa & makanan langsung ke tetangga.</p>
          </div>
          <div className="text-5xl hidden md:block grayscale brightness-200">🏪</div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex flex-wrap bg-white rounded-xl shadow-sm border border-slate-200 p-1">
          <button onClick={() => setTab("katalog")} className={`flex-1 py-3 text-xs md:text-sm font-black rounded-lg transition-all min-w-[120px] ${tab === "katalog" ? "bg-orange-100 text-orange-700 shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>🛒 Katalog Lapak</button>
          <button onClick={() => setTab("lapak_saya")} className={`flex-1 py-3 text-xs md:text-sm font-black rounded-lg transition-all min-w-[120px] ${tab === "lapak_saya" ? "bg-orange-100 text-orange-700 shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>🏪 Lapak Saya</button>
          
          {/* TAB RAHASIA: KHUSUS TUKANG / JASA PROFESIONAL */}
          {isJasaProfesional && (
            <button onClick={() => setTab("order_servis")} className={`flex-1 py-3 text-xs md:text-sm font-black rounded-lg transition-all min-w-[120px] ${tab === "order_servis" ? "bg-indigo-600 text-white shadow-md" : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100"}`}>
              🛠️ Orderan Servis {orderanJasa.filter(o => o.status === 'Sedang Direparasi').length > 0 && <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[9px] ml-1 animate-pulse">{orderanJasa.filter(o => o.status === 'Sedang Direparasi').length}</span>}
            </button>
          )}
        </div>

        {/* ================= TAB 1: KATALOG ================= */}
        {tab === "katalog" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
            {katalog.length === 0 ? (
              <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
                <div className="text-4xl grayscale opacity-40 mb-3">🛍️</div><p className="text-slate-500 font-bold">Belum ada lapak warga yang buka.</p>
              </div>
            ) : (
              katalog.map(k => (
                <div key={k.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col hover:-translate-y-1 transition-transform">
                  <div className="h-48 bg-slate-100 relative overflow-hidden">
                    <img src={k.foto_url} alt={k.nama_usaha} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded">{k.kategori}</div>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-lg font-black text-slate-800 leading-tight mb-1">{k.nama_usaha}</h3>
                    <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">Milik: {k.warga?.nama_lengkap}</p>
                    <p className="text-xs text-slate-600 mb-6 flex-1 leading-relaxed">{k.deskripsi}</p>
                    <a href={`https://wa.me/${k.nomor_wa}?text=Halo%20tetangga,%20saya%20warga%20RT%2007%20melihat%20lapak%20*${encodeURIComponent(k.nama_usaha)}*%20di%20Portal...`} target="_blank" rel="noopener noreferrer" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-3.5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-md active:scale-95">
                      <span>💬</span> Hubungi Penjual
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ================= TAB 2: LAPAK SAYA ================= */}
        {tab === "lapak_saya" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="space-y-6 h-fit">
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
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shrink-0 ${k.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : k.status === 'Ditolak' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{k.status}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold mb-2 uppercase">{k.kategori}</p>
                        <button onClick={async () => { if(confirm('Yakin ingin menghapus lapak ini secara permanen?')) { try { await aksiHapus(k.id); router.refresh(); } catch(e: unknown) { setPesan({ tipe: "gagal", judul: "Lapak belum dapat dihapus", teks: e instanceof Error ? e.message : "Terjadi kesalahan yang tidak diketahui." }); } } }} className="text-[10px] font-bold text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded border border-rose-200 transition-colors w-full md:w-auto text-center mt-2 shadow-sm active:scale-95">
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
              {kuotaHabis && (
                <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-6">
                  <div className="text-4xl mb-3">🔒</div><h3 className="font-black text-slate-800 text-lg">Kuota Lapak Penuh</h3><p className="text-xs font-bold text-slate-600 mt-2">Hapus salah satu lapak Anda untuk membuka pendaftaran baru.</p>
                </div>
              )}
              <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-100 pb-3">Daftarkan Lapak UMKM</h2>
              <form onSubmit={handleSimpanLapak} className="space-y-4">
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Nama Usaha / Toko</label><input type="text" required disabled={kuotaHabis} className="w-full border border-slate-300 rounded-lg p-3 text-sm font-bold text-slate-800 outline-none focus:border-orange-500" placeholder="Cth: Servis AC / Katering Bu RT" value={namaUsaha} onChange={e => setNamaUsaha(e.target.value)} /></div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Kategori</label>
                  <select required disabled={kuotaHabis} className="w-full border border-slate-300 rounded-lg p-3 text-sm font-bold text-slate-800 outline-none focus:border-orange-500 bg-white" value={kategori} onChange={e => setKategori(e.target.value)}>
                    <option value="" disabled>Pilih Kategori...</option><option value="Makanan & Minuman">Makanan & Minuman</option><option value="Jasa & Servis">Jasa & Servis (Dapat menerima Order RT)</option><option value="Pakaian & Fashion">Pakaian & Fashion</option><option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div><label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Deskripsi & Harga Singkat</label><textarea required disabled={kuotaHabis} rows={3} className="w-full border border-slate-300 rounded-lg p-3 text-sm text-slate-800 outline-none focus:border-orange-500" value={deskripsi} onChange={e => setDeskripsi(e.target.value)} /></div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">Nomor WhatsApp Aktif</label>
                  <input type="tel" readOnly className="w-full border border-slate-300 rounded-lg p-3 text-sm font-mono text-slate-500 bg-slate-100 cursor-not-allowed shadow-inner" value={wa} />
                </div>
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                  <label className="block text-[11px] font-black text-orange-800 mb-2 uppercase">📸 Upload 1 Foto Andalan</label>
                  <input type="file" accept="image/jpeg,image/png,image/webp" required disabled={kuotaHabis} onChange={e => setFileFoto(e.target.files?.[0] || null)} className="w-full text-xs text-orange-900 font-medium disabled:opacity-50" />
                  <p className="text-[10px] text-orange-800/70 font-medium mt-2">Foto dikompres otomatis ke JPEG ±120 KB sebelum diunggah.</p>
                </div>
                <button type="submit" disabled={loading || kuotaHabis} className={`w-full text-white font-black uppercase tracking-widest text-xs rounded-lg p-4 shadow-md mt-2 active:scale-95 ${loading || kuotaHabis ? 'bg-slate-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'}`}>
                  {loading ? "Menyimpan..." : "Ajukan Buka Lapak"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================= TAB 3: ORDERAN SERVIS (KHUSUS TEKNISI) ================= */}
        {tab === "order_servis" && isJasaProfesional && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-2xl mb-6 shadow-sm flex items-start gap-4">
              <div className="text-3xl">🛠️</div>
              <div>
                <h3 className="font-black text-indigo-900 text-sm mb-1 uppercase tracking-widest">Sistem Tiket Teknisi RT</h3>
                <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                  Ini adalah daftar barang elektronik/furnitur dari Rak Bin Warga yang ditugaskan ke Lapak Jasa Anda oleh Pengurus RT. 
                  Selesaikan pekerjaan, input biaya aslinya, dan sistem otomatis memotong Fee Kas RT sebesar 10%.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {orderanJasa.length === 0 ? (
                <div className="bg-white p-10 text-center rounded-2xl border border-dashed border-slate-300">
                  <p className="text-slate-400 text-sm font-bold">Belum ada tugas reparasi yang dilempar ke Lapak Anda.</p>
                </div>
              ) : (
                orderanJasa.map(order => (
                  <div key={order.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-black text-slate-800 text-lg leading-tight">{order.nama_barang}</h4>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded shrink-0 ${order.status === 'Sedang Direparasi' ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-emerald-100 text-emerald-700'}`}>{order.status}</span>
                      </div>
                      <p className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded inline-block font-bold mb-3 border border-slate-200 uppercase">{order.kategori}</p>
                      
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-600 mb-4 leading-relaxed">
                        <span className="font-bold text-slate-500 block mb-1">Deskripsi Kerusakan:</span>
                        {order.deskripsi}
                      </div>

                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <span>Pemilik: {order.warga?.nama_lengkap}</span>
                        {order.status === 'Sedang Direparasi' && (
                          <a href={`https://wa.me/${formatWA(order.warga?.no_whatsapp)}?text=Halo%20saya%20teknisi%20dari%20RT%2007%20terkait%20reparasi%20*${encodeURIComponent(order.nama_barang)}*`} target="_blank" className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-200 transition-colors">📞 Chat Pemilik</a>
                        )}
                      </div>
                    </div>

                    {/* AKSI TEKNISI */}
                    <div className="w-full md:w-[250px] shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 flex flex-col justify-center">
                      {order.status === 'Sedang Direparasi' ? (
                        <>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 text-center">Aksi Pekerjaan</p>
                          <button onClick={() => handleSelesaikanOrder(order.id, false)} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-lg shadow-md mb-2 transition-colors active:scale-95 disabled:opacity-50">
                            ✅ Selesai & Tagih
                          </button>
                          <button onClick={() => handleSelesaikanOrder(order.id, true)} disabled={loading} className="w-full bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-black text-[10px] uppercase tracking-widest py-3 rounded-lg transition-colors active:scale-95 disabled:opacity-50">
                            ❌ Gagal Diperbaiki
                          </button>
                        </>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Tagihan Selesai</p>
                          <div className="text-lg font-black text-emerald-800 tabular-nums">{formatRp(order.biaya_reparasi)}</div>
                          <div className="text-[9px] font-bold text-emerald-700 mt-2 bg-emerald-100 py-1 rounded">
                            Fee RT: {formatRp(order.fee_rt)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
      <PesanDialog pesan={pesan} onClose={() => setPesan(null)} />
    </div>
  );
}
