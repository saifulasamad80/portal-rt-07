type BarisBalita = {
  id: string;
  nama_anak: string;
  nama_ibu?: string | null;
  tanggal_kunjungan: string;
  berat_kg?: number | null;
  tinggi_cm?: number | null;
  imunisasi?: string | null;
  catatan?: string | null;
};

function formatTanggal(tanggal: string) {
  try {
    return new Date(tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return tanggal;
  }
}

export default function PosyanduBalitaPanel({ data }: { data: BarisBalita[] }) {
  const bulanIni = new Date();
  const kunjunganBulanIni = data.filter((row) => {
    const d = new Date(row.tanggal_kunjungan);
    return d.getMonth() === bulanIni.getMonth() && d.getFullYear() === bulanIni.getFullYear();
  }).length;
  const jumlahAnak = new Set(data.map((row) => row.nama_anak)).size;
  const sudahImunisasi = data.filter((row) => row.imunisasi && row.imunisasi.trim() !== "").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Total Kunjungan</p>
          <p className="text-2xl font-black text-sky-700">{data.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Bulan Ini</p>
          <p className="text-2xl font-black text-sky-700">{kunjunganBulanIni}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Anak Terdata</p>
          <p className="text-2xl font-black text-sky-700">{jumlahAnak}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Sudah Imunisasi</p>
          <p className="text-2xl font-black text-emerald-700">{sudahImunisasi}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-bold text-lg mb-4 text-slate-900">Riwayat Tumbuh Kembang</h2>

        {data.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
            <div className="text-3xl mb-2">👶</div>
            <p className="text-sm text-slate-500">Belum ada catatan tumbuh kembang. Hasil timbang dan imunisasi akan tampil di sini.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.map((row) => (
              <div key={row.id} className="border border-slate-200 rounded-xl p-4 hover:border-sky-200 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold shrink-0">
                      {row.nama_anak.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm leading-tight">{row.nama_anak}</p>
                      <p className="text-xs text-slate-400">{row.nama_ibu ? `Ibu: ${row.nama_ibu}` : "Ibu tidak dicatat"} · {formatTanggal(row.tanggal_kunjungan)}</p>
                    </div>
                  </div>
                  {row.imunisasi ? (
                    <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full border shrink-0 bg-emerald-100 text-emerald-700 border-emerald-200">
                      Imunisasi
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full border shrink-0 bg-slate-100 text-slate-500 border-slate-200">
                      Belum
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-slate-50 rounded-lg py-2">
                    <p className="text-[9px] font-bold uppercase text-slate-400">Berat</p>
                    <p className="text-sm font-bold text-slate-700">{row.berat_kg ? `${row.berat_kg} kg` : "—"}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg py-2">
                    <p className="text-[9px] font-bold uppercase text-slate-400">Tinggi</p>
                    <p className="text-sm font-bold text-slate-700">{row.tinggi_cm ? `${row.tinggi_cm} cm` : "—"}</p>
                  </div>
                </div>
                {row.imunisasi && (
                  <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                    💉 <span className="font-semibold">{row.imunisasi}</span>
                  </p>
                )}
                {row.catatan && (
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">📝 {row.catatan}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
