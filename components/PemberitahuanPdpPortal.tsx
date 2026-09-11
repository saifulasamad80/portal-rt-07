"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PATH_KEBIJAKAN_PRIVASI,
  PATH_SURAT_PERSETUJUAN,
  TEKS_PEMBERITAHUAN_DATA_LAMA,
  USIA_ANAK_PDP,
  VERSI_KEBIJAKAN_PRIVASI,
} from "@/lib/kebijakan-privasi";
import { aksiSimpanPersetujuanPortal } from "@/app/portal/persetujuan-actions";

export default function PemberitahuanPdpPortal({
  bolehIsiIzin,
  jumlahAnggota,
  jumlahAnak,
  sudahAdaJejak,
}: {
  bolehIsiIzin: boolean;
  jumlahAnggota: number;
  jumlahAnak: number;
  sudahAdaJejak: boolean;
}) {
  const [baca, setBaca] = useState(false);
  const [pribadi, setPribadi] = useState(false);
  const [keuangan, setKeuangan] = useState(false);
  const [anggota, setAnggota] = useState(false);
  const [anak, setAnak] = useState(false);
  const [kesehatan, setKesehatan] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const kirim = async () => {
    setLoading(true);
    setPesan(null);
    try {
      const hasil = await aksiSimpanPersetujuanPortal({
        versi_naskah: VERSI_KEBIJAKAN_PRIVASI,
        baca_kebijakan: baca,
        data_pribadi: pribadi,
        data_keuangan: keuangan,
        data_anggota: jumlahAnggota > 0 && anggota,
        data_anak: jumlahAnak > 0 && anak,
        data_kesehatan: kesehatan,
      });
      setPesan(hasil.message);
    } catch {
      setPesan("Izin belum dapat dikirim.");
    }
    setLoading(false);
  };

  return (
    <section className="bg-white border border-blue-100 rounded-2xl p-4 shadow-sm space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Pelindungan data</p>
      <p className="text-[13px] text-slate-700 leading-relaxed">{TEKS_PEMBERITAHUAN_DATA_LAMA}</p>
      <p className="text-[12px] text-slate-500">
        <Link href={PATH_KEBIJAKAN_PRIVASI} className="text-blue-700 font-semibold underline">Baca Kebijakan Privasi</Link>
        {" · "}
        <Link href={PATH_SURAT_PERSETUJUAN} className="text-blue-700 font-semibold underline">Surat kertas</Link>
      </p>
      {sudahAdaJejak ? (
        <p className="text-[12px] text-emerald-800">Izin versi {VERSI_KEBIJAKAN_PRIVASI} sudah tercatat untuk rumah tangga ini.</p>
      ) : bolehIsiIzin ? (
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-[13px] text-slate-700">
            <input type="checkbox" className="mt-1" checked={baca} onChange={(e) => setBaca(e.target.checked)} />
            <span>Saya telah membaca naskah versi {VERSI_KEBIJAKAN_PRIVASI}.</span>
          </label>
          <label className="flex items-start gap-2 text-[13px] text-slate-700">
            <input type="checkbox" className="mt-1" checked={pribadi} onChange={(e) => setPribadi(e.target.checked)} />
            <span>Saya setuju data administrasi RT (nama, alamat, NIK, WhatsApp) dipakai untuk surat, iuran, dan layanan portal.</span>
          </label>
          <label className="flex items-start gap-2 text-[13px] text-slate-700">
            <input type="checkbox" className="mt-1" checked={keuangan} onChange={(e) => setKeuangan(e.target.checked)} />
            <span>Saya setuju kisaran pendapatan dan daya listrik dipakai untuk program RT. Jika tidak, data itu akan dikosongkan setelah tenggat.</span>
          </label>
          {jumlahAnggota > 0 ? (
            <label className="flex items-start gap-2 text-[13px] text-slate-700">
              <input type="checkbox" className="mt-1" checked={anggota} onChange={(e) => setAnggota(e.target.checked)} />
              <span>Saya berwenang untuk data anggota keluarga yang tercatat.</span>
            </label>
          ) : null}
          {jumlahAnak > 0 ? (
            <label className="flex items-start gap-2 text-[13px] text-amber-950">
              <input type="checkbox" className="mt-1" checked={anak} onChange={(e) => setAnak(e.target.checked)} />
              <span>Saya wali anak di bawah {USIA_ANAK_PDP} tahun yang tercatat.</span>
            </label>
          ) : null}
          <label className="flex items-start gap-2 text-[13px] text-slate-700">
            <input type="checkbox" className="mt-1" checked={kesehatan} onChange={(e) => setKesehatan(e.target.checked)} />
            <span>Saya setuju pengurus mencatat kunjungan posyandu individu rumah tangga ini.</span>
          </label>
          <button type="button" disabled={loading} onClick={kirim} className="rounded-lg bg-slate-900 text-white text-xs font-bold px-4 py-2 disabled:opacity-50">
            {loading ? "Menyimpan..." : "Catat izin"}
          </button>
          {pesan ? <p className="text-[12px] text-slate-600">{pesan}</p> : null}
        </div>
      ) : (
        <p className="text-[12px] text-slate-500">Izin rumah tangga diisi kepala keluarga, atau lewat surat kertas ke pengurus.</p>
      )}
    </section>
  );
}
