"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function TabunganKurbanWarga() {
  const [warga, setWarga] = useState<any>(null);
  const [riwayat, setRiwayat] = useState<any[]>([]);
  const [saldo, setSaldo] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const sesi = localStorage.getItem("warga_aktif");
    if (!sesi) {
      router.push("/login");
      return;
    }
    const dataWarga = JSON.parse(sesi);
    setWarga(dataWarga);
    fetchDataKurban(dataWarga.id);
  }, [router]);

  const fetchDataKurban = async (idWarga: string) => {
    const { data } = await supabase
      .from("tabungan_kurban")
      .select("*")
      .eq("warga_id", idWarga)
      .order("created_at", { ascending: false });
    
    if (data) {
      setRiwayat(data);
      // Kalkulasi Saldo Real-Time
      const totalSetor = data.filter(t => t.jenis_transaksi === "Setor").reduce((sum, t) => sum + t.nominal, 0);
      const totalTarik = data.filter(t => t.jenis_transaksi === "Tarik").reduce((sum, t) => sum + t.nominal, 0);
      setSaldo(totalSetor - totalTarik);
    }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Membuka catatan kurban...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <Link href="/portal" className="text-amber-600 font-bold hover:underline mb-4 inline-block">
          &larr; Kembali ke Dasbor
        </Link>

        {/* KARTU TABUNGAN KURBAN */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-700 p-8 rounded-2xl shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-10 rounded-full -mr-10 -mt-10"></div>
          <div className="absolute bottom-0 right-20 w-20 h-20 bg-white opacity-10 rounded-full mb-4"></div>
          
          <h2 className="text-amber-100 text-sm font-bold uppercase tracking-widest mb-2">Persiapan Kurban Idul Adha</h2>
          <div className="text-5xl font-black mb-2">Rp {saldo.toLocaleString("id-ID")}</div>
          <p className="text-sm text-amber-100 font-medium">Berapapun nominalnya, niat baik Anda tercatat dengan aman dan transparan.</p>
        </div>

        {/* TABEL RIWAYAT TRANSAKSI */}
        <div className="bg-white p-6 rounded-xl shadow border-t-4 border-slate-700">
          <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
            <span className="text-xl">🐄</span> Riwayat Setoran Kurban
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="p-3 border-b">Tanggal</th>
                  <th className="p-3 border-b">Keterangan & Sumber</th>
                  <th className="p-3 border-b text-right">Mutasi (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.length === 0 ? (
                  <tr><td colSpan={3} className="p-4 text-center text-slate-400 font-bold italic">Belum ada aktivitas tabungan kurban.</td></tr>
                ) : (
                  riwayat.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 text-slate-600 whitespace-nowrap">{new Date(t.created_at).toLocaleDateString('id-ID')}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{t.keterangan}</div>
                        <div className={`text-[11px] mt-1 inline-block px-2 py-0.5 rounded font-bold ${t.sumber_dana === 'Potong Saldo Sampah' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'}`}>
                          {t.sumber_dana !== '-' ? `Asal: ${t.sumber_dana}` : 'Penarikan'}
                        </div>
                      </td>
                      <td className={`p-3 text-right font-black ${t.jenis_transaksi === 'Setor' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.jenis_transaksi === 'Setor' ? '+' : '-'} {t.nominal.toLocaleString('id-ID')}
                      </td>
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