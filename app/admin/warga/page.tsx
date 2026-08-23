"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function BukuIndukWarga() {
  const [dataWarga, setDataWarga] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    kk: 0,
    jiwa: 0,
    pria: 0,
    wanita: 0,
    balita: 0,
    dewasa: 0,
    lansia: 0,
    tetap: 0,
    kontrak: 0
  });

  useEffect(() => {
    fetchDataWarga();
  }, []);

  const fetchDataWarga = async () => {
    // FAKTA PERBAIKAN 1: Wajib menggunakan JOIN untuk menarik data istri dan anak
    const { data } = await supabase
      .from("warga")
      .select("*, anggota_keluarga(*)")
      .eq("status_verifikasi", "Disetujui");

    if (data) {
      setDataWarga(data);
      kalkulasiDemografi(data);
    }
    setLoading(false);
  };

  const kalkulasiDemografi = (wargaList: any[]) => {
    let kk = 0, jiwa = 0, p = 0, w = 0, balita = 0, dewasa = 0, lansia = 0, tetap = 0, kontrak = 0;
    const tahunSekarang = new Date().getFullYear();

    // Fungsi internal untuk membedah NIK siapa saja (Bapak, Ibu, Anak)
    const bedahNIK = (nik: string) => {
      if (!nik || nik.length !== 16) return;
      
      let tanggal = parseInt(nik.substring(6, 8));
      let tahun = parseInt(nik.substring(10, 12));

      // Deteksi Gender
      if (tanggal > 40) w++;
      else p++;

      // FAKTA PERBAIKAN 2: Bug Fix Umur Lansia (Asumsi jika tahun NIK lebih besar dari tahun saat ini, pasti lahir di 1900-an)
      let batasTahun = tahunSekarang % 100;
      let tahunLahir = tahun > batasTahun ? 1900 + tahun : 2000 + tahun;
      
      let umur = tahunSekarang - tahunLahir;
      
      if (umur < 5) balita++;
      else if (umur > 59) lansia++;
      else dewasa++;
    };

    wargaList.forEach((kepala) => {
      kk++; // Hitung 1 Kepala Keluarga
      jiwa++; // Hitung si Bapak sebagai 1 Jiwa
      
      if (kepala.status_tinggal === "Warga Tetap") tetap++;
      else kontrak++;

      // Eksekusi NIK Bapak
      bedahNIK(kepala.nik);

      // Eksekusi NIK Istri & Anak (Jika Ada)
      if (kepala.anggota_keluarga && kepala.anggota_keluarga.length > 0) {
        kepala.anggota_keluarga.forEach((anggota: any) => {
          jiwa++; // Tambah 1 Jiwa untuk setiap anggota keluarga
          bedahNIK(anggota.nik);
        });
      }
    });

    setStats({ kk, jiwa, pria: p, wanita: w, balita, dewasa, lansia, tetap, kontrak });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500 bg-slate-50">Menganalisis Ulang Demografi RT...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-blue-600 font-bold hover:underline mb-4 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-8 rounded-xl shadow-lg text-white">
          <h1 className="text-3xl font-black mb-2">Buku Induk Warga Dinamis</h1>
          <p className="text-blue-100 text-sm opacity-90">
            Sistem otomatis membedah NIK seluruh warga (termasuk anggota keluarga) untuk mendeteksi Jenis Kelamin dan Kategori Usia.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-blue-500">
            <div className="text-sm font-bold text-slate-500 mb-1">Total Populasi</div>
            <div className="text-4xl font-black text-slate-800">{stats.jiwa} <span className="text-sm text-slate-400 font-medium">Jiwa</span></div>
            <div className="text-xs font-bold text-blue-600 mt-2">Dari {stats.kk} Kepala Keluarga</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-indigo-500">
            <div className="text-sm font-bold text-slate-500 mb-1">Status Tinggal (Per KK)</div>
            <div className="text-sm font-bold text-slate-700">Tetap: <span className="text-indigo-600">{stats.tetap}</span></div>
            <div className="text-sm font-bold text-slate-700">Kontrak/Kos: <span className="text-amber-600">{stats.kontrak}</span></div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-rose-500">
            <div className="text-sm font-bold text-slate-500 mb-1">Demografi Gender</div>
            <div className="text-sm font-bold text-slate-700">👨 Pria: <span className="text-blue-600">{stats.pria}</span></div>
            <div className="text-sm font-bold text-slate-700">👩 Wanita: <span className="text-rose-600">{stats.wanita}</span></div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border-t-4 border-emerald-500">
            <div className="text-sm font-bold text-slate-500 mb-1">Kategori Usia</div>
            <div className="text-sm font-bold text-slate-700">Balita: <span className="text-emerald-600">{stats.balita}</span></div>
            <div className="text-sm font-bold text-slate-700">Dewasa: <span className="text-emerald-600">{stats.dewasa}</span></div>
            <div className="text-sm font-bold text-slate-700">Lansia: <span className="text-emerald-600">{stats.lansia}</span></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Daftar Induk Penduduk Aktif</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="p-3 border-b">Nama & Posisi</th>
                  <th className="p-3 border-b">NIK</th>
                  <th className="p-3 border-b">Status / Blok</th>
                </tr>
              </thead>
              <tbody>
                {dataWarga.map((w) => (
                  <tr key={w.id} className="border-b hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{w.nama_lengkap}</div>
                      <div className="text-xs font-bold text-blue-600">KEPALA KELUARGA</div>
                      {/* FAKTA PERBAIKAN 3: Merender Anggota Keluarga di Tabel Admin */}
                      {w.anggota_keluarga && w.anggota_keluarga.map((a: any) => (
                        <div key={a.id} className="mt-2 pl-2 border-l-2 border-slate-300">
                          <div className="font-semibold text-slate-700">{a.nama_lengkap}</div>
                          <div className="text-xs text-slate-500 uppercase">{a.hubungan_keluarga} - NIK: {a.nik}</div>
                        </div>
                      ))}
                    </td>
                    <td className="p-3 text-slate-600 font-mono tracking-wider align-top">{w.nik}</td>
                    <td className="p-3 align-top">
                      <div className="font-bold text-slate-700">{w.status_tinggal}</div>
                      <div className="text-xs text-slate-500">{w.detail_alamat}</div>
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