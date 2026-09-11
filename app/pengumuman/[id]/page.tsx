import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ThumbnailPdf from "@/components/ThumbnailPdf";
import TombolShareWhatsAppPengumuman from "@/components/TombolShareWhatsAppPengumuman";
import { adalahUrlGambar, adalahUrlPdf, labelAksiLampiran } from "@/lib/lampiran-pengumuman";
import { ringkasTeksPengumuman } from "@/lib/pesan-whatsapp-pengumuman";
import { ambilPengumumanPublik } from "@/lib/pengumuman-publik";

export const dynamic = "force-dynamic";

type PropsHalaman = { params: Promise<{ id: string }> };

function formatTanggalPublikasi(nilai: string | null) {
  if (!nilai) return "";
  const tanggal = new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return "";
  return tanggal.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

function namaWilayah(masterRt: { nama_rt: string | null; nama_rw: string | null; kelurahan: string | null } | null) {
  return [masterRt?.kelurahan ? `Kel. ${masterRt.kelurahan}` : null, masterRt?.nama_rw, masterRt?.nama_rt || "RT"]
    .filter(Boolean)
    .join(" · ");
}

export async function generateMetadata({ params }: PropsHalaman): Promise<Metadata> {
  const { id } = await params;
  const muatan = await ambilPengumumanPublik(id);
  if (!muatan) return { title: "Pengumuman tidak ditemukan" };
  const { siaran } = muatan;
  const deskripsi = ringkasTeksPengumuman(siaran.deskripsi || "", 160) || "Pengumuman resmi pengurus RT.";
  return {
    title: siaran.judul,
    description: deskripsi,
    openGraph: {
      title: siaran.judul,
      description: deskripsi,
      url: `/pengumuman/${siaran.id}`,
      type: "article",
    },
  };
}

export default async function HalamanPengumumanPublik({ params }: PropsHalaman) {
  const { id } = await params;
  const muatan = await ambilPengumumanPublik(id);
  if (!muatan) notFound();

  const { siaran, masterRt } = muatan;
  const namaRt = String(masterRt?.nama_rt || "RT").trim() || "RT";
  const tanggal = formatTanggalPublikasi(siaran.tanggal_publikasi);
  const deskripsi = siaran.deskripsi || "";

  return (
    <div className="min-h-screen bg-[#F6F1E8] text-slate-800 font-sans">
      <header className="border-b border-white/10 bg-[#0F241C]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-[#E8C56A]">Pengumuman resmi</p>
            <p className="truncate text-sm font-semibold text-white">{namaWilayah(masterRt)}</p>
          </div>
          <Link href="/#pengumuman" className="shrink-0 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-white/20">
            Mading
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <article className="rounded-2xl border border-[#e4dccb] bg-white p-6 shadow-sm md:p-8">
          {tanggal ? (
            <span className="inline-block rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700">
              {tanggal}
            </span>
          ) : null}
          <h1 className="mt-4 text-2xl font-black leading-tight text-slate-900 md:text-3xl">{siaran.judul}</h1>
          <div className="mt-5 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-600">
            {deskripsi}
          </div>

          {siaran.link_dokumen ? (
            <div className="mt-6 space-y-3">
              {adalahUrlGambar(siaran.link_dokumen) ? (
                <img
                  src={siaran.link_dokumen}
                  alt=""
                  className="w-full max-h-[28rem] rounded-xl border border-slate-200 bg-slate-50 object-contain"
                />
              ) : null}
              {adalahUrlPdf(siaran.link_dokumen) ? (
                <div className="h-56 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <ThumbnailPdf url={siaran.link_dokumen} alt="" />
                </div>
              ) : null}
              <a
                href={siaran.link_dokumen}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center rounded-xl bg-slate-900 py-4 text-xs font-black text-white shadow-md transition-colors hover:bg-slate-800 active:scale-95"
              >
                {labelAksiLampiran(siaran.link_dokumen)}
              </a>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <TombolShareWhatsAppPengumuman
              id={siaran.id}
              judul={siaran.judul}
              deskripsi={deskripsi}
              namaRt={namaRt}
              className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-center text-xs font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-emerald-600 active:scale-95"
            >
              📲 Bagikan ke WhatsApp
            </TombolShareWhatsAppPengumuman>
            <Link
              href="/#pengumuman"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-xs font-black uppercase tracking-wider text-slate-700 transition-colors hover:bg-slate-50"
            >
              Lihat mading lain
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
