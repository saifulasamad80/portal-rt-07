"use client";

import type { RekapDemografi } from "@/lib/demografi-publik";

type SegmenDemografi = { label: string; nilai: number; persen: number; warna: string };

/**
 * Donat CSS murni (conic-gradient) sebagai dudukan grafik.
 *
 * Warna dikirim sebagai nilai hex, bukan class Tailwind, karena conic-gradient
 * hanya menerima warna CSS sungguhan. Bila nanti diganti Pie/Donut Chart dari
 * chart.js, cukup tukar isi komponen ini — ukuran slot dan legenda di sebelahnya
 * tidak perlu ikut berubah.
 */
function DonutDemografi({ total, segmen }: { total: number; segmen: SegmenDemografi[] }) {
  const terisi = segmen.filter((s) => s.nilai > 0);

  let mulai = 0;
  const potongan = terisi.map((s, i) => {
    // Persen sudah dibulatkan di demoStat, jadi jumlahnya bisa meleset dari 100.
    // Segmen terakhir dipaksa menutup lingkaran agar tidak menyisakan celah.
    const akhir = i === terisi.length - 1 ? 100 : mulai + s.persen;
    const bagian = `${s.warna} ${mulai}% ${akhir}%`;
    mulai = akhir;
    return bagian;
  });

  const gradien = potongan.length > 0 ? `conic-gradient(${potongan.join(", ")})` : "conic-gradient(#e2e8f0 0% 100%)";

  return (
    <div className="relative w-24 h-24 shrink-0 rounded-full shadow-inner" style={{ background: gradien }}>
      <div className="absolute inset-[26%] bg-white rounded-full flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-slate-800 tabular-nums leading-none">{total}</span>
        <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Jiwa</span>
      </div>
    </div>
  );
}

function KartuDemografi({
  ikon,
  judul,
  total,
  segmen,
}: {
  ikon: string;
  judul: string;
  total: number;
  segmen: SegmenDemografi[];
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <span className="text-sm">{ikon}</span> {judul}
        </h3>
      </div>

      <div className="flex items-center gap-4">
        <DonutDemografi total={total} segmen={segmen} />

        <ul className="flex-1 min-w-0 space-y-1.5">
          {segmen.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-2 text-[10px]">
              <span className="flex items-center gap-1.5 font-semibold text-slate-500 truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.warna }}></span>
                {s.label}
              </span>
              <span className="font-bold text-slate-700 tabular-nums shrink-0">
                {s.nilai} <span className="font-semibold text-slate-400">({s.persen}%)</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function DemografiClient({ rekap }: { rekap: RekapDemografi }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KartuDemografi
          ikon="🚻"
          judul="Gender"
          total={rekap.jiwa}
          segmen={[
            { label: "Laki-laki", nilai: rekap.laki_c, persen: rekap.laki_p, warna: "#3b82f6" },
            { label: "Perempuan", nilai: rekap.perempuan_c, persen: rekap.perempuan_p, warna: "#ec4899" },
          ]}
        />

        <KartuDemografi
          ikon="🎂"
          judul="Kategori Usia"
          total={rekap.jiwaDenganUsia}
          segmen={[
            { label: "Dewasa", nilai: rekap.dewasa_c, persen: rekap.dewasa_p, warna: "#10b981" },
            { label: "Anak", nilai: rekap.anak_c, persen: rekap.anak_p, warna: "#2dd4bf" },
            { label: "Balita", nilai: rekap.balita_c, persen: rekap.balita_p, warna: "#22d3ee" },
            { label: "Lansia", nilai: rekap.lansia_c, persen: rekap.lansia_p, warna: "#94a3b8" },
          ]}
        />

        <KartuDemografi
          ikon="💼"
          judul="Pekerjaan"
          total={rekap.jiwa}
          segmen={[
            { label: "Swasta", nilai: rekap.swasta_c, persen: rekap.swasta_p, warna: "#2563eb" },
            { label: "Wirausaha", nilai: rekap.wirausaha_c, persen: rekap.wirausaha_p, warna: "#f97316" },
            { label: "PNS/TNI", nilai: rekap.pns_c, persen: rekap.pns_p, warna: "#334155" },
            { label: "Lainnya", nilai: rekap.lainKerja_c, persen: rekap.lainKerja_p, warna: "#cbd5e1" },
          ]}
        />
      </div>

      <KartuDemografi
        ikon="🕌"
        judul="Agama"
        total={rekap.jiwa}
        segmen={[
          { label: "Islam", nilai: rekap.islam_c, persen: rekap.islam_p, warna: "#059669" },
          { label: "Kristen/Katolik", nilai: rekap.kristen_c, persen: rekap.kristen_p, warna: "#818cf8" },
          { label: "Lainnya", nilai: rekap.lainAgama_c, persen: rekap.lainAgama_p, warna: "#fbbf24" },
        ]}
      />
    </div>
  );
}
