import Link from "next/link";

export type LapakPublikKartu = {
  id: string;
  nama_usaha: string;
  kategori: string;
  deskripsi: string;
  foto_url: string;
};

export default function LapakPublik({ daftarLapak }: { daftarLapak: LapakPublikKartu[] }) {
  return (
    <article id="umkm" className="scroll-mt-24 h-full rounded-2xl border border-[#e4dccb] bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">UMKM Warga</p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-slate-900">Lapak tetangga</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
            Barang dan jasa yang sudah disetujui pengurus. Nomor WhatsApp hanya terbuka setelah Anda masuk portal.
          </p>
        </div>
        <Link
          href="/portal/lapak"
          className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 hover:bg-amber-100"
        >
          Masuk ke pasar
        </Link>
      </div>

      {daftarLapak.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d9d0bf] bg-[#fbf8f1] px-4 py-10 text-center">
          <p className="text-sm font-semibold text-slate-700">Belum ada lapak yang tampil.</p>
          <p className="mt-1 text-[12px] text-slate-500">
            Warga mendaftar di portal, pengurus menyetujui, lalu produk muncul di sini.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {daftarLapak.map((lapak) => (
            <li key={lapak.id} className="flex gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <img
                src={lapak.foto_url}
                alt={lapak.nama_usaha}
                className="h-24 w-24 shrink-0 object-cover"
              />
              <div className="min-w-0 flex-1 py-2.5 pr-3">
                <p className="truncate text-[10px] font-bold uppercase tracking-wider text-amber-700">{lapak.kategori}</p>
                <p className="truncate text-sm font-semibold text-slate-800">{lapak.nama_usaha}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">{lapak.deskripsi}</p>
                <Link href="/portal/lapak" className="mt-1.5 inline-flex text-[11px] font-bold text-emerald-700 hover:text-emerald-800">
                  Masuk untuk hubungi
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
