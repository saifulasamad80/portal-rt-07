"use client";

import { useState } from "react";

export type KontakDarurat = {
  id: string;
  nama_layanan: string;
  nomor: string;
  keterangan: string | null;
  ikon: string | null;
  urutan: number;
};

export const KONTAK_DARURAT_RESMI: KontakDarurat[] = [
  { id: "darurat-112", nama_layanan: "Layanan Panggilan Darurat Terpadu", nomor: "112", keterangan: "Nomor darurat terpadu", ikon: "🚨", urutan: 10 },
  { id: "darurat-110", nama_layanan: "Kepolisian Republik Indonesia (Polri)", nomor: "110", keterangan: "Nomor nasional 24 jam", ikon: "👮", urutan: 20 },
  { id: "darurat-119", nama_layanan: "Ambulans & Layanan Medis Darurat", nomor: "119 / 118", keterangan: "Nomor layanan medis darurat", ikon: "🚑", urutan: 30 },
  { id: "darurat-113", nama_layanan: "Pemadam Kebakaran", nomor: "113 / 1131", keterangan: "Nomor pemadam kebakaran", ikon: "🚒", urutan: 40 },
  { id: "darurat-bimas", nama_layanan: "Bimas Kelurahan Tengah", nomor: "081293488745", keterangan: "Kontak Bimas wilayah", ikon: "🛡️", urutan: 50 },
  { id: "darurat-babinsa", nama_layanan: "Babinsa Kelurahan Tengah", nomor: "082112643400", keterangan: "Kontak Babinsa wilayah", ikon: "🪖", urutan: 60 },
];

function tautanTelepon(nomor: string) {
  // Beberapa layanan memiliki dua nomor alternatif (mis. "119 / 118").
  // Jangan menghapus separator lalu menghasilkan nomor gabungan yang tidak
  // valid; tombol memanggil nomor pertama dan nomor alternatif tetap terlihat.
  const nomorPertama = nomor.split("/")[0] || nomor;
  let bersih = nomorPertama.replace(/[^\d+]/g, "");
  if (/^0\d{8,}$/.test(bersih)) {
    bersih = `+62${bersih.slice(1)}`;
  }
  return bersih ? `tel:${bersih}` : null;
}

function tautanWhatsApp(nomor: string) {
  const nomorPertama = nomor.split("/")[0] || nomor;
  let bersih = nomorPertama.replace(/[^\d]/g, "");
  if (/^0\d{8,}$/.test(bersih)) {
    bersih = `62${bersih.slice(1)}`;
  }
  return bersih.startsWith("62") && bersih.length >= 11 ? `https://wa.me/${bersih}` : null;
}

function adalahKontakBimasAtauBabinsa(kontak: KontakDarurat) {
  const kunci = `${kontak.id} ${kontak.nama_layanan}`.toLowerCase();
  return kunci.includes("bimas") || kunci.includes("babinsa");
}

function tampilanNomor(nomor: string) {
  return nomor.replace(/\+62(\d+)/g, "0$1");
}

function TombolAksiWilayah({
  nama,
  tautanTel,
  tautanWa,
  padat = false,
}: {
  nama: string;
  tautanTel: string;
  tautanWa: string | null;
  padat?: boolean;
}) {
  const ukuran = padat ? "px-2 py-2 text-[11px]" : "px-3 py-2.5 text-xs";
  return (
    <div className="mt-3 grid w-full grid-cols-2 gap-2">
      <a
        href={tautanTel}
        aria-label={`Telepon ${nama}`}
        className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-600 font-bold text-white shadow-sm transition-colors hover:bg-rose-700 active:scale-[0.98] ${ukuran}`}
      >
        Telepon
      </a>
      {tautanWa ? (
        <a
          href={tautanWa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${nama}`}
          className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-green-600 font-bold text-white shadow-sm transition-colors hover:bg-green-700 active:scale-[0.98] ${ukuran}`}
        >
          WhatsApp
        </a>
      ) : (
        <span className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-200 font-bold text-slate-400 ${ukuran}`}>
          WhatsApp
        </span>
      )}
    </div>
  );
}

export default function PanicButtonClient({ daftarKontak }: { daftarKontak: KontakDarurat[] }) {
  const [panelTerbuka, setPanelTerbuka] = useState(false);
  const kontakTampil = daftarKontak.length > 0 ? daftarKontak : KONTAK_DARURAT_RESMI;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {kontakTampil.map((kontak) => {
            const tautan = tautanTelepon(kontak.nomor);
            const isi = (
              <>
                <span className="text-2xl leading-none">{kontak.ikon || "📞"}</span>
                <span className="text-[11px] font-bold uppercase leading-tight tracking-[0.12em] text-rose-800">{kontak.nama_layanan}</span>
                <span className="text-lg font-black tabular-nums text-slate-900">{tampilanNomor(kontak.nomor)}</span>
                {kontak.keterangan ? <span className="text-[11px] text-slate-500">{kontak.keterangan}</span> : null}
              </>
            );

            if (adalahKontakBimasAtauBabinsa(kontak) && tautan) {
              return (
                <div
                  key={kontak.id}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-rose-100 bg-white px-4 py-5 text-center shadow-sm"
                >
                  {isi}
                  <TombolAksiWilayah
                    nama={kontak.nama_layanan}
                    tautanTel={tautan}
                    tautanWa={tautanWhatsApp(kontak.nomor)}
                  />
                </div>
              );
            }

            if (!tautan) {
              return (
                <div
                  key={kontak.id}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-5 text-center"
                >
                  {isi}
                </div>
              );
            }

            return (
              <a
                key={kontak.id}
                href={tautan}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-rose-100 bg-white px-4 py-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-md"
              >
                {isi}
              </a>
            );
          })}
      </div>

      <button
        type="button"
        onClick={() => setPanelTerbuka((buka) => !buka)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-xl text-white shadow-[0_12px_30px_rgba(225,29,72,0.45)] transition-transform hover:scale-105 active:scale-95 md:hidden"
        aria-expanded={panelTerbuka}
        aria-label="Buka panic button"
      >
        🚨
      </button>

      {panelTerbuka ? (
        <div className="fixed inset-x-4 bottom-24 z-50 rounded-2xl border border-rose-200 bg-white p-4 shadow-2xl md:hidden">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-rose-700">Panggilan darurat</p>
          <div className="grid grid-cols-2 gap-2">
            {kontakTampil.map((kontak) => {
              const tautan = tautanTelepon(kontak.nomor);
              if (!tautan) return null;
              if (adalahKontakBimasAtauBabinsa(kontak)) {
                return (
                  <div
                    key={`fab-${kontak.id}`}
                    className="col-span-2 flex flex-col items-center gap-1 rounded-xl bg-rose-50 px-3 py-3 text-center"
                  >
                    <span>{kontak.ikon || "📞"}</span>
                    <span className="text-[10px] font-bold leading-tight text-rose-800">{kontak.nama_layanan}</span>
                    <span className="text-xs font-black tabular-nums text-slate-800">{tampilanNomor(kontak.nomor)}</span>
                    <TombolAksiWilayah
                      nama={kontak.nama_layanan}
                      tautanTel={tautan}
                      tautanWa={tautanWhatsApp(kontak.nomor)}
                      padat
                    />
                  </div>
                );
              }
              return (
                <a
                  key={`fab-${kontak.id}`}
                  href={tautan}
                  className="flex flex-col items-center gap-1 rounded-xl bg-rose-50 px-2 py-3 text-center"
                >
                  <span>{kontak.ikon || "📞"}</span>
                  <span className="text-[10px] font-bold leading-tight text-rose-800">{kontak.nama_layanan}</span>
                  <span className="text-xs font-black tabular-nums text-slate-800">{tampilanNomor(kontak.nomor)}</span>
                </a>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
