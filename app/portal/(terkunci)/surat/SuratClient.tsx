"use client";
import { useState } from "react";
import TautanHalus from "@/components/TautanHalus";

export default function SuratClient({ warga }: { warga: any }) {
  const [keperluan, setKeperluan] = useState("");
  const [keterangan, setKeterangan] = useState("");
  
  const [agama, setAgama] = useState("Islam");
  const [pendidikan, setPendidikan] = useState("SLTA");
  const [statusKawin, setStatusKawin] = useState("Kawin");
  const [kewarganegaraan, setKewarganegaraan] = useState("WNI");

  const handlePrint = () => {
    window.print();
  };

  const today = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  
  // REFACTOR MUTLAK: Opsi Surat Disesuaikan dengan Instruksi Pak RT
  const daftarKeperluan = [
    "Mutasi In / Pindah Datang", "Pembuatan SKTM", "Urusan Dukcapil", 
    "Keterangan Usaha", "Pengantar SKCK", 
    "Domisili Tempat Tinggal", "Lainnya"
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 print:p-0 print:bg-white flex flex-col items-center font-sans">
      
      {/* --------------------------------------------------------- */}
      {/* PANEL FORM (DISEMBUNYIKAN SECARA OTOMATIS SAAT NGE-PRINT) */}
      {/* --------------------------------------------------------- */}
      <div className="w-full max-w-4xl print:hidden space-y-6 mb-10">
        <TautanHalus href="/portal" className="text-blue-600 font-bold hover:underline mb-2 inline-block transition-colors active:scale-95">&larr; Kembali ke Dasbor</TautanHalus>
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-slate-200">
          <h1 className="text-2xl font-black text-slate-800 mb-2">Layanan Surat Pengantar Mandiri</h1>
          <p className="text-sm text-slate-500 mb-4">Lengkapi data tambahan di bawah ini, lalu cetak surat secara instan untuk dibawa ke rumah RT.</p>
          
          {/* INJEKSI UX: Edukasi Warga agar Pak RT tidak repot menjawab pertanyaan */}
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-start gap-3 mb-6">
            <span className="text-blue-500 text-lg leading-none mt-0.5">ℹ️</span>
            <p className="text-[10px] text-blue-800 font-medium leading-relaxed">
              <strong>INFO BIROKRASI TERBARU:</strong> Sesuai aturan pemerintah, pembuatan KTP dan KK standar saat ini <strong>sudah tidak memerlukan Surat Pengantar RT/RW</strong>. Anda bisa langsung ke Kelurahan/Dukcapil. Pengantar RT hanya diperlukan untuk warga pindahan (Mutasi In), SKTM, dan Keperluan Usaha.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-widest">Agama</label>
              <select className="w-full border border-slate-300 p-3 rounded-lg text-slate-900 font-bold outline-none focus:border-blue-500" value={agama} onChange={e => setAgama(e.target.value)}>
                <option value="Islam">Islam</option><option value="Kristen">Kristen</option>
                <option value="Katholik">Katholik</option><option value="Hindu">Hindu</option><option value="Budha">Budha</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-widest">Pendidikan Terakhir</label>
              <select className="w-full border border-slate-300 p-3 rounded-lg text-slate-900 font-bold outline-none focus:border-blue-500" value={pendidikan} onChange={e => setPendidikan(e.target.value)}>
                <option value="SD">SD</option>
                <option value="SLTP">SLTP / SMP</option>
                <option value="SLTA">SLTA / SMA</option>
                <option value="S1">S1 / Diploma</option>
                <option value="S2">S2 / Magister</option>
                <option value="S3">S3 / Doktoral</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-widest">Status Perkawinan</label>
              <select className="w-full border border-slate-300 p-3 rounded-lg text-slate-900 font-bold outline-none focus:border-blue-500" value={statusKawin} onChange={e => setStatusKawin(e.target.value)}>
                <option value="Kawin">Kawin</option><option value="Belum Kawin">Belum Kawin</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-widest">Kewarganegaraan</label>
              <select className="w-full border border-slate-300 p-3 rounded-lg text-slate-900 font-bold outline-none focus:border-blue-500" value={kewarganegaraan} onChange={e => setKewarganegaraan(e.target.value)}>
                <option value="WNI">WNI</option><option value="WNA">WNA</option><option value="Keturunan">Keturunan</option>
              </select>
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-black text-slate-500 mb-3 uppercase tracking-widest">Pilih Keperluan Surat</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {daftarKeperluan.map((item) => (
                  <button
                    key={item}
                    onClick={() => setKeperluan(item)}
                    className={`p-3 rounded-lg border text-xs font-bold transition-all duration-200 text-center active:scale-95 ${
                      keperluan === item
                        ? "bg-blue-600 text-white border-blue-600 shadow-md transform -translate-y-0.5"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:bg-blue-50"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-widest">Detail Keperluan (Opsional)</label>
              <input 
                type="text" 
                className="w-full border border-slate-300 p-3 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium" 
                placeholder="Tuliskan spesifikasi detail dari keperluan di atas..." 
                value={keterangan} 
                onChange={e => setKeterangan(e.target.value)} 
              />
            </div>
            
            <button 
              onClick={handlePrint} 
              disabled={!keperluan} 
              className="w-full bg-slate-900 text-white font-black uppercase tracking-widest px-6 py-4 rounded-lg shadow-xl hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none transition-all mt-4 text-sm flex items-center justify-center gap-2"
            >
              🖨️ Cetak Kertas Pengantar
            </button>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- */}
      {/* PANEL PREVIEW & CETAK - KLONING MUTLAK MODEL AA. 04       */}
      {/* --------------------------------------------------------- */}
      <div className="w-full max-w-[210mm] min-h-[297mm] bg-white text-black font-sans text-[13px] leading-snug shadow-2xl print:shadow-none border border-slate-300 print:border-none p-8 sm:p-12 print:p-0 relative">
        
        {/* KOP SURAT */}
        <div className="flex justify-between items-start mb-1">
          <div className="uppercase font-bold tracking-wide">
            <div>Kecamatan : Kramat Jati</div>
            <div>Kelurahan : Tengah</div>
            <div>RT. 07 / RW. 09</div>
            <div>Jakarta Timur</div>
          </div>
          <div className="font-bold">
            Model AA. 04.
          </div>
        </div>
        
        {/* GARIS GANDA */}
        <div className="border-t-2 border-black w-1/3 mb-[2px]"></div>
        <div className="border-t-[1px] border-black w-1/3 mb-8"></div>

        {/* JUDUL SURAT */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold tracking-[0.2em] mb-1">SURAT - PENGANTAR</h1>
          <p className="text-lg font-bold">No. ........................................</p>
        </div>

        {/* KALIMAT PEMBUKA */}
        <div className="mb-4 text-justify">
          Yang bertanda tangan di bawah ini, Pengurus RT. 07 / 09 Kelurahan Tengah Kecamatan Kramat Jati dengan ini menerangkan bahwa :
        </div>

        {/* TABEL ISIAN */}
        <div className="ml-0 mb-6">
          <table className="w-full text-left">
            <tbody className="align-top">
              <tr>
                <td className="w-[30%] py-1">Nama</td>
                <td className="w-[3%] py-1">:</td>
                <td className="py-1 font-bold">{warga.nama_lengkap}</td>
              </tr>
              <tr>
                <td className="py-1">Jenis Kelamin</td>
                <td className="py-1">:</td>
                <td className="py-1 font-bold">{warga.jenis_kelamin}</td>
              </tr>
              <tr>
                <td className="py-1">Tempat / Tgl. Lahir</td>
                <td className="py-1">:</td>
                <td className="py-1 font-bold">{warga.tempat_lahir}, {new Date(warga.tanggal_lahir).toLocaleDateString('id-ID', {day: '2-digit', month: 'long', year: 'numeric'})}</td>
              </tr>
              <tr>
                <td className="py-1">No. KTP. KK</td>
                <td className="py-1">:</td>
                <td className="py-1 font-bold font-mono text-sm">{warga.nik}</td>
              </tr>
              <tr>
                <td className="py-1">Kewarganegaraan</td>
                <td className="py-1">:</td>
                <td className="py-1 font-bold">{kewarganegaraan} <span className="font-normal text-gray-500 line-through decoration-black">/ {kewarganegaraan === 'WNI' ? 'WNA / Keturunan' : kewarganegaraan === 'WNA' ? 'WNI / Keturunan' : 'WNI / WNA'}</span></td>
              </tr>
              <tr>
                <td className="py-1">Pendidikan</td>
                <td className="py-1">:</td>
                <td className="py-1 font-bold">{pendidikan}</td>
              </tr>
              <tr>
                <td className="py-1">Agama</td>
                <td className="py-1">:</td>
                <td className="py-1 font-bold">{agama}</td>
              </tr>
              <tr>
                <td className="py-1">Status</td>
                <td className="py-1">:</td>
                <td className="py-1 font-bold">{statusKawin} <span className="font-normal text-gray-500 line-through decoration-black">/ {statusKawin === 'Kawin' ? 'Belum Kawin' : 'Kawin'}</span></td>
              </tr>
              <tr>
                <td className="py-1">Pekerjaan</td>
                <td className="py-1">:</td>
                <td className="py-1 font-bold">{warga.pekerjaan}</td>
              </tr>
              <tr>
                <td className="py-1">Alamat</td>
                <td className="py-1">:</td>
                <td className="py-1">
                  <span className="font-bold">{warga.detail_alamat}</span> RT. 07 / RW. 09<br/>
                  Kel. <span className="font-bold">Tengah</span> Kec. <span className="font-bold">Kramat Jati</span>
                </td>
              </tr>
              <tr>
                <td className="py-3">Maksud / Keperluan</td>
                <td className="py-3">:</td>
                <td className="py-3">
                  <div className="border-b border-dotted border-black min-h-[1.5rem] font-bold">
                    {keperluan} {keterangan ? `- ${keterangan}` : ''}
                  </div>
                  <div className="border-b border-dotted border-black min-h-[1.5rem] mt-1"></div>
                  <div className="border-b border-dotted border-black min-h-[1.5rem] mt-1"></div>
                  <div className="border-b border-dotted border-black min-h-[1.5rem] mt-1"></div>
                  <div className="border-b border-dotted border-black min-h-[1.5rem] mt-1"></div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* BAGIAN TANDA TANGAN */}
        <div className="flex justify-between items-start mt-10">
          <div className="text-center w-[40%]">
            <div className="text-left mb-2">Nomor : .................................</div>
            <div className="mb-20">
              Mengetahui<br/>
              Pengurus Rw. 09<br/>
              Ketua
            </div>
            <div>( ......................................... )</div>
            <div className="text-[9px] text-left mt-4 leading-tight">
              Lembar Putih Untuk Kelurahan<br/>
              Lembar Biru Untuk Arsip RW<br/>
              Lembar Kuning Untuk Arsip RT
            </div>
          </div>
          
          <div className="text-center w-[40%]">
            <div className="text-left mb-2">Jakarta, .................................</div>
            <div className="mb-20">
              Pengurus Rt. 07 / 09<br/>
              Kel. Tengah
            </div>
            <div>( ......................................... )</div>
            <div className="text-[9px] text-left mt-4">
              Catatan :<br/>
              BAWALAH KTP / KK serta surat-surat lain
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}