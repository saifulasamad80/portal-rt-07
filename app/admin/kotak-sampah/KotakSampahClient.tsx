"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BundelKotakSampah, HasilKotakSampah } from "@/lib/kotak-sampah-tipe";
import PesanDialog from "@/components/PesanDialog";

type Notifikasi = { tipe: "sukses" | "gagal"; pesan: string } | null;

export default function KotakSampahClient({
  bundel,
  pesanMuat,
  aksiPulihkanItem,
  aksiPulihkanBundel,
}: {
  bundel: BundelKotakSampah[];
  pesanMuat: string | null;
  aksiPulihkanItem: (id: string) => Promise<HasilKotakSampah>;
  aksiPulihkanBundel: (idBundel: string) => Promise<HasilKotakSampah>;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState("");
  const [notifikasi, setNotifikasi] = useState<Notifikasi>(null);

  const jalankan = async (id: string, aksi: () => Promise<HasilKotakSampah>) => {
    setLoadingId(id);
    setNotifikasi(null);
    try {
      const hasil = await aksi();
      setNotifikasi({ tipe: hasil.success ? "sukses" : "gagal", pesan: hasil.message });
      if (hasil.success) router.refresh();
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Gagal memulihkan data.";
      setNotifikasi({ tipe: "gagal", pesan });
    } finally {
      setLoadingId("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <Link href="/admin" className="text-blue-700 font-semibold text-sm hover:underline">
          ← Kembali ke dasbor
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-xl shrink-0">
              🗑️
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Kotak Sampah Warga</h1>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Data yang dihapus dari buku induk masuk ke sini dulu, bukan hilang permanen.
                Pulihkan akun kepala keluarga beserta tanggungan yang terhapus bersamanya.
              </p>
            </div>
          </div>
        </div>

        <PesanDialog
          pesan={
            notifikasi
              ? {
                  tipe: notifikasi.tipe,
                  teks: notifikasi.pesan,
                  judul: notifikasi.tipe === "gagal" ? "Pemulihan belum berhasil" : "Pemulihan berhasil",
                }
              : null
          }
          onClose={() => setNotifikasi(null)}
        />

        {pesanMuat ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {pesanMuat}
          </div>
        ) : null}

        {bundel.length === 0 && !pesanMuat ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
            Kotak sampah kosong. Belum ada data warga yang dihapus sejak fitur ini aktif.
          </div>
        ) : (
          <div className="space-y-3">
            {bundel.map((item) => {
              const judul = item.kepala?.nama_tampil || item.anggota[0]?.nama_tampil || "Data tanpa nama";
              const jumlah = (item.kepala ? 1 : 0) + item.anggota.length;
              const waktu = new Date(item.dihapus_pada).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              });
              return (
                <article key={item.bundel_id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-slate-900 text-[15px]">{judul}</h2>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {waktu}
                        {item.aktor ? ` · ${item.aktor}` : ""}
                        {item.alasan ? ` · ${item.alasan}` : ""}
                        {` · ${jumlah} baris`}
                      </p>
                      <ul className="mt-2 text-[12px] text-slate-600 space-y-0.5">
                        {item.kepala ? <li>KK: {item.kepala.nama_tampil}</li> : null}
                        {item.anggota.map((anggota) => (
                          <li key={anggota.id}>Tanggungan: {anggota.nama_tampil}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
                      <button
                        type="button"
                        disabled={loadingId === item.bundel_id}
                        onClick={() => {
                          if (!confirm(`Kembalikan ${judul} dan seluruh baris dalam bundel ini ke buku induk?`)) return;
                          void jalankan(item.bundel_id, () => aksiPulihkanBundel(item.bundel_id));
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2.5 rounded-lg disabled:opacity-50"
                      >
                        {loadingId === item.bundel_id ? "Memulihkan..." : "Pulihkan semuanya"}
                      </button>
                      {(item.kepala ? [item.kepala, ...item.anggota] : item.anggota).map((baris) => (
                        <button
                          key={baris.id}
                          type="button"
                          disabled={Boolean(loadingId)}
                          onClick={() => {
                            if (!confirm(`Kembalikan hanya ${baris.nama_tampil}?`)) return;
                            void jalankan(baris.id, () => aksiPulihkanItem(baris.id));
                          }}
                          className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg disabled:opacity-50"
                        >
                          Pulihkan {baris.nama_tampil}
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
