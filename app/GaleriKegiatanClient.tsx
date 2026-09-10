"use client";

import { useState } from "react";

export type FotoKegiatan = {
  id: string;
  judul: string;
  deskripsi: string | null;
  url_foto: string;
  kategori: string | null;
  tanggal_kegiatan: string | null;
};

function formatTanggal(nilai: string | null) {
  if (!nilai) return null;
  return new Date(nilai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function kelasGrid(jumlah: number) {
  if (jumlah === 1) return "grid grid-cols-1";
  if (jumlah === 2) return "grid grid-cols-2";
  return "grid grid-cols-2 md:grid-cols-3";
}

export default function GaleriKegiatanClient({ daftarFoto }: { daftarFoto: FotoKegiatan[] }) {
  const [fotoAktif, setFotoAktif] = useState<FotoKegiatan | null>(null);

  if (daftarFoto.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d9d0bf] bg-[#fbf8f1] px-6 py-14 text-center">
        <p className="text-sm font-semibold text-slate-700">Dinding galeri masih kosong.</p>
        <p className="mt-1 text-[12px] text-slate-500">Foto kerja bakti, posyandu, dan hajatan warga akan tampil di sini setelah pengurus mengunggahnya.</p>
      </div>
    );
  }

  return (
    <>
      <div className={`${kelasGrid(daftarFoto.length)} gap-3`}>
        {daftarFoto.map((foto) => (
          <button
            type="button"
            key={foto.id}
            onClick={() => setFotoAktif(foto)}
            className={`group relative overflow-hidden rounded-2xl border border-[#e4dccb] bg-slate-900 text-left ${
              daftarFoto.length === 1 ? "aspect-[16/9] md:max-w-3xl" : "aspect-[4/3]"
            }`}
          >
            <img
              src={foto.url_foto}
              alt={foto.judul}
              className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-3 pt-8">
              <span className="block text-[9px] font-bold uppercase tracking-widest text-[#E8C56A]">
                {foto.kategori || "Kegiatan"}
              </span>
              <span className="mt-0.5 block truncate text-[12px] font-semibold text-white">{foto.judul}</span>
            </span>
          </button>
        ))}
      </div>

      {fotoAktif ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0F241C]/80 p-4 backdrop-blur-sm" onClick={() => setFotoAktif(null)}>
          <figure className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={fotoAktif.url_foto} alt={fotoAktif.judul} className="max-h-[70vh] w-full object-contain bg-slate-950" />
            <figcaption className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                {fotoAktif.kategori || "Kegiatan"} {formatTanggal(fotoAktif.tanggal_kegiatan) ? `· ${formatTanggal(fotoAktif.tanggal_kegiatan)}` : ""}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">{fotoAktif.judul}</h3>
              {fotoAktif.deskripsi ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{fotoAktif.deskripsi}</p> : null}
            </figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}
