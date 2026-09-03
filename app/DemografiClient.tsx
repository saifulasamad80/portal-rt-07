"use client";
import { useMemo, useState, useEffect } from "react";

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

export default function DemografiClient({ dataWarga }: { dataWarga: any[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const demoStat = useMemo(() => {
    let totalJiwa = 0;
    let laki = 0, perempuan = 0;
    let balita = 0, anak = 0, dewasa = 0, lansia = 0;
    let islam = 0, kristen = 0, hinduBudhaLain = 0;
    let pns = 0, swasta = 0, wirausaha = 0, lainPekerjaan = 0;

    const hitungUmur = (tglLahir: string) => {
      if (!tglLahir) return 0;
      const birth = new Date(tglLahir);
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
      return age;
    };

    const prosesIndividu = (p: any) => {
      totalJiwa++;
      const jk = (p.jenis_kelamin || "").toLowerCase();
      if (jk.includes("laki") || jk === "l") laki++;
      else if (jk.includes("perempuan") || jk === "p") perempuan++;

      const umur = hitungUmur(p.tanggal_lahir);
      if (umur <= 4) balita++; else if (umur <= 17) anak++; else if (umur <= 55) dewasa++; else lansia++;

      const agm = (p.agama || "").toLowerCase();
      if (agm.includes("islam")) islam++; else if (agm.includes("kristen") || agm.includes("katolik") || agm.includes("katholik")) kristen++; else if (agm) hinduBudhaLain++;

      const pkj = (p.pekerjaan || "").toLowerCase();
      if (pkj.includes("pns") || pkj.includes("tni") || pkj.includes("polri") || pkj.includes("negeri")) pns++;
      else if (pkj.includes("karyawan") || pkj.includes("swasta") || pkj.includes("pegawai") || pkj.includes("buruh") || pkj.includes("guru") || pkj.includes("staff")) swasta++;
      else if (pkj.includes("wirausaha") || pkj.includes("wiraswasta") || pkj.includes("dagang") || pkj.includes("usaha") || pkj.includes("freelance")) wirausaha++;
      else lainPekerjaan++;
    };

    dataWarga.forEach(w => {
      prosesIndividu(w);
      if (w.anggota_keluarga) w.anggota_keluarga.forEach((ak: any) => prosesIndividu(ak));
    });

    const pct = (val: number, total: number) => total === 0 ? 0 : Math.round((val / total) * 100);

    return {
      jiwa: totalJiwa,
      laki_c: laki, laki_p: pct(laki, totalJiwa), perempuan_c: perempuan, perempuan_p: pct(perempuan, totalJiwa),
      balita_c: balita, balita_p: pct(balita, totalJiwa), anak_c: anak, anak_p: pct(anak, totalJiwa), dewasa_c: dewasa, dewasa_p: pct(dewasa, totalJiwa), lansia_c: lansia, lansia_p: pct(lansia, totalJiwa),
      islam_c: islam, islam_p: pct(islam, totalJiwa), kristen_c: kristen, kristen_p: pct(kristen, totalJiwa), lainAgama_c: hinduBudhaLain, lainAgama_p: pct(hinduBudhaLain, totalJiwa),
      swasta_c: swasta, swasta_p: pct(swasta, totalJiwa), wirausaha_c: wirausaha, wirausaha_p: pct(wirausaha, totalJiwa), pns_c: pns, pns_p: pct(pns, totalJiwa), lainKerja_c: lainPekerjaan, lainKerja_p: pct(lainPekerjaan, totalJiwa)
    };
  }, [dataWarga]);

  // SKELETON LOADER (Mencegah Hydration Error)
  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="bg-slate-100 animate-pulse h-36 rounded-xl border border-slate-200"></div>)}
        </div>
        <div className="bg-slate-100 animate-pulse h-36 rounded-xl border border-slate-200"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tiga pilar utama sejajar: Gender, Usia, Pekerjaan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KartuDemografi
          ikon="🚻"
          judul="Gender"
          total={demoStat.jiwa}
          segmen={[
            { label: "Laki-laki", nilai: demoStat.laki_c, persen: demoStat.laki_p, warna: "#3b82f6" },
            { label: "Perempuan", nilai: demoStat.perempuan_c, persen: demoStat.perempuan_p, warna: "#ec4899" },
          ]}
        />

        <KartuDemografi
          ikon="🎂"
          judul="Kategori Usia"
          total={demoStat.jiwa}
          segmen={[
            { label: "Dewasa", nilai: demoStat.dewasa_c, persen: demoStat.dewasa_p, warna: "#10b981" },
            { label: "Anak", nilai: demoStat.anak_c, persen: demoStat.anak_p, warna: "#2dd4bf" },
            { label: "Balita", nilai: demoStat.balita_c, persen: demoStat.balita_p, warna: "#22d3ee" },
            { label: "Lansia", nilai: demoStat.lansia_c, persen: demoStat.lansia_p, warna: "#94a3b8" },
          ]}
        />

        <KartuDemografi
          ikon="💼"
          judul="Pekerjaan"
          total={demoStat.jiwa}
          segmen={[
            { label: "Swasta", nilai: demoStat.swasta_c, persen: demoStat.swasta_p, warna: "#2563eb" },
            { label: "Wirausaha", nilai: demoStat.wirausaha_c, persen: demoStat.wirausaha_p, warna: "#f97316" },
            { label: "PNS/TNI", nilai: demoStat.pns_c, persen: demoStat.pns_p, warna: "#334155" },
            { label: "Lainnya", nilai: demoStat.lainKerja_c, persen: demoStat.lainKerja_p, warna: "#cbd5e1" },
          ]}
        />
      </div>

      {/* Agama tetap ditampilkan penuh di bawah supaya tiga pilar di atas
          benar-benar sejajar bertiga, tanpa membuang data yang sudah dihitung. */}
      <KartuDemografi
        ikon="🕌"
        judul="Agama"
        total={demoStat.jiwa}
        segmen={[
          { label: "Islam", nilai: demoStat.islam_c, persen: demoStat.islam_p, warna: "#059669" },
          { label: "Kristen/Katolik", nilai: demoStat.kristen_c, persen: demoStat.kristen_p, warna: "#818cf8" },
          { label: "Lainnya", nilai: demoStat.lainAgama_c, persen: demoStat.lainAgama_p, warna: "#fbbf24" },
        ]}
      />
    </div>
  );
}