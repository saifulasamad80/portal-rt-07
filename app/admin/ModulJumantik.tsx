"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const TARGET_MUTLAK = 151;

type BarisJumantik = {
  jumlah_rumah_diperiksa: number | null;
  warga_terjangkit_dbd: boolean | null;
  ditemukan_jentik: boolean | null;
};

type PesanJumantik = { tipe: "sukses" | "gagal"; teks: string } | null;

function angkaRumah(nilai: unknown) {
  return Math.max(0, Math.floor(Number(nilai) || 0));
}

export default function ModulJumantik() {
  const [rumahDiperiksa, setRumahDiperiksa] = useState(0);
  const [isian, setIsian] = useState("");
  const [wargaTerjangkitDbd, setWargaTerjangkitDbd] = useState(false);
  const [ditemukanJentik, setDitemukanJentik] = useState(false);
  const [modalDarurat, setModalDarurat] = useState(false);
  const [sedangMenyimpan, setSedangMenyimpan] = useState(false);
  const [pesan, setPesan] = useState<PesanJumantik>(null);

  const ancamanAktif = wargaTerjangkitDbd || ditemukanJentik;

  useEffect(() => {
    let hidup = true;

    const muatLaporanTerbaru = async () => {
      const pilih = "jumlah_rumah_diperiksa, warga_terjangkit_dbd, ditemukan_jentik";
      let { data, error } = await supabase
        .from("laporan_jumantik")
        .select(pilih)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Kolom created_at tidak wajib: tabel yang dibuat manual mungkin hanya punya id.
      if (error && (error.code === "42703" || error.code === "PGRST204")) {
        ({ data, error } = await supabase.from("laporan_jumantik").select(pilih).order("id", { ascending: false }).limit(1).maybeSingle());
      }

      if (!hidup) return;
      if (error) {
        console.warn("Gagal memuat laporan Jumantik:", error.message);
        return;
      }

      const baris = data as BarisJumantik | null;
      if (!baris) return;

      const angka = angkaRumah(baris.jumlah_rumah_diperiksa);
      const dbd = Boolean(baris.warga_terjangkit_dbd);
      const jentik = Boolean(baris.ditemukan_jentik);
      setRumahDiperiksa(angka);
      setIsian(angka > 0 ? String(angka) : "");
      setWargaTerjangkitDbd(dbd);
      setDitemukanJentik(jentik);
      setModalDarurat(dbd || jentik);
    };

    void muatLaporanTerbaru();
    return () => {
      hidup = false;
    };
  }, []);

  const persentase = useMemo(() => {
    if (rumahDiperiksa <= 0) return 0;
    return Math.min(100, (rumahDiperiksa / TARGET_MUTLAK) * 100);
  }, [rumahDiperiksa]);

  const persentaseTampil = Number.isInteger(persentase)
    ? String(persentase)
    : persentase.toFixed(1);

  const sinkronkanDarurat = (dbd: boolean, jentik: boolean) => {
    setModalDarurat(dbd || jentik);
  };

  const catatLaporan = async (e: React.FormEvent) => {
    e.preventDefault();
    const angka = angkaRumah(isian);
    const sebelumnya = rumahDiperiksa;

    setRumahDiperiksa(angka);
    setIsian(angka === 0 ? "" : String(angka));
    setSedangMenyimpan(true);
    setPesan(null);

    const { error } = await supabase.from("laporan_jumantik").insert([
      {
        jumlah_rumah_diperiksa: angka,
        warga_terjangkit_dbd: wargaTerjangkitDbd,
        ditemukan_jentik: ditemukanJentik,
      },
    ]);

    setSedangMenyimpan(false);

    if (error) {
      setRumahDiperiksa(sebelumnya);
      setIsian(sebelumnya > 0 ? String(sebelumnya) : "");
      setPesan({
        tipe: "gagal",
        teks: "Laporan gagal disimpan ke server. Periksa koneksi, lalu tekan Catat Laporan lagi.",
      });
      return;
    }

    if (wargaTerjangkitDbd || ditemukanJentik) setModalDarurat(true);
    setPesan({ tipe: "sukses", teks: "Laporan Jumantik berhasil dicatat ke database." });
  };

  const warnaBar =
    persentase >= 100 ? "bg-emerald-500" : persentase >= 50 ? "bg-amber-500" : "bg-rose-400";

  return (
    <>
      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-2">
            <span className="w-1 h-3.5 rounded-full bg-rose-500 shrink-0"></span> Kesehatan warga
          </h2>
          <p className="text-[11px] text-slate-400 hidden md:block">Laporan Jumantik harian &amp; peringatan DBD</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-base shrink-0">🦟</div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-800 text-[13px] leading-snug tracking-tight">Pelaporan Jumantik Harian</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">Target mutlak RT 07: {TARGET_MUTLAK} rumah</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider tabular-nums text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md shrink-0">
              {rumahDiperiksa}/{TARGET_MUTLAK}
            </span>
          </div>

          <form onSubmit={catatLaporan} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 mb-4">
            <label className="block">
              <span className="sr-only">Jumlah rumah diperiksa</span>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={isian}
                onChange={(e) => setIsian(e.target.value)}
                placeholder="Jumlah rumah diperiksa hari ini"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
              />
            </label>
            <button
              type="submit"
              disabled={sedangMenyimpan}
              className="bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold px-4 py-2.5 rounded-xl transition-colors active:scale-95 disabled:opacity-50"
            >
              {sedangMenyimpan ? "Menyimpan..." : "Catat Laporan"}
            </button>
          </form>

          {pesan && (
            <p
              className={`text-[11px] font-semibold leading-relaxed mb-4 ${
                pesan.tipe === "sukses" ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {pesan.teks}
            </p>
          )}

          <div className="mb-4">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Cakupan pemeriksaan</span>
              <span className="text-[12px] font-bold tabular-nums text-slate-800">{persentaseTampil}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-300 ${warnaBar}`}
                style={{ width: `${persentase}%` }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(persentase)}
                aria-label="Persentase cakupan Jumantik"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Coverage = rumah diperiksa ÷ {TARGET_MUTLAK} × 100%
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50/60 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={wargaTerjangkitDbd}
                onChange={(e) => {
                  const dicentang = e.target.checked;
                  setWargaTerjangkitDbd(dicentang);
                  sinkronkanDarurat(dicentang, ditemukanJentik);
                }}
                className="mt-0.5 h-4 w-4 rounded border-rose-300 text-rose-600 accent-rose-600 shrink-0"
              />
              <span>
                <span className="block text-[12px] font-bold text-rose-800 leading-snug">Warga Terjangkit DBD</span>
                <span className="block text-[11px] text-rose-600/80 mt-0.5 leading-relaxed">Centang jika ada warga yang terdiagnosis DBD.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/70 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={ditemukanJentik}
                onChange={(e) => {
                  const dicentang = e.target.checked;
                  setDitemukanJentik(dicentang);
                  sinkronkanDarurat(wargaTerjangkitDbd, dicentang);
                }}
                className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 accent-amber-600 shrink-0"
              />
              <span>
                <span className="block text-[12px] font-bold text-amber-900 leading-snug">Ditemukan Jentik</span>
                <span className="block text-[11px] text-amber-800/80 mt-0.5 leading-relaxed">Centang jika jentik nyamuk ditemukan saat pemeriksaan.</span>
              </span>
            </label>
          </div>
        </div>
      </section>

      {modalDarurat && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="judul-darurat-dbd"
        >
          <div className="absolute inset-0 bg-rose-950/75" onClick={() => setModalDarurat(false)} />
          <div className="relative w-full max-w-md rounded-2xl border-2 border-rose-400 bg-rose-600 text-white p-5 shadow-2xl">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-xl shrink-0">🚨</div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-100 mb-1">Peringatan darurat DBD</p>
                <h3 id="judul-darurat-dbd" className="text-lg font-black leading-tight">
                  {wargaTerjangkitDbd && ditemukanJentik
                    ? "Kasus DBD dan jentik terdeteksi"
                    : wargaTerjangkitDbd
                      ? "Warga terjangkit DBD terdeteksi"
                      : "Jentik nyamuk terdeteksi"}
                </h3>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-rose-50 mb-4">
              {wargaTerjangkitDbd && ditemukanJentik
                ? "Ada warga terjangkit DBD dan jentik ditemukan di wilayah RT 07. Segera koordinasikan fogging, abatisasi, dan pemantauan rumah yang belum diperiksa."
                : wargaTerjangkitDbd
                  ? "Ada warga terjangkit DBD di wilayah RT 07. Segera koordinasikan fogging, abatisasi, dan pemantauan rumah yang belum diperiksa."
                  : "Jentik nyamuk ditemukan di wilayah RT 07. Segera koordinasikan fogging, abatisasi, dan pemantauan rumah yang belum diperiksa."}
            </p>
            <button
              type="button"
              onClick={() => setModalDarurat(false)}
              className="w-full bg-white text-rose-700 hover:bg-rose-50 text-[12px] font-bold py-2.5 rounded-xl transition-colors active:scale-95"
            >
              Tutup Peringatan
            </button>
          </div>
        </div>
      )}

      {ancamanAktif && !modalDarurat && (
        <button
          type="button"
          onClick={() => setModalDarurat(true)}
          className="fixed top-4 right-4 z-[70] max-w-xs rounded-2xl border border-rose-300 bg-rose-600 text-white px-4 py-3 shadow-xl text-left"
        >
          <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-rose-100">Peringatan DBD aktif</span>
          <span className="block text-[12px] font-bold mt-0.5 leading-snug">
            {wargaTerjangkitDbd && ditemukanJentik
              ? "Kasus DBD dan jentik tercatat — ketuk untuk buka ulang"
              : wargaTerjangkitDbd
                ? "Kasus DBD tercatat — ketuk untuk buka ulang"
                : "Jentik tercatat — ketuk untuk buka ulang"}
          </span>
        </button>
      )}
    </>
  );
}
