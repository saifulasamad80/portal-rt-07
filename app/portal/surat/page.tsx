"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CetakSurat() {
  const [warga, setWarga] = useState<any>(null);
  const [keperluan, setKeperluan] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const router = useRouter();

  useEffect(() => {
    const cekSesiWarga = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      const { data: profilWarga } = await supabase
        .from("warga")
        .select("*")
        .eq("auth_email", session.user.email)
        .single();

      if (profilWarga) {
        setWarga(profilWarga);
      } else {
        router.push("/login");
      }
    };
    cekSesiWarga();
  }, [router]);

  const handlePrint = () => {
    window.print();
  };

  if (!warga) return null;

  const today = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  const nomorSurat = `0${new Date().getMonth() + 1} / RT.07 / ${new Date().getFullYear()}`;

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto print:hidden space-y-6">
        <Link href="/portal" className="text-blue-600 font-bold hover:underline mb-4 inline-block">&larr; Kembali ke Dasbor</Link>
        <div className="bg-white p-6 rounded-xl shadow border-t-4 border-blue-600">
          <h1 className="text-2xl font-bold text-slate-800 mb-4">Layanan Surat Pengantar Mandiri</h1>
          <p className="text-sm text-slate-600 mb-6">Pilih keperluan Anda, lalu cetak surat ini.</p>
          <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div>
              <label className="block text-sm font-bold text-blue-900 mb-1">Pilih Keperluan Surat</label>
              <select className="w-full border border-blue-300 p-2.5 rounded text-slate-900 bg-white" value={keperluan} onChange={e => setKeperluan(e.target.value)}>
                <option value="">-- Pilih Keperluan --</option>
                <option value="KTP Baru">1. KTP Baru</option>
                <option value="Perpanjangan KTP">2. Perpanjangan KTP</option>
                <option value="KTP Sementara">3. KTP Sementara</option>
                <option value="Kartu Keluarga Baru">4. Kartu Keluarga Baru</option>
                <option value="Pengantar SKCK">5. Pengantar SKCK</option>
                <option value="Domisili Tempat Tinggal">6. Domisili Tempat Tinggal</option>
                <option value="Lainnya">7. Lainnya</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-blue-900 mb-1">Keterangan Tambahan</label>
              <input type="text" className="w-full border border-blue-300 p-2.5 rounded text-slate-900" placeholder="Keterangan..." value={keterangan} onChange={e => setKeterangan(e.target.value)} />
            </div>
            <button onClick={handlePrint} disabled={!keperluan} className="w-full bg-blue-600 text-white font-bold px-6 py-3 rounded-lg shadow hover:bg-blue-700 disabled:bg-slate-400 mt-2">Cetak Kertas Sekarang</button>
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto mt-8 bg-white p-12 shadow-2xl print:shadow-none print:m-0 print:p-0 text-black">
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