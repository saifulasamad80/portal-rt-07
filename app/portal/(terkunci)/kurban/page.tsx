import { redirect } from "next/navigation";
import Link from "next/link";
import { angkaPostgrest } from "@/lib/angka-postgrest";
import { otentikasiWargaAktif } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";


export default async function TabunganKurbanWarga() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");
  const wargaAktif = otentikasi.sesi;

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);

  // INJEKSI MUTLAK: Mengarahkan tembakan ke tabel transaksi_kurban (Sesuai Admin)
  const { data } = await supabaseAdmin
    .from("transaksi_kurban")
    .select("id, jenis_transaksi, nominal, keterangan, sumber_dana, tanggal_transaksi, created_at")
    .eq("warga_id", wargaAktif.id)
    .eq("rt_id", wargaAktif.rtId)
    .order("tanggal_transaksi", { ascending: false })
    .limit(1000);
  
  const riwayat = (data || []).map((t) => ({
    ...t,
    nominal: angkaPostgrest(t.nominal),
  }));
  
  // FAKTA: Filter dan kalkulasi disesuaikan dengan skema Kurban
  const totalSetor = riwayat.filter(t => t.jenis_transaksi === "Setoran (+)" || t.jenis_transaksi === "Setoran").reduce((sum, t) => sum + t.nominal, 0);
  const totalTarik = riwayat.filter(t => t.jenis_transaksi === "Tarikan (-)" || t.jenis_transaksi === "Penarikan").reduce((sum, t) => sum + t.nominal, 0);
  const saldo = totalSetor - totalTarik;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/portal" className="text-pink-600 font-bold hover:underline mb-4 inline-block">&larr; Kembali ke Dasbor</Link>
        <div className="bg-gradient-to-r from-pink-600 to-rose-800 p-8 rounded-2xl shadow-xl text-white">
          <h2 className="text-pink-100 text-sm font-bold uppercase tracking-widest mb-2">Tabungan Kurban RT 07</h2>
          <div className="text-5xl font-black mb-1">Rp {saldo.toLocaleString("id-ID")}</div>
          <p className="text-sm text-pink-200">Saldo tabungan persiapan kurban Anda.</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border-t-4 border-slate-700">
          <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">📘 Mutasi Tabungan Kurban</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="p-3 border-b">Tanggal</th>
                  <th className="p-3 border-b">Keterangan</th>
                  <th className="p-3 border-b text-right">Mutasi (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.length === 0 ? (
                  <tr><td colSpan={3} className="p-4 text-center text-slate-400 font-bold italic">Belum ada aktivitas tabungan kurban.</td></tr>
                ) : (
                  riwayat.map((t) => (
                    <tr key={t.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {new Date(t.tanggal_transaksi || t.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{t.keterangan}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Sumber: {t.sumber_dana}</div>
                      </td>
                      <td className={`p-3 text-right font-black ${t.jenis_transaksi === 'Setoran (+)' || t.jenis_transaksi === 'Setoran' ? 'text-pink-600' : 'text-rose-600'}`}>
                        {t.jenis_transaksi === 'Setoran (+)' || t.jenis_transaksi === 'Setoran' ? '+' : '-'} {t.nominal.toLocaleString('id-ID')}
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
