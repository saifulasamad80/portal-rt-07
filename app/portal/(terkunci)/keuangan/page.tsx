import { redirect } from "next/navigation";
import TautanHalus from "@/components/TautanHalus";
import { otentikasiWargaAktif } from "@/lib/session-security";
import { ambilRiwayatKasRumahTangga } from "@/lib/rumah-tangga-warga";

export default async function KeuanganWarga() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");

  const kasRumah = await ambilRiwayatKasRumahTangga(otentikasi.sesi);
  const riwayat = kasRumah.riwayat;
  const totalPartisipasi = riwayat.reduce((sum, t) => sum + t.nominal, 0);
  const iuranMasuk = riwayat.filter((t) => t.tipe_transaksi === "Pemasukan");
  const lastPaymentStr = iuranMasuk.length > 0 ? iuranMasuk[0].created_at : null;
  const labelRumah = kasRumah.rumah.adalahTanggungan && kasRumah.rumah.namaKepala
    ? `kartu keluarga ${kasRumah.rumah.namaKepala}`
    : "akun Anda";

  let teksTunggakan = "Belum Ada Data";
  let statusTheme: "emerald" | "amber" | "rose" = "rose";

  if (lastPaymentStr) {
    const now = new Date();
    const lastDate = new Date(lastPaymentStr);
    const diffMonths = (now.getFullYear() - lastDate.getFullYear()) * 12 + (now.getMonth() - lastDate.getMonth());
    
    if (diffMonths <= 0) {
      teksTunggakan = "Lunas Bulan Ini";
      statusTheme = "emerald";
    } else if (diffMonths >= 3) {
      teksTunggakan = "Nunggak ≥ 3 Bulan";
      statusTheme = "rose";
    } else {
      teksTunggakan = `Nunggak ${diffMonths} Bulan`;
      statusTheme = "amber";
    }
  }

  const themeStyles = {
    emerald: { wrapper: "bg-emerald-50 border-emerald-200", badge: "bg-emerald-500", title: "text-emerald-800", value: "text-emerald-700", sub: "text-emerald-600", icon: "🌟 Status Iuran Aktif" },
    amber: { wrapper: "bg-amber-50 border-amber-200", badge: "bg-amber-500", title: "text-amber-800", value: "text-amber-700", sub: "text-amber-600", icon: "⚠️ Peringatan Sistem" },
    rose: { wrapper: "bg-rose-50 border-rose-200", badge: "bg-rose-500", title: "text-rose-800", value: "text-rose-700", sub: "text-rose-600", icon: "🚨 Peringatan Tunggakan" }
  };
  
  const s = themeStyles[statusTheme];

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <TautanHalus href="/portal" className="text-blue-600 font-bold hover:underline mb-4 inline-block">&larr; Kembali ke Dasbor</TautanHalus>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="bg-white p-8 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-200 flex flex-col justify-center">
            <h2 className="text-slate-500 text-sm font-bold uppercase tracking-wide mb-2">Total Partisipasi Kas</h2>
            <div className="text-4xl md:text-5xl font-black text-slate-800 tabular-nums">
              Rp {totalPartisipasi.toLocaleString("id-ID")}
            </div>
            <p className="text-xs text-slate-400 mt-4 border-t border-slate-100 pt-3">
              Akumulasi iuran {labelRumah} yang telah divalidasi RT. Halaman ini hanya untuk melihat.
            </p>
          </div>

          <div className={`p-8 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border flex flex-col justify-center relative overflow-hidden transition-colors ${s.wrapper}`}>
            <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 rounded-bl-full ${s.badge}`}></div>
            <h2 className={`text-sm font-bold uppercase tracking-wide mb-2 flex items-center gap-2 ${s.title}`}>
              {s.icon}
            </h2>
            <div className={`text-3xl md:text-4xl font-black tracking-tight ${s.value}`}>
              {teksTunggakan}
            </div>
            <p className={`text-xs mt-4 border-t border-black/10 pt-3 font-medium ${s.sub}`}>
              {lastPaymentStr 
                ? `Terakhir tercatat: ${new Date(lastPaymentStr).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}`
                : "Belum ada iuran tercatat pada kartu keluarga ini."}
            </p>
          </div>

        </div>

        <div className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-200">
          <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-200 pb-3">Riwayat pembayaran {labelRumah}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-900 border-b border-slate-200">
                  <th className="p-3 font-semibold">Tanggal Validasi</th>
                  <th className="p-3 font-semibold">Kategori & Keterangan</th>
                  <th className="p-3 font-semibold text-right">Nominal Tercatat</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.length === 0 ? (
                  <tr><td colSpan={3} className="p-4 text-center text-slate-400 font-bold italic">Belum ada riwayat iuran.</td></tr>
                ) : (
                  riwayat.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-600">{new Date(t.created_at).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{t.kategori}</div>
                        <div className="text-slate-500 text-xs mt-0.5">{t.keterangan || "-"}</div>
                      </td>
                      <td className={`p-3 text-right font-bold tabular-nums ${t.tipe_transaksi === 'Pemasukan' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {t.tipe_transaksi === 'Pemasukan' ? '+' : '-'} Rp {t.nominal.toLocaleString('id-ID')}
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
