"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Anggota = {
  id: string;
  nama_anggota: string;
  no_whatsapp?: string | null;
  status_keanggotaan: string;
  setoran_terakhir?: number | null;
  pinjaman_berjalan?: number | null;
  catatan?: string | null;
};

type Transaksi = {
  id: string;
  jenis: string;
  nominal: number;
  created_at: string;
  arisan_ibu?: { nama_anggota?: string } | null;
};

const BADGE_STATUS: Record<string, string> = {
  Aktif: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Menunggu: "bg-amber-100 text-amber-700 border-amber-200",
  Lunas: "bg-blue-100 text-blue-700 border-blue-200",
  Nonaktif: "bg-slate-100 text-slate-500 border-slate-200",
};

function formatRupiah(nilai: number) {
  return `Rp ${Number(nilai || 0).toLocaleString("id-ID")}`;
}

export default function ArisanIbuPanel({
  arisan,
  transaksi,
  aksiDaftarArisan,
}: {
  arisan: Anggota[];
  transaksi: Transaksi[];
  aksiDaftarArisan: (nama: string, wa: string, catatan: string) => Promise<{ success: boolean; message?: string }>;
}) {
  const [nama, setNama] = useState("");
  const [wa, setWa] = useState("");
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const totalSetoran = arisan.reduce((sum, a) => sum + Number(a.setoran_terakhir || 0), 0);
  const totalPinjaman = arisan.reduce((sum, a) => sum + Number(a.pinjaman_berjalan || 0), 0);
  const anggotaAktif = arisan.filter((a) => a.status_keanggotaan === "Aktif").length;

  const handleDaftar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await aksiDaftarArisan(nama, wa, catatan);
      if (res.success) {
        alert("Pendaftaran arisan tercatat. Pengurus akan menindaklanjuti.");
        setNama("");
        setWa("");
        setCatatan("");
        router.refresh();
      } else {
        alert(res.message || "Gagal mendaftar.");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal mendaftar.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Anggota Aktif</p>
          <p className="text-2xl font-black text-rose-700">{anggotaAktif}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">dari {arisan.length} terdaftar</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Total Setoran</p>
          <p className="text-lg md:text-2xl font-black text-emerald-700">{formatRupiah(totalSetoran)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Pinjaman Berjalan</p>
          <p className="text-lg md:text-2xl font-black text-amber-700">{formatRupiah(totalPinjaman)}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        <form onSubmit={handleDaftar} className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 h-fit">
          <h2 className="font-bold text-lg text-slate-900">Daftar simpan-pinjam</h2>
          <p className="text-xs text-slate-500">Isi data untuk masuk daftar anggota arisan ibu-ibu RT.</p>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Nama lengkap</label>
            <input required value={nama} onChange={(e) => setNama(e.target.value)} className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:border-rose-400 outline-none transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">WhatsApp</label>
            <input value={wa} onChange={(e) => setWa(e.target.value)} className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:border-rose-400 outline-none transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Catatan (opsional)</label>
            <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 focus:bg-white focus:border-rose-400 outline-none transition-colors" />
          </div>
          <button disabled={loading} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm py-3 rounded-lg disabled:bg-slate-300 transition-colors active:scale-95">
            {loading ? "Menyimpan..." : "Kirim pendaftaran"}
          </button>
        </form>

        <div className="md:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-bold text-lg mb-4 text-slate-900">Anggota arisan</h2>
            {arisan.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
                <p className="text-sm text-slate-500">Belum ada anggota terdaftar.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {arisan.map((row) => (
                  <div key={row.id} className="border border-slate-100 rounded-xl p-4 hover:border-rose-200 transition-colors">
                    <div className="flex justify-between items-start gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {row.nama_anggota.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-semibold text-sm text-slate-900">{row.nama_anggota}</p>
                      </div>
                      <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full border shrink-0 ${BADGE_STATUS[row.status_keanggotaan] || BADGE_STATUS.Nonaktif}`}>
                        {row.status_keanggotaan}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-slate-500 pl-[42px]">
                      <span>Setoran: <strong className="text-emerald-700">{formatRupiah(row.setoran_terakhir || 0)}</strong></span>
                      <span>Pinjaman: <strong className="text-amber-700">{formatRupiah(row.pinjaman_berjalan || 0)}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-bold text-lg mb-4 text-slate-900">Riwayat transaksi terbaru</h2>
            {transaksi.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada transaksi simpan-pinjam tercatat.</p>
            ) : (
              <div className="space-y-2">
                {transaksi.map((row) => (
                  <div key={row.id} className="flex items-center justify-between text-xs border border-slate-100 rounded-lg p-3">
                    <div>
                      <p className="font-semibold text-slate-800">{row.arisan_ibu?.nama_anggota || "Anggota"}</p>
                      <p className="text-slate-400">{new Date(row.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</p>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold ${row.jenis === "Pinjaman" ? "text-amber-700" : row.jenis === "Angsuran" ? "text-blue-700" : "text-emerald-700"}`}>
                        {row.jenis}
                      </span>
                      <p className="font-bold text-slate-800">{formatRupiah(row.nominal)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
