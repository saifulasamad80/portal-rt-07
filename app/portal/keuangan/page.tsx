"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function KeuanganWarga() {
  const [warga, setWarga] = useState<any>(null);
  const [riwayatPribadi, setRiwayatPribadi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
        fetchDataKeuangan(profilWarga.id);
      } else {
        router.push("/login");
      }
    };
    cekSesiWarga();
  }, [router]);

  const fetchDataKeuangan = async (idWarga: string) => {
    const { data: dataPribadi } = await supabase
      .from("kas_rt")
      .select("*")
      .eq("warga_id", idWarga)
      .order("created_at", { ascending: false });
    
    setRiwayatPribadi(dataPribadi || []);
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Menarik data dari brankas RT...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/portal" className="text-blue-600 font-bold hover:underline mb-4 inline-block">&larr; Kembali ke Dasbor</Link>
        
        <div className="bg-white p-8 rounded-xl shadow-lg border-t-8 border-emerald-500 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-slate-500 text-sm font-bold uppercase mb-1">Total Partisipasi Anda</h2>
            <div className="text-5xl font-black text-emerald-600 mb-2">
              Rp {riwayatPribadi.reduce((sum, t) => sum + t.nominal, 0).toLocaleString("id-ID")}
            </div>
            <p className="text-sm text-slate-500">Akumulasi iuran Anda yang telah disetorkan dan divalidasi oleh pengurus RT.</p>
          </div>
          <div className="text-6xl opacity-20 hidden md:block">💰</div>
        </div>

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
                  <tr><td colSpan={3} className="p-4 text-center text-slate-400 font-bold italic">Belum ada riwayat iuran.</td></tr>
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