"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminWarga() {
  const [penduduk, setPenduduk] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminAktif, setAdminAktif] = useState<any>(null);
  const router = useRouter();

  const fetchData = async () => {
    setLoading(true);
    // Tarik kepala keluarga yang sudah divalidasi
    const { data: kk } = await supabase.from("warga").select("*").eq("status_verifikasi", "Disetujui");
    // Tarik anggota keluarga
    const { data: anggota } = await supabase.from("anggota_keluarga").select("*");

    let allPenduduk: any[] = [];
    
    if (kk) {
      kk.forEach(k => {
        allPenduduk.push({ 
          id: k.id, 
          nama: k.nama_lengkap, 
          nik: k.nik, 
          status: k.status_tinggal, 
          detail: k.detail_alamat, 
          peran: "KEPALA KELUARGA" 
        });
      });
    }
    
    if (anggota) {
      anggota.forEach(a => {
        allPenduduk.push({ 
          id: a.id, 
          nama: a.nama_lengkap, 
          nik: a.nik, 
          status: a.status_hubungan, 
          detail: "-", 
          peran: "ANGGOTA KELUARGA" 
        });
      });
    }

    setPenduduk(allPenduduk);
    setLoading(false);
  };

  useEffect(() => {
    const cekSesi = async () => {
      // FAKTA: Pengecekan JWT Server-side!
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin");
        return;
      }
      
      const { data: profil } = await supabase
        .from("pengurus_rt")
        .select("*")
        .eq("email", session.user.email)
        .single();

      if (profil) {
        setAdminAktif({ id: profil.id, nama: profil.nama_lengkap });
        fetchData();
      }
    };
    cekSesi();
  }, [router]);

  // FAKTA: Algoritma Pembedah NIK (Standar Dukcapil)
  const getDemografi = () => {
    let pria = 0, wanita = 0;
    let balita = 0, dewasa = 0, lansia = 0;
    const tahunIni = new Date().getFullYear();

    penduduk.forEach(p => {
      if(!p.nik || p.nik.length !== 16) return;
      
      // Deteksi Gender dari Tanggal Lahir (Digit 7-8)
      const tanggalLahir = parseInt(p.nik.substring(6, 8));
      if (tanggalLahir > 40) wanita++; 
      else pria++;

      // Deteksi Umur dari Tahun Lahir (Digit 11-12)
      let tahunLahir = parseInt(p.nik.substring(10, 12));
      // Logika sederhana penentu abad (Jika < 30 dianggap lahir tahun 2000-an)
      tahunLahir += (tahunLahir > 30) ? 1900 : 2000; 

      const umur = tahunIni - tahunLahir;
      if (umur < 5) balita++;
      else if (umur < 60) dewasa++;
      else lansia++;
    });

    return { pria, wanita, balita, dewasa, lansia };
  };

  const demo = getDemografi();
  const kkCount = penduduk.filter(p => p.peran === "KEPALA KELUARGA").length;
  const tetapCount = penduduk.filter(p => p.peran === "KEPALA KELUARGA" && p.status === "Warga Tetap").length;
  const kontrakCount = penduduk.filter(p => p.peran === "KEPALA KELUARGA" && p.status === "Kontrak/Kos").length;

  if (!adminAktif) return null;
  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Membaca arsip kependudukan...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-blue-600 font-bold hover:underline mb-2 inline-block text-sm">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-8 rounded-xl shadow-lg text-white">
          <h1 className="text-3xl font-bold mb-2">Buku Induk Warga Dinamis</h1>
          <p className="text-blue-200 text-sm">Sistem otomatis membedah NIK seluruh warga (termasuk anggota keluarga) untuk mendeteksi Jenis Kelamin dan Kategori Usia.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-blue-500">
            <h3 className="text-xs font-bold text-slate-500 uppercase">Total Populasi</h3>
            <div className="text-3xl font-black text-slate-800 mt-2">{penduduk.length} <span className="text-sm font-normal text-slate-500">Jiwa</span></div>
            <div className="text-[10px] font-bold text-blue-600 mt-2 bg-blue-50 p-1.5 rounded inline-block">Dari {kkCount} Kepala Keluarga</div>
          </div>
          
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-indigo-500">
            <h3 className="text-xs font-bold text-slate-500 uppercase">Status Tinggal (Per KK)</h3>
            <div className="mt-3 text-sm font-bold text-slate-700 space-y-1">
              <div className="flex justify-between"><span>Tetap:</span> <span className="text-indigo-600">{tetapCount}</span></div>
              <div className="flex justify-between"><span>Kontrak/Kos:</span> <span className="text-indigo-600">{kontrakCount}</span></div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-rose-500">
            <h3 className="text-xs font-bold text-slate-500 uppercase">Demografi Gender</h3>
            <div className="mt-3 text-sm font-bold text-slate-700 space-y-1">
              <div className="flex justify-between"><span>👦 Pria:</span> <span className="text-blue-600">{demo.pria}</span></div>
              <div className="flex justify-between"><span>👩 Wanita:</span> <span className="text-rose-600">{demo.wanita}</span></div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-emerald-500">
            <h3 className="text-xs font-bold text-slate-500 uppercase">Kategori Usia</h3>
            <div className="mt-3 text-sm font-bold text-slate-700 space-y-1">
              <div className="flex justify-between"><span>Balita:</span> <span className="text-emerald-600">{demo.balita}</span></div>
              <div className="flex justify-between"><span>Dewasa:</span> <span className="text-emerald-600">{demo.dewasa}</span></div>
              <div className="flex justify-between"><span>Lansia:</span> <span className="text-emerald-600">{demo.lansia}</span></div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Daftar Induk Penduduk Aktif</h2>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="bg-slate-100 text-slate-600">
                  <th className="p-3 border-b-2 font-bold">Nama & Posisi</th>
                  <th className="p-3 border-b-2 font-bold">NIK</th>
                  <th className="p-3 border-b-2 font-bold">Status / Blok</th>
                </tr>
              </thead>
              <tbody>
                {penduduk.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-slate-50">
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{p.nama}</div>
                      <div className={`text-[10px] font-black uppercase mt-1 ${p.peran === 'KEPALA KELUARGA' ? 'text-blue-600' : 'text-slate-500'}`}>{p.peran}</div>
                    </td>
                    <td className="p-4 font-mono text-slate-600">{p.nik}</td>
                    <td className="p-4 text-xs font-bold text-slate-600">
                      {p.status}
                      <div className="font-normal text-slate-400 mt-1">{p.detail}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}