import Link from "next/link";
import type { Metadata } from "next";
import {
  BAGIAN_KEBIJAKAN_PRIVASI,
  PENGANTAR_KEBIJAKAN_PRIVASI,
  PENUTUP_KEBIJAKAN_PRIVASI,
  VERSI_KEBIJAKAN_PRIVASI,
} from "@/lib/kebijakan-privasi";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description: "Cara kami menjaga data warga di Portal RT: dipakai untuk administrasi lingkungan, bukan untuk disalahgunakan.",
};

export default function HalamanKebijakanPrivasi() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 flex flex-col items-center py-10 font-sans">
      <div className="w-full max-w-3xl mb-4 text-left">
        <Link href="/login" className="text-blue-600 font-bold hover:underline inline-flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200">
          <span>&larr;</span> Kembali ke Login
        </Link>
      </div>

      <article className="bg-white p-6 md:p-8 rounded-xl w-full max-w-3xl border-t-[8px] border-t-blue-600">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Untuk warga RT</p>
        <h1 className="text-2xl md:text-3xl font-black text-slate-800 mt-2 tracking-tight">Kebijakan Privasi</h1>
        <p className="text-sm text-slate-600 mt-3 leading-relaxed">
          {PENGANTAR_KEBIJAKAN_PRIVASI}
        </p>

        <div className="mt-8 space-y-8">
          {BAGIAN_KEBIJAKAN_PRIVASI.map((bagian) => (
            <section key={bagian.id} id={bagian.id} className="space-y-3">
              <h2 className="text-base font-bold text-slate-800">{bagian.judul}</h2>
              {bagian.pengantar ? (
                <p className="text-sm text-slate-600 leading-relaxed">{bagian.pengantar}</p>
              ) : null}
              <ul className="list-disc space-y-2 pl-5">
                {bagian.paragraf.map((teks) => (
                  <li key={teks} className="text-sm text-slate-600 leading-relaxed">{teks}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-10 text-sm text-slate-500 leading-relaxed">
          {PENUTUP_KEBIJAKAN_PRIVASI}
        </p>
        <p className="mt-3 text-xs text-slate-400 leading-relaxed">
          Versi {VERSI_KEBIJAKAN_PRIVASI}. Jika ada aturan negara yang lebih tinggi, aturan itulah yang diikuti.
          {" "}
          <Link href="/kebijakan-privasi/surat" className="text-blue-600 underline font-semibold">
            Cetak surat kertas dengan naskah yang sama
          </Link>
          .
        </p>
      </article>
    </div>
  );
}
