"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function LandingPage() {
  const [showCctvModal, setShowCctvModal] = useState(false);
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [pinCctv, setPinCctv] = useState("");

  const [kasPemasukan, setKasPemasukan] = useState(0);
  const [kasPengeluaran, setKasPengeluaran] = useState(0);
  const [kasLoading, setKasLoading] = useState(true);
  
  // FAKTA: State buat Pengumuman Publik
  const [pengumuman, setPengumuman] = useState<any[]>([]);

  useEffect(() => {
    fetchDataPublik();
  }, []);

  const fetchDataPublik = async () => {
    // Tarik Kas
    const { data: dataKas } = await supabase.from("kas_rt").select("tipe_transaksi, nominal");
    if (dataKas) {
      const masuk = dataKas.filter(t => t.tipe_transaksi === "Pemasukan").reduce((sum, t) => sum + t.nominal, 0);
      const keluar = dataKas.filter(t => t.tipe_transaksi === "Pengeluaran").reduce((sum, t) => sum + t.nominal, 0);
      setKasPemasukan(masuk);
      setKasPengeluaran(keluar);
    }
    setKasLoading(false);

    // Tarik Pengumuman
    const { data: dataPengumuman } = await supabase
      .from("pengumuman_rt")
      .select("*")
      .order("tanggal_publikasi", { ascending: false })
      .limit(3);
    if (dataPengumuman) setPengumuman(dataPengumuman);
  };

  const saldoAkhir = kasPemasukan - kasPengeluaran;

  const handleBukaCCTV = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinCctv === "RT07AMAN") {
      alert("Akses Diberikan! Mengarahkan ke IP Public CCTV RT 07...");
      window.open("https://rt07-cctv.local.ip", "_blank"); 
      setShowCctvModal(false);
      setPinCctv("");
    } else {
      alert("AKSES DITOLAK: Password tidak valid!");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 z-0"></div>

      <div className="text-center mb-8 relative z-10 pt-10">
        <div className="inline-block bg-slate-900 text-white text-xs font-bold px-4 py-1.5 rounded-full mb-6 tracking-widest uppercase shadow-sm">
          Sistem Kependudukan & Lingkungan
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight leading-tight mb-4">
          Portal Digital <span className="text-blue-600">Warga & RT</span>
        </h1>
        <p className="text-slate-500 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
          Platform terpadu untuk pelayanan surat, pelaporan darurat, manajemen fasilitas, dan pencatatan kas lingkungan secara transparan.
        </p>
      </div>

      {/* PENGUMUMAN PUBLIK (Pindahan dari Portal Warga) */}
      <div className="w-full max-w-4xl bg-white p-6 rounded-2xl shadow-lg border-t-8 border-amber-500 mb-6 relative z-10">
        <h2 className="text-xl font-black text-slate-800 mb-4 flex items-center justify-center gap-2">📢 Pengumuman Warga</h2>
        <div className="space-y-4">
          {pengumuman.length === 0 ? (
            <p className="text-sm text-slate-500 italic text-center">Belum ada informasi terbaru.</p>
          ) : (
            pengumuman.map(p => (
              <div key={p.id} className="p-4 border border-slate-200 rounded-lg bg-amber-50/30 text-left">
                <h3 className="font-bold text-slate-800">{p.judul}</h3>
                <p className="text-sm text-slate-600 mb-2">{p.deskripsi}</p>
                {p.link_dokumen && <a href={p.link_dokumen} target="_blank" rel="noopener noreferrer" className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded font-bold hover:bg-blue-200 inline-block">📄 Buka Lampiran</a>}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="w-full max-w-4xl bg-white p-6 rounded-2xl shadow-lg border-t-8 border-blue-600 mb-6 relative z-10">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-slate-800">Transparansi Kas RT 07</h2>
          <p className="text-slate-500 text-sm">Rekapitulasi keuangan lingkungan secara real-time.</p>
        </div>

        {kasLoading ? (
          <div className="text-center text-slate-400 font-bold py-6 animate-pulse">Menghitung brankas kas...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center shadow-inner">
              <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-1">Total Pemasukan</div>
              <div className="text-2xl font-black text-emerald-600">Rp {kasPemasukan.toLocaleString("id-ID")}</div>
            </div>
            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 text-center shadow-inner">
              <div className="text-[10px] font-bold text-rose-700 uppercase tracking-widest mb-1">Total Pengeluaran</div>
              <div className="text-2xl font-black text-rose-600">Rp {kasPengeluaran.toLocaleString("id-ID")}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-center shadow-md">
              <div className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-1">Saldo Akhir Kas</div>
              <div className={`text-3xl font-black ${saldoAkhir >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
                Rp {saldoAkhir.toLocaleString("id-ID")}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-4xl bg-white p-4 rounded-2xl shadow-lg border-l-8 border-rose-600 mb-8 relative z-10 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl animate-pulse">🚨</div>
          <div className="text-left">
            <h3 className="font-black text-rose-700 text-lg leading-tight">Jalur Darurat & Keamanan</h3>
            <p className="text-xs text-slate-500">Akses langsung ke fasilitas keamanan lingkungan.</p>
          </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={() => setShowPanicModal(true)} className="flex-1 md:flex-none bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold py-2 px-4 rounded-lg text-sm text-center border border-rose-200 transition-colors">
            📞 Panic Button
          </button>
          <button onClick={() => setShowCctvModal(true)} className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-lg text-sm text-center shadow transition-colors flex items-center justify-center gap-2">
            📹 Buka CCTV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl relative z-10">
        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center hover:-translate-y-2 transition-transform duration-300">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-4xl mb-6 shadow-inner">👤</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Portal Warga</h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            Cek tagihan iuran, cetak surat pengantar, lapor kejadian darurat, dan ikut serta dalam e-voting RT.
          </p>
          <Link href="/login" className="mt-auto w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-md shadow-blue-200 transition-colors">
            Masuk Portal Warga
          </Link>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center hover:-translate-y-2 transition-transform duration-300">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-4xl mb-6 shadow-inner">🏛️</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Pengurus RT</h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            Pusat komando admin untuk validasi warga baru, akses buku induk demografi, dan manajemen informasi lingkungan.
          </p>
          <Link href="/admin" className="mt-auto w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-md shadow-emerald-200 transition-colors">
            Masuk Dasbor Admin
          </Link>
        </div>
      </div>

      <div className="mt-16 text-slate-400 text-xs font-medium relative z-10 pb-8">
        &copy; {new Date().getFullYear()} - Sistem Manajemen RT 07.
      </div>

      {/* MODAL PANIC BUTTON */}
      {showPanicModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-rose-600 p-6 rounded-2xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200 border-2 border-rose-400">
            <div className="flex justify-between items-start mb-6 text-white">
              <div>
                <h3 className="text-xl font-black flex items-center gap-2">🚨 Panggilan Darurat</h3>
                <p className="text-xs opacity-90 mt-1 font-medium">Ketuk tombol untuk memanggil bantuan.</p>
              </div>
              <button onClick={() => setShowPanicModal(false)} className="text-white hover:text-rose-200 text-2xl leading-none">&times;</button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <a href="tel:110" className="bg-white p-4 rounded-xl text-center shadow hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
                <div className="text-4xl mb-2">👮‍♂️</div>
                <div className="font-bold text-slate-800 text-sm">Polisi</div>
                <div className="text-xs text-slate-500 font-mono">110</div>
              </a>
              <a href="tel:113" className="bg-white p-4 rounded-xl text-center shadow hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
                <div className="text-4xl mb-2">🚒</div>
                <div className="font-bold text-slate-800 text-sm">Damkar</div>
                <div className="text-xs text-slate-500 font-mono">113</div>
              </a>
              <a href="tel:119" className="bg-white p-4 rounded-xl text-center shadow hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
                <div className="text-4xl mb-2">🚑</div>
                <div className="font-bold text-slate-800 text-sm">Ambulans</div>
                <div className="text-xs text-slate-500 font-mono">119</div>
              </a>
              <a href="https://wa.me/6281234567890" target="_blank" rel="noopener noreferrer" className="bg-white p-4 rounded-xl text-center shadow hover:-translate-y-1 hover:shadow-lg transition-all duration-200">
                <div className="text-4xl mb-2">💬</div>
                <div className="font-bold text-slate-800 text-sm">Lapor RT</div>
                <div className="text-xs text-slate-500 font-mono">WhatsApp</div>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LOGIN CCTV */}
      {showCctvModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm border-t-8 border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-black text-slate-800">Akses CCTV Zona</h3>
                <p className="text-xs text-slate-500 mt-1">Otorisasi khusus dari Pengurus RT</p>
              </div>
              <button onClick={() => setShowCctvModal(false)} className="text-slate-400 hover:text-rose-500 text-2xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleBukaCCTV}>
              <input 
                type="password" 
                required 
                className="w-full border-2 border-slate-300 rounded-lg p-3 text-center text-lg tracking-widest outline-none focus:border-slate-800 mb-4 font-mono" 
                placeholder="Masukkan Password..." 
                value={pinCctv} 
                onChange={(e) => setPinCctv(e.target.value)} 
              />
              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                Buka Kamera
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}