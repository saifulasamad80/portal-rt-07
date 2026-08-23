"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EVotingWarga() {
  const [warga, setWarga] = useState<any>(null);
  const [daftarVoting, setDaftarVoting] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const sesi = localStorage.getItem("warga_aktif");
    if (!sesi) {
      router.push("/login");
      return;
    }
    const dataWarga = JSON.parse(sesi);
    setWarga(dataWarga);
    fetchVoting(dataWarga.id);
  }, [router]);

  const fetchVoting = async (idWarga: string) => {
    // Tarik semua topik voting yang masih aktif
    const { data: topikData } = await supabase
      .from("voting_rt")
      .select("*")
      .eq("status", "Aktif")
      .order("created_at", { ascending: false });

    if (!topikData) {
      setLoading(false);
      return;
    }

    // Cek apakah warga ini sudah pernah milih di masing-masing topik
    const { data: suaraWarga } = await supabase
      .from("suara_voting")
      .select("voting_id, pilihan")
      .eq("warga_id", idWarga);

    // Hitung total suara sementara untuk tiap topik
    const { data: semuaSuara } = await supabase
      .from("suara_voting")
      .select("voting_id, pilihan");

    const votingTerkalkulasi = topikData.map((topik) => {
      const suaraSaya = suaraWarga?.find((s) => s.voting_id === topik.id);
      const totalSuaraTopik = semuaSuara?.filter((s) => s.voting_id === topik.id) || [];
      const suaraOpsi1 = totalSuaraTopik.filter(s => s.pilihan === topik.opsi_1).length;
      const suaraOpsi2 = totalSuaraTopik.filter(s => s.pilihan === topik.opsi_2).length;
      const totalSemua = suaraOpsi1 + suaraOpsi2;

      return {
        ...topik,
        sudahMemilih: !!suaraSaya,
        pilihanSaya: suaraSaya ? suaraSaya.pilihan : null,
        statistik: {
          opsi_1: totalSemua === 0 ? 0 : Math.round((suaraOpsi1 / totalSemua) * 100),
          opsi_2: totalSemua === 0 ? 0 : Math.round((suaraOpsi2 / totalSemua) * 100),
          total: totalSemua
        }
      };
    });

    setDaftarVoting(votingTerkalkulasi);
    setLoading(false);
  };

  const handleCoblos = async (votingId: string, pilihanWarga: string) => {
    if (!confirm(`Yakin ingin memilih "${pilihanWarga}"? Pilihan yang sudah masuk tidak bisa diubah.`)) return;
    
    setSubmitLoading(true);
    const { error } = await supabase.from("suara_voting").insert([{
      voting_id: votingId,
      warga_id: warga.id,
      pilihan: pilihanWarga
    }]);

    if (error) {
      alert("Gagal menyimpan suara: " + error.message);
    } else {
      alert("Suara Anda berhasil masuk ke kotak suara digital!");
      fetchVoting(warga.id); // Refresh data
    }
    setSubmitLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Membuka bilik suara...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        
        <Link href="/portal" className="text-indigo-600 font-bold hover:underline mb-4 inline-block">
          &larr; Kembali ke Dasbor
        </Link>

        <div className="bg-white p-6 rounded-xl shadow border-l-8 border-indigo-500">
          <h1 className="text-2xl font-bold text-slate-800">E-Voting Warga RT 07</h1>
          <p className="text-slate-500 text-sm">Sistem pemungutan suara transparan. 1 NIK, 1 Suara. Bebas dari kecurangan.</p>
        </div>

        <div className="space-y-6">
          {daftarVoting.length === 0 ? (
            <div className="bg-white p-8 rounded-xl shadow text-center font-bold text-slate-400 italic">
              Belum ada topik pemilihan yang sedang berlangsung.
            </div>
          ) : (
            daftarVoting.map((voting) => (
              <div key={voting.id} className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-slate-700">
                <h2 className="font-bold text-xl text-slate-800 mb-2">{voting.judul}</h2>
                <p className="text-slate-600 text-sm mb-6 pb-4 border-b">{voting.deskripsi}</p>
                
                {voting.sudahMemilih ? (
                  <div className="space-y-4">
                    <div className="bg-indigo-50 text-indigo-800 p-3 rounded-lg text-center font-bold text-sm mb-4">
                      ✅ Anda sudah memilih: "{voting.pilihanSaya}"
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                        <span>{voting.opsi_1}</span>
                        <span>{voting.statistik.opsi_1}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                        <div className="bg-indigo-500 h-4 rounded-full transition-all duration-1000" style={{ width: `${voting.statistik.opsi_1}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                        <span>{voting.opsi_2}</span>
                        <span>{voting.statistik.opsi_2}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                        <div className="bg-slate-500 h-4 rounded-full transition-all duration-1000" style={{ width: `${voting.statistik.opsi_2}%` }}></div>
                      </div>
                    </div>
                    <div className="text-right text-xs font-bold text-slate-400 mt-2">Total Suara Masuk: {voting.statistik.total}</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={() => handleCoblos(voting.id, voting.opsi_1)} disabled={submitLoading} className="p-4 border-2 border-indigo-200 rounded-xl font-bold text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 transition-all text-center">
                      🗳️ Pilih: {voting.opsi_1}
                    </button>
                    <button onClick={() => handleCoblos(voting.id, voting.opsi_2)} disabled={submitLoading} className="p-4 border-2 border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all text-center">
                      🗳️ Pilih: {voting.opsi_2}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}