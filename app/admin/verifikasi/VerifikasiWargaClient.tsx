"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import TombolNotifikasiPush from "@/components/TombolNotifikasiPush";
import PesanDialog from "@/components/PesanDialog";

const FITUR_KTP_AKTIF = false;

type Notifikasi = { tipe: "sukses" | "gagal"; pesan: string } | null;
type HasilValidasi = { success: boolean; message: string };
type ProsesValidasi = (idWarga: string, status: string) => Promise<HasilValidasi>;

export type AnggotaAntrean = {
  id?: string;
  nama_lengkap?: string | null;
  hubungan_keluarga?: string | null;
};

export type WargaAntrean = {
  id: string;
  nik?: string | null;
  nama_lengkap?: string | null;
  no_whatsapp?: string | null;
  status_tinggal?: string | null;
  detail_alamat?: string | null;
  status_verifikasi?: string | null;
  status_validasi?: string | null;
  ktp_path?: string | null;
  kk_path?: string | null;
  created_at?: string | null;
  anggota_keluarga?: AnggotaAntrean[] | null;
};

function nilaiKosong(nilai: unknown) {
  const teks = String(nilai ?? "").trim();
  return teks === "" || teks === "-" || teks === "MENYUSUL";
}

export default function VerifikasiWargaClient({
  wargaList,
  tautanRujukan,
  prosesValidasi,
}: {
  wargaList: WargaAntrean[];
  tautanRujukan: string;
  prosesValidasi: ProsesValidasi;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState("");
  const [notifikasi, setNotifikasi] = useState<Notifikasi>(null);
  const daftar = Array.isArray(wargaList) ? wargaList : [];

  const handleValidasi = async (idWarga: string, status: string, namaWarga: string, ktpPath: string, kkPath: string) => {
    const namaTampil = namaWarga || "warga ini";
    const dokumenKosong = FITUR_KTP_AKTIF
      ? (nilaiKosong(ktpPath) || nilaiKosong(kkPath))
      : nilaiKosong(kkPath);

    if (status === "Disetujui" && dokumenKosong) {
      const berani = confirm(`Dokumen digital ${namaTampil} masih kosong. Tetap setujui dan masukkan ke Buku Induk?`);
      if (!berani) return;
    } else if (!confirm(`Tandai ${namaTampil} sebagai ${status}?`)) {
      return;
    }

    setLoadingId(idWarga);
    setNotifikasi(null);
    try {
      const hasil = await prosesValidasi(idWarga, status);
      if (hasil?.success) {
        setNotifikasi({ tipe: "sukses", pesan: hasil.message || `${namaTampil} berhasil divalidasi.` });
      } else {
        setNotifikasi({ tipe: "gagal", pesan: hasil?.message || "Validasi gagal diproses." });
      }
      router.refresh();
    } catch (error: unknown) {
      const pesan = error instanceof Error ? error.message : "kesalahan tidak diketahui";
      setNotifikasi({ tipe: "gagal", pesan: `Jaringan atau server tidak merespons: ${pesan}` });
    }
    setLoadingId("");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link href="/admin" className="text-blue-600 font-bold text-sm hover:underline inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-amber-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Verifikasi Pendaftaran</h1>
            <p className="text-slate-400 text-sm">
              Hanya akun aktif yang belum Disetujui (Menunggu atau Ditolak). Setelah Disetujui, baris pindah ke Buku Induk.
            </p>
          </div>
          <TombolNotifikasiPush sasaran="pengurus" />
        </div>

        <PesanDialog
          pesan={
            notifikasi
              ? {
                  tipe: notifikasi.tipe,
                  teks: notifikasi.pesan,
                  judul: notifikasi.tipe === "gagal" ? "Validasi belum berhasil" : "Validasi berhasil",
                  deskripsi:
                    notifikasi.tipe === "gagal"
                      ? "Periksa keterangan di bawah sebelum mencoba lagi."
                      : "Perubahan status warga sudah dicatat.",
                }
              : null
          }
          onClose={() => setNotifikasi(null)}
        />

        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tautan rujukan publik</p>
          <p className="text-sm font-mono font-bold text-slate-800 break-all">{tautanRujukan}</p>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            Bagikan tautan ini ke calon warga. `?rt=` yang tidak ada di master_rt ditolak. Tanpa query, server memakai REGISTRATION_RT_ID. Insert tanpa rt_id sekarang ditolak database.
          </p>
        </div>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Antrean verifikasi pendaftaran</h2>
            <span className="text-[10px] font-semibold text-slate-400 tabular-nums">{daftar.length} pendaftar</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-200">
                  <th className="px-4 py-2.5 font-bold">Kepala Keluarga</th>
                  <th className="px-4 py-2.5 font-bold">NIK &amp; Kontak</th>
                  <th className="px-4 py-2.5 font-bold">Alamat</th>
                  <th className="px-4 py-2.5 font-bold">Anggota</th>
                  <th className="px-4 py-2.5 font-bold text-center">Dokumen</th>
                  <th className="px-4 py-2.5 font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {daftar.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-slate-400 font-medium italic">
                      Tidak ada pendaftar menunggu. Buku Induk hanya menampilkan yang sudah Disetujui.
                    </td>
                  </tr>
                ) : (
                  daftar.map((w) => {
                    const nama = w.nama_lengkap || "Tanpa nama";
                    return (
                      <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[13px] text-slate-800">{nama}</div>
                          <span className={`mt-1 inline-block px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                            (w.status_validasi || w.status_verifikasi) === "Ditolak"
                              ? "bg-rose-50 text-rose-800 border-rose-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}>
                            {w.status_validasi || w.status_verifikasi || "Menunggu"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[11px] text-slate-600 font-mono">NIK: {w.nik || "-"}</div>
                          <div className="text-[11px] text-slate-600 font-mono mt-0.5">WA: {w.no_whatsapp || "-"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider inline-block mb-1">
                            {w.status_tinggal || "Tidak diisi"}
                          </span>
                          <div className="text-[11px] text-slate-500 leading-relaxed">{w.detail_alamat || "-"}</div>
                        </td>
                        <td className="px-4 py-3">
                          {!w.anggota_keluarga || w.anggota_keluarga.length === 0 ? (
                            <span className="text-[11px] text-slate-400 font-medium">Sendiri</span>
                          ) : (
                            <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5">
                              {w.anggota_keluarga.map((ak, idx) => (
                                <li key={ak.id || idx}>{ak.nama_lengkap || "Tanpa nama"}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col gap-1 items-center">
                            {FITUR_KTP_AKTIF && (
                              nilaiKosong(w.ktp_path) ? (
                                <span className="text-[10px] text-rose-500 font-bold">KTP kosong</span>
                              ) : (
                                <a href={`/api/admin/dokumen?path=${w.ktp_path}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-700 hover:underline">
                                  Cek KTP
                                </a>
                              )
                            )}
                            {nilaiKosong(w.kk_path) ? (
                              <span className="text-[10px] text-rose-500 font-bold">KK kosong</span>
                            ) : (
                              <a href={`/api/admin/dokumen?path=${w.kk_path}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-700 hover:underline">
                                Cek KK
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col gap-1.5 items-center">
                            <button
                              onClick={() => handleValidasi(w.id, "Disetujui", nama, String(w.ktp_path || ""), String(w.kk_path || ""))}
                              disabled={loadingId === w.id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 w-full max-w-[120px]"
                            >
                              {loadingId === w.id ? "..." : "Setujui"}
                            </button>
                            <button
                              onClick={() => handleValidasi(w.id, "Ditolak", nama, String(w.ktp_path || ""), String(w.kk_path || ""))}
                              disabled={loadingId === w.id}
                              className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 w-full max-w-[120px]"
                            >
                              Tolak
                            </button>
                            <Link href={`/admin/warga/${w.id}`} className="text-[10px] font-bold text-slate-500 hover:text-blue-700">
                              Buka profil
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
