type BarisLansia = {
  id: string;
  nama_peserta: string;
  tanggal_kunjungan: string;
  tekanan_darah?: string | null;
  gula_darah?: string | null;
  berat_kg?: number | null;
  catatan?: string | null;
};

function statusTekananDarah(tekanan?: string | null) {
  if (!tekanan) return null;
  const bagian = tekanan.split("/").map((n) => parseInt(n.trim(), 10));
  const sistolik = bagian[0];
  if (!sistolik || Number.isNaN(sistolik)) return null;
  if (sistolik >= 140) return { label: "Tinggi", warna: "bg-rose-100 text-rose-700 border-rose-200" };
  if (sistolik < 100) return { label: "Rendah", warna: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "Normal", warna: "bg-emerald-100 text-emerald-700 border-emerald-200" };
}

function formatTanggal(tanggal: string) {
  try {
    return new Date(tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return tanggal;
  }
}

export default function PosyanduLansiaPanel({ data }: { data: BarisLansia[] }) {
  const bulanIni = new Date();
  const kunjunganBulanIni = data.filter((row) => {
    const d = new Date(row.tanggal_kunjungan);
    return d.getMonth() === bulanIni.getMonth() && d.getFullYear() === bulanIni.getFullYear();
  }).length;
  const jumlahPeserta = new Set(data.map((row) => row.nama_peserta)).size;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Total Kunjungan</p>
          <p className="text-2xl font-black text-violet-700">{data.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Bulan Ini</p>
          <p className="text-2xl font-black text-violet-700">{kunjunganBulanIni}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Peserta Terdata</p>
          <p className="text-2xl font-black text-violet-700">{jumlahPeserta}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-bold text-lg mb-4 text-slate-900">Riwayat Kunjungan</h2>

        {data.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
            <div className="text-3xl mb-2">👵</div>
            <p className="text-sm text-slate-500">Belum ada catatan kunjungan. Pengurus akan mengisi hasil pemeriksaan di sini.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.map((row) => {
              const status = statusTekananDarah(row.tekanan_darah);
              return (
                <div key={row.id} className="border border-slate-200 rounded-xl p-4 hover:border-violet-200 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold shrink-0">
                        {row.nama_peserta.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm leading-tight">{row.nama_peserta}</p>
                        <p className="text-xs text-slate-400">{formatTanggal(row.tanggal_kunjungan)}</p>
                      </div>
                    </div>
                    {status && (
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border shrink-0 ${status.warna}`}>
                        {status.label}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 rounded-lg py-2">
                      <p className="text-[9px] font-bold uppercase text-slate-400">Tensi</p>
                      <p className="text-sm font-bold text-slate-700">{row.tekanan_darah || "—"}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg py-2">
                      <p className="text-[9px] font-bold uppercase text-slate-400">Gula</p>
                      <p className="text-sm font-bold text-slate-700">{row.gula_darah || "—"}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg py-2">
                      <p className="text-[9px] font-bold uppercase text-slate-400">Berat</p>
                      <p className="text-sm font-bold text-slate-700">{row.berat_kg ? `${row.berat_kg} kg` : "—"}</p>
                    </div>
                  </div>
                  {row.catatan && (
                    <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 leading-relaxed">
                      📝 {row.catatan}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
