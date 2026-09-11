import Link from "next/link";
import type { Metadata } from "next";
import TombolCetak from "./TombolCetak";
import {
  BAGIAN_KEBIJAKAN_PRIVASI,
  PATH_KEBIJAKAN_PRIVASI,
  PENGANTAR_KEBIJAKAN_PRIVASI,
  PENUTUP_KEBIJAKAN_PRIVASI,
  TEKS_PEMBERITAHUAN_DATA_LAMA,
  VERSI_KEBIJAKAN_PRIVASI,
} from "@/lib/kebijakan-privasi";

export const metadata: Metadata = {
  title: "Surat pernyataan pelindungan data",
  description: "Naskah kertas yang sama dengan Kebijakan Privasi di situs, untuk kepala keluarga yang tidak membuka portal.",
};

export default function HalamanSuratPersetujuan() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans print:bg-white">
      <div className="max-w-3xl mx-auto px-4 py-8 print:px-0 print:py-0">
        <div className="mb-6 flex flex-wrap gap-3 print:hidden">
          <Link href={PATH_KEBIJAKAN_PRIVASI} className="text-blue-700 font-semibold hover:underline">
            Kembali ke Kebijakan Privasi
          </Link>
          <TombolCetak />
        </div>

        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Portal RT · versi {VERSI_KEBIJAKAN_PRIVASI}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Surat pernyataan pelindungan data pribadi</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{PENGANTAR_KEBIJAKAN_PRIVASI}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{TEKS_PEMBERITAHUAN_DATA_LAMA}</p>
        <p className="mt-3 text-sm font-semibold text-slate-800">
          Naskah di bawah ini sama dengan halaman Kebijakan Privasi di situs. Jangan ganti versi atau meringkas menjadi satu tanda tangan “setuju semua”.
        </p>

        <div className="mt-8 space-y-6">
          {BAGIAN_KEBIJAKAN_PRIVASI.map((bagian) => (
            <section key={bagian.id}>
              <h2 className="text-base font-bold">{bagian.judul}</h2>
              {bagian.pengantar ? <p className="mt-2 text-sm leading-relaxed text-slate-700">{bagian.pengantar}</p> : null}
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {bagian.paragraf.map((teks) => (
                  <li key={teks} className="text-sm leading-relaxed text-slate-700">{teks}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-8 text-sm leading-relaxed text-slate-600">{PENUTUP_KEBIJAKAN_PRIVASI}</p>

        <section className="mt-10 break-inside-avoid rounded-xl border border-slate-300 p-5">
          <h2 className="text-base font-bold">Pernyataan kepala keluarga</h2>
          <p className="mt-2 text-sm text-slate-600">Centang yang sesuai. Jangan digabung dengan surat pernyataan kebenaran Carik.</p>
          <div className="mt-4 space-y-3 text-sm">
            <p>☐ Saya telah membaca naskah Kebijakan Privasi versi {VERSI_KEBIJAKAN_PRIVASI}.</p>
            <p>☐ Saya menyetujui pemrosesan data administrasi RT saya (nama, alamat, NIK, WhatsApp) untuk buku induk, surat, iuran, dan layanan portal.</p>
            <p>☐ Saya menyetujui pemrosesan kisaran pendapatan dan daya listrik rumah tangga untuk program RT, bukan DTKS/bansos pemerintah.</p>
            <p>☐ Saya penanggung jawab rumah tangga dan berwenang mendaftarkan data anggota keluarga dewasa.</p>
            <p>☐ Saya orang tua atau wali dari anak di bawah 18 tahun yang didaftarkan, dan menyetujui pemrosesan data anak itu.</p>
            <p>☐ Saya menyetujui pencatatan kunjungan posyandu individu rumah tangga ini.</p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <p className="text-sm">Nama: ________________________________</p>
            <p className="text-sm">Tanggal: ______________________________</p>
            <p className="text-sm md:col-span-2">Tanda tangan: ________________________________</p>
          </div>
          <p className="mt-6 text-[11px] text-slate-500">
            Pengurus mengunggah salinan bertanda tangan di kartu warga, dengan versi {VERSI_KEBIJAKAN_PRIVASI} dan tanggal tanda tangan. Tanpa unggah, centang di buku induk tidak cukup.
          </p>
        </section>
      </div>
    </div>
  );
}
