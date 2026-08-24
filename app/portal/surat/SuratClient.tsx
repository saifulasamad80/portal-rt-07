// app/portal/surat/SuratClient.tsx
"use client";
import { useState } from "react";
import Link from "next/link";

export default function SuratClient({ warga }: { warga: any }) {
  const [keperluan, setKeperluan] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const handlePrint = () => {
    window.print();
  };

  const today = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  const nomorSurat = `0${new Date().getMonth() + 1} / RT.07 / ${new Date().getFullYear()}`;

  // Daftar opsi dipisah untuk di-render jadi tombol interaktif
  const daftarKeperluan = [
    "KTP Baru", "Perpanjangan KTP", "KTP Sementara", 
    "Kartu Keluarga Baru", "Pengantar SKCK", 
    "Domisili Tempat Tinggal", "Lainnya"
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:p-0 print:bg-white flex flex-col items-center">
      <div className="w-full max-w-4xl print:hidden space-y-6">
        <Link href="/portal" className="text-blue-600 font-bold hover:underline mb-4 inline-block">&larr; Kembali ke Dasbor</Link>
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Layanan Surat Pengantar Mandiri</h1>
          <p className="text-sm text-slate-500 mb-8">Pilih keperluan Anda di bawah ini, lalu cetak surat secara instan.</p>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-3">Pilih Keperluan Surat</label>
              
              {/* TRANSFORMASI UX: Native <select> dibunuh, diganti Grid Tombol (Pills) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {daftarKeperluan.map((item) => (
                  <button
                    key={item}
                    onClick={() => setKeperluan(item)}
                    className={`p-3 rounded-lg border text-sm font-semibold transition-all duration-200 text-left ${
                      keperluan === item
                        ? "bg-blue-600 text-white border-blue-600 shadow-md transform -translate-y-0.5"
                        : "bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:bg-blue-50"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Keterangan Tambahan (Opsional)</label>
              <input 
                type="text" 
                className="w-full border border-slate-300 p-3 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                placeholder="Tulis detail tambahan jika diperlukan..." 
                value={keterangan} 
                onChange={e => setKeterangan(e.target.value)} 
              />
            </div>
            
            <button 
              onClick={handlePrint} 
              disabled={!keperluan} 
              className="w-full bg-blue-600 text-white font-bold px-6 py-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none transition-all mt-4 text-lg"
            >
              Cetak Kertas Sekarang
            </button>
          </div>
        </div>
      </div>

      {/* AREA CETAK (Hanya tampil penuh di kertas) */}
      <div className="max-w-4xl mx-auto mt-8 bg-white p-12 shadow-2xl print:shadow-none print:m-0 print:p-0 text-black w-full">
         <div className="text-center border-b-[3px] border-black pb-4 mb-8">
           <h2 className="text-2xl font-black uppercase tracking-wide">Rukun Tetangga (RT) 07</h2>
         </div>
         <div className="text-center mb-10">
           <h1 className="text-xl font-bold underline">SURAT PENGANTAR</h1>
           <p className="text-sm mt-1 font-semibold">Nomor: {nomorSurat}</p>
         </div>
         <div className="space-y-4 text-justify leading-relaxed text-[15px]">
           <p>Yang bertanda tangan di bawah ini Ketua RT 07 menerangkan bahwa:</p>
           <table className="w-full ml-8 my-4">
             <tbody>
               <tr><td className="w-56 py-1.5">Nama Lengkap</td><td className="w-4">:</td><td className="font-bold">{warga.nama_lengkap}</td></tr>
               <tr><td className="py-1.5">NIK</td><td>:</td><td className="font-mono font-bold">{warga.nik}</td></tr>
               <tr><td className="py-1.5">Alamat</td><td>:</td><td>{warga.detail_alamat}, RT 07</td></tr>
             </tbody>
           </table>
           <p>Adalah benar warga kami untuk keperluan: <b>{keperluan} {keterangan && `- ${keterangan}`}</b></p>
         </div>
         <div className="mt-20 flex justify-end">
           <div className="text-center w-64">
             <p>{today}</p>
             <p className="font-bold">Ketua RT 07</p>
             <br/><br/><br/>
             <p className="font-bold underline">_________________________</p>
           </div>
         </div>
      </div>
    </div>
  );
}