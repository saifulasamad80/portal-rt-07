"use client";
import { useMemo, useState, useEffect } from "react";

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="bg-slate-100 animate-pulse h-32 rounded-xl border border-slate-200"></div>)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {/* Widget 1: Gender */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
        <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-3 flex justify-between items-center">
          <span>🚻 Gender</span> <span className="text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">{demoStat.jiwa} Jiwa</span>
        </h3>
        <div className="w-full flex h-2 rounded-full overflow-hidden mb-3 bg-slate-200 shadow-inner">
          {demoStat.laki_c > 0 && <div className="bg-blue-500 transition-all duration-1000 ease-out" style={{ width: `${demoStat.laki_p}%` }}></div>}
          {demoStat.perempuan_c > 0 && <div className="bg-pink-500 transition-all duration-1000 ease-out" style={{ width: `${demoStat.perempuan_p}%` }}></div>}
        </div>
        <div className="flex flex-col gap-1.5 text-[9px] font-bold text-slate-500">
          <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm"></span>Laki-laki</div> <span>{demoStat.laki_c}</span></div>
          <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-pink-500 shadow-sm"></span>Perempuan</div> <span>{demoStat.perempuan_c}</span></div>
        </div>
      </div>

      {/* Widget 2: Usia */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
        <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-3 flex justify-between items-center">
          <span>🎂 Kategori Usia</span> <span className="text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">{demoStat.jiwa} Jiwa</span>
        </h3>
        <div className="w-full flex h-2 rounded-full overflow-hidden mb-3 bg-slate-200 shadow-inner">
          {demoStat.dewasa_c > 0 && <div className="bg-emerald-500 transition-all duration-1000 ease-out" style={{ width: `${demoStat.dewasa_p}%` }}></div>}
          {demoStat.anak_c > 0 && <div className="bg-teal-400 transition-all duration-1000 ease-out" style={{ width: `${demoStat.anak_p}%` }}></div>}
          {demoStat.balita_c > 0 && <div className="bg-cyan-400 transition-all duration-1000 ease-out" style={{ width: `${demoStat.balita_p}%` }}></div>}
          {demoStat.lansia_c > 0 && <div className="bg-slate-400 transition-all duration-1000 ease-out" style={{ width: `${demoStat.lansia_p}%` }}></div>}
        </div>
        <div className="grid grid-cols-1 gap-1.5 text-[9px] font-bold text-slate-500">
          <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm"></span>Dewasa</div> <span>{demoStat.dewasa_c}</span></div>
          <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-400 shadow-sm"></span>Anak</div> <span>{demoStat.anak_c}</span></div>
          <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm"></span>Balita</div> <span>{demoStat.balita_c}</span></div>
          <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400 shadow-sm"></span>Lansia</div> <span>{demoStat.lansia_c}</span></div>
        </div>
      </div>

      {/* Widget 3: Agama */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
        <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-3 flex justify-between items-center">
          <span>🕌 Agama</span> <span className="text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">{demoStat.jiwa} Jiwa</span>
        </h3>
        <div className="w-full flex h-2 rounded-full overflow-hidden mb-3 bg-slate-200 shadow-inner">
          {demoStat.islam_c > 0 && <div className="bg-emerald-600 transition-all duration-1000 ease-out" style={{ width: `${demoStat.islam_p}%` }}></div>}
          {demoStat.kristen_c > 0 && <div className="bg-indigo-400 transition-all duration-1000 ease-out" style={{ width: `${demoStat.kristen_p}%` }}></div>}
          {demoStat.lainAgama_c > 0 && <div className="bg-amber-400 transition-all duration-1000 ease-out" style={{ width: `${demoStat.lainAgama_p}%` }}></div>}
        </div>
        <div className="grid grid-cols-1 gap-1.5 text-[9px] font-bold text-slate-500">
          <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-600 shadow-sm"></span>Islam</div> <span>{demoStat.islam_c}</span></div>
          <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400 shadow-sm"></span>Kristen/Katolik</div> <span>{demoStat.kristen_c}</span></div>
          <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 shadow-sm"></span>Lainnya</div> <span>{demoStat.lainAgama_c}</span></div>
        </div>
      </div>

      {/* Widget 4: Pekerjaan */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
        <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-3 flex justify-between items-center">
          <span>💼 Pekerjaan</span> <span className="text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">{demoStat.jiwa} Jiwa</span>
        </h3>
        <div className="w-full flex h-2 rounded-full overflow-hidden mb-3 bg-slate-200 shadow-inner">
          {demoStat.swasta_c > 0 && <div className="bg-blue-600 transition-all duration-1000 ease-out" style={{ width: `${demoStat.swasta_p}%` }}></div>}
          {demoStat.wirausaha_c > 0 && <div className="bg-orange-500 transition-all duration-1000 ease-out" style={{ width: `${demoStat.wirausaha_p}%` }}></div>}
          {demoStat.pns_c > 0 && <div className="bg-slate-700 transition-all duration-1000 ease-out" style={{ width: `${demoStat.pns_p}%` }}></div>}
          {demoStat.lainKerja_c > 0 && <div className="bg-slate-300 transition-all duration-1000 ease-out" style={{ width: `${demoStat.lainKerja_p}%` }}></div>}
        </div>
        <div className="grid grid-cols-1 gap-1.5 text-[9px] font-bold text-slate-500">
          <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-600 shadow-sm"></span>Swasta</div> <span>{demoStat.swasta_c}</span></div>
          <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500 shadow-sm"></span>Wirausaha</div> <span>{demoStat.wirausaha_c}</span></div>
          <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-700 shadow-sm"></span>PNS/TNI</div> <span>{demoStat.pns_c}</span></div>
          <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300 shadow-sm"></span>Lainnya</div> <span>{demoStat.lainKerja_c}</span></div>
        </div>
      </div>
    </div>
  );
}