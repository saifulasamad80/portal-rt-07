"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function KeuanganWarga() {
  const [warga, setWarga] = useState<any>(null);
  const [riwayatPribadi, setRiwayatPribadi] = useState<any[]>([]);
  const [saldoRT, setSaldoRT] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // SATPAM HALAMAN
  useEffect(() => {
    const sesi = localStorage.getItem("warga_aktif");
    if (!sesi) {
      router.push("/login");
      return;
    }
    const dataWarga = JSON.parse(sesi);
    setWarga(dataWarga);
    fetchDataKeuangan(dataWarga.id);
  }, [router]);

  const fetchDataKeuangan = async (idWarga: string) => {
    // 1. Tarik riwayat iuran khusus milik warga yang sedang login
    const { data: dataPribadi } = await supabase
      .from("kas_rt")
      .select("*")
      .eq("warga_id", idWarga)
      .order("created_at", { ascending: false });
    
    setRiwayatPribadi(dataPribadi || []);

    // 2. Kalkulasi total Saldo RT (Tanpa membocorkan detail pengeluaran/pemasukan warga lain)
    const { data: dataKas } = await supabase.from("kas_rt").select("tipe_transaksi, nominal");
    if (dataKas) {
      const totalIn = dataKas.filter(t => t.tipe_transaksi === "Pemasukan").reduce((sum, t) => sum + t.nominal, 0);
      const totalOut = dataKas.filter(t => t.tipe_transaksi === "Pengeluaran").reduce((sum, t) => sum + t.nominal, 0);
      setSaldoRT(totalIn - totalOut);
    }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Menarik data dari brankas RT...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <Link href="/portal" className="text-blue-600 font-bold hover:underline mb-4 inline-block">
          &larr; Kembali ke Dasbor
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* KARTU TRANSPARANSI */}
          <div className="bg-gradient-to-br from-blue-700 to-blue-900 p-6 rounded-xl shadow-lg text-white">
            <h2 className="text-blue-100 text-sm font-bold uppercase mb-1">Transparansi Kas RT 07</h2>
            <div className="text-4xl font-black mb-2">Rp {saldoRT.toLocaleString("id-ID")}</div>
            <p className="text-xs text-blue-200">Total saldo real-time dari seluruh pemasukan & pengeluaran operasional.</p>
          </div>

          {/* KARTU PARTISIPASI PRIBADI */}
          <div className="bg-white p-6 rounded-xl shadow border-t-4 border-emerald-500">
            <h2 className="text-slate-500 text-sm font-bold uppercase mb-1">Total Partisipasi Anda</h2>
            <div className="text-4xl font-black text-emerald-600 mb-2">
              Rp {riwayatPribadi.reduce((sum, t) => sum + t.nominal, 0).toLocaleString("id-ID")}
            </div>
            <p className="text-xs text-slate-500">Total akumulasi iuran yang telah Anda setorkan dan divalidasi oleh RT.</p>
          </div>
        </div>

        {/* TABEL RIWAYAT PRIBADI */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Riwayat Iuran Anda</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="p-3 border-b">Tanggal Validasi</th>
                  <th className="p-3 border-b">Kategori & Keterangan</th>
                  <th className="p-3 border-b text-right">Nominal Tercatat</th>
                </tr>
              </thead>
              <tbody>
                {riwayatPribadi.length === 0 ? (
                  <tr><td colSpan={3} className="p-4 text-center text-slate-400 font-bold italic">Belum ada riwayat iuran yang tercatat.</td></tr>
                ) : (
                  riwayatPribadi.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 text-slate-600">{new Date(t.created_at).toLocaleDateString('id-ID')}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{t.kategori}</div>
                        <div className="text-slate-500">{t.keterangan}</div>
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-600">Rp {t.nominal.toLocaleString('id-ID')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}