"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CetakSurat() {
  const [warga, setWarga] = useState<any>(null);
  const [keperluan, setKeperluan] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const router = useRouter();

  useEffect(() => {
    const sesi = localStorage.getItem("warga_aktif");
    if (!sesi) router.push("/login");
    else setWarga(JSON.parse(sesi));
  }, [router]);

  const handlePrint = () => {
    window.print();
  };

  if (!warga) return null;

  const today = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  const nomorSurat = `0${new Date().getMonth() + 1} / RT.07 / ${new Date().getFullYear()}`;

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:p-0 print:bg-white">
      
      {/* AREA KONTROL APLIKASI */}
      <div className="max-w-4xl mx-auto print:hidden space-y-6">
        <Link href="/portal" className="text-blue-600 font-bold hover:underline mb-4 inline-block">
          &larr; Kembali ke Dasbor
        </Link>
        
        <div className="bg-white p-6 rounded-xl shadow border-t-4 border-blue-600">
          <h1 className="text-2xl font-bold text-slate-800 mb-4">Layanan Surat Pengantar Mandiri</h1>
          <p className="text-sm text-slate-600 mb-6">Pilih keperluan Anda, lalu cetak surat ini dan bawa ke rumah Pak RT untuk meminta tanda tangan basah serta stempel.</p>
          
          <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div>
              <label className="block text-sm font-bold text-blue-900 mb-1">Pilih Keperluan Surat</label>
              <select className="w-full border border-blue-300 p-2.5 rounded text-slate-900 bg-white" value={keperluan} onChange={e => setKeperluan(e.target.value)}>
                <option value="">-- Pilih Keperluan --</option>
                <option value="KTP Baru">1. KTP Baru</option>
                <option value="Perpanjangan KTP">2. Perpanjangan KTP</option>
                <option value="KTP Sementara">3. KTP Sementara</option>
                <option value="Kartu Keluarga Baru">4. Kartu Keluarga Baru</option>
                <option value="Perubahan Data Kartu Keluarga">5. Perubahan data Kartu Keluarga</option>
                <option value="Pengantar SKCK">6. Pengantar SKCK</option>
                <option value="Domisili Tempat Tinggal">7. Domisili Tempat Tinggal</option>
                <option value="Domisili Usaha">8. Domisili Usaha</option>
                <option value="Pengantar Nikah (N1, N2, N4)">9. Pengantar Nikah (N1, N2, N4)</option>
                <option value="Surat Keterangan Kelahiran">10. Surat Keterangan Kelahiran</option>
                <option value="Surat Keterangan Kematian">11. Surat Keterangan Kematian</option>
                <option value="Surat Keterangan Tidak Mampu">12. Surat Keterangan Tidak Mampu</option>
                <option value="Surat Keterangan Izin Pesta">13. Surat Keterangan Izin Pesta</option>
                <option value="Lainnya">14. Lainnya (Tulis manual di keterangan)</option>
              </select>
            </div>
            
            {/* Logika Label Cerdas */}
            <div>
              <label className="block text-sm font-bold text-blue-900 mb-1">
                {keperluan === "Lainnya" ? "Tulis Keperluan Anda (Wajib)" : "Keterangan Tambahan (Opsional)"}
              </label>
              <input 
                type="text" 
                className="w-full border border-blue-300 p-2.5 rounded text-slate-900" 
                placeholder={keperluan === "Lainnya" ? "Cth: Pengantar Daftar Sekolah Negeri" : "Cth: Sebagai syarat melamar pekerjaan di PT ABC"} 
                value={keterangan} 
                onChange={e => setKeterangan(e.target.value)} 
              />
            </div>
            
            {/* Tombol terkunci kalau pilih "Lainnya" tapi nggak ngisi Keterangan */}
            <button 
              onClick={handlePrint} 
              disabled={!keperluan || (keperluan === "Lainnya" && !keterangan)} 
              className="w-full bg-blue-600 text-white font-bold px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400 mt-2 transition-colors"
            >
              Cetak Kertas Sekarang
            </button>
          </div>
        </div>
      </div>

      {/* AREA KERTAS CETAK */}
      <div className="max-w-4xl mx-auto mt-8 bg-white p-12 shadow-2xl print:shadow-none print:m-0 print:p-0 text-black">
         <div className="text-center border-b-[3px] border-black pb-4 mb-8">
           <h2 className="text-2xl font-black uppercase tracking-wide">Rukun Tetangga (RT) 07 / RW XX</h2>
           <h3 className="text-lg font-bold uppercase tracking-wider">Kelurahan [Nama Kelurahan], Kecamatan [Nama Kecamatan]</h3>
           <p className="text-sm mt-1">Kota [Nama Kota], Provinsi [Nama Provinsi], Kode Pos: [12345]</p>
           <p className="text-xs">Sekretariat: Jl. [Nama Jalan atau Fasum] No. [XX], No. Telp: [0812-XXXX-XXXX]</p>
         </div>

         <div className="text-center mb-10">
           <h1 className="text-xl font-bold underline underline-offset-4 tracking-widest">SURAT PENGANTAR</h1>
           <p className="text-sm mt-1 font-semibold">Nomor: {nomorSurat}</p>
         </div>

         <div className="space-y-4 text-justify leading-relaxed text-[15px]">
           <p>Yang bertanda tangan di bawah ini Ketua RT 07 / RW XX, Kelurahan [Nama Kelurahan], Kecamatan [Nama Kecamatan], menerangkan dengan sesungguhnya bahwa:</p>
           
           <table className="w-full ml-8 my-4">
             <tbody>
               <tr><td className="w-56 py-1.5">Nama Lengkap</td><td className="w-4">:</td><td className="font-bold">{warga.nama_lengkap}</td></tr>
               <tr><td className="py-1.5">Nomor Induk Kependudukan (NIK)</td><td>:</td><td className="font-mono text-sm font-bold">{warga.nik}</td></tr>
               <tr><td className="py-1.5">Status Kependudukan</td><td>:</td><td>{warga.status_tinggal}</td></tr>
               <tr><td className="py-1.5">Alamat Tempat Tinggal</td><td>:</td><td>{warga.detail_alamat}, RT 07 / RW XX</td></tr>
             </tbody>
           </table>

           <p>Orang tersebut di atas adalah benar warga yang berdomisili di lingkungan RT 07. Surat pengantar ini diberikan kepada yang bersangkutan untuk keperluan:</p>
           
           <div className="font-bold text-center border-2 border-black p-3 my-4 bg-slate-50 print:bg-transparent">
             {/* Logika Cetak Cerdas */}
             {keperluan === "Lainnya" 
               ? (keterangan || "[ KETERANGAN KOSONG ]") 
               : (keperluan || "[ BELUM MEMILIH KEPERLUAN ]")
             }
             {keperluan !== "Lainnya" && keterangan && <span> - {keterangan}</span>}
           </div>

           <p>Demikian surat pengantar ini dibuat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya oleh instansi yang berwenang.</p>
         </div>

         <div className="mt-20 flex justify-end">
           <div className="text-center w-64">
             <p>[Nama Kota], {today}</p>
             <p className="font-bold">Ketua RT 07</p>
             <br/><br/><br/><br/>
             <p className="font-bold underline">_________________________</p>
             <p className="text-sm">( Nama Lengkap Pak RT )</p>
           </div>
         </div>
      </div>

    </div>
  );
}