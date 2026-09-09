"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PesanDialog from "@/components/PesanDialog";
import {
  hitungKelengkapan,
  nilaiKosong,
  PILIHAN_AGAMA,
  PILIHAN_DAYA_LISTRIK,
  PILIHAN_HUBUNGAN,
  PILIHAN_HUBUNGAN_KK,
  PILIHAN_JENIS_KELAMIN,
  PILIHAN_PENDAPATAN,
  PILIHAN_PENDIDIKAN,
  PILIHAN_STATUS_TINGGAL,
  type AnggotaInput,
  type DuplikatWarga,
  type HasilCarik,
  type RingkasanCarik,
} from "@/lib/verifikasi-carik";

const FITUR_KTP_AKTIF = false;

const kelasLabel = "block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1.5";
const kelasInput =
  "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const kelasKunci =
  "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-500 bg-slate-50 cursor-not-allowed";

type AnggotaWargaDetail = {
  id: string;
  nik: string | null;
  nama_lengkap: string | null;
  hubungan_keluarga: string | null;
  hubungan_detail: string | null;
  tanggal_lahir: string | null;
  tempat_lahir: string | null;
  jenis_kelamin: string | null;
  agama: string | null;
  pekerjaan: string | null;
  pendidikan: string | null;
};

type ProfilWargaDetail = {
  id: string;
  nik: string;
  nama_lengkap: string | null;
  no_whatsapp: string | null;
  status_tinggal: string | null;
  detail_alamat: string | null;
  tanggal_lahir: string | null;
  tempat_lahir: string | null;
  jenis_kelamin: string | null;
  agama: string | null;
  pekerjaan: string | null;
  pendidikan: string | null;
  no_kk: string | null;
  hubungan_kk: string | null;
  pendapatan_bulanan: string | null;
  daya_listrik: string | null;
  status_verifikasi: string | null;
  ktp_path: string | null;
  kk_path: string | null;
  anggota_keluarga: AnggotaWargaDetail[] | null;
};

function pesanKesalahan(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Jaringan atau server tidak merespons.";
}

function normalisasiGender(nilai: unknown) {
  const n = String(nilai || "").toLowerCase();
  if (n.startsWith("l")) return "Laki-laki";
  if (n.startsWith("p")) return "Perempuan";
  return "";
}

function opsiDenganNilaiLama(daftar: readonly string[], nilaiLama: string) {
  if (!nilaiLama || daftar.includes(nilaiLama)) return [...daftar];
  return [nilaiLama, ...daftar];
}

function formatTanggalId(nilai: string | null) {
  if (!nilai) return "—";
  return new Date(nilai).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function alasanDuplikat(alasan: DuplikatWarga["alasan"]) {
  if (alasan === "nik_sama") return "NIK yang sama";
  if (alasan === "identitas_sama") return "Nama dan tanggal lahir sama";
  return "NIK ini tercatat sebagai anggota KK lain";
}

function dariAnggota(warga: ProfilWargaDetail): AnggotaInput[] {
  return (warga.anggota_keluarga || []).map((ak) => ({
    id: ak.id,
    nama_lengkap: ak.nama_lengkap || "",
    nik: ak.nik || "",
    hubungan_keluarga: ak.hubungan_keluarga || "",
    hubungan_detail: ak.hubungan_detail || "",
    tanggal_lahir: String(ak.tanggal_lahir || "").slice(0, 10),
    tempat_lahir: ak.tempat_lahir || "",
    jenis_kelamin: normalisasiGender(ak.jenis_kelamin) || ak.jenis_kelamin || "",
    agama: ak.agama || "",
    pekerjaan: ak.pekerjaan || "",
    pendidikan: ak.pendidikan || "",
  }));
}

export default function WargaDetailClient({
  warga,
  carik,
  duplikat,
  aksiVerifikasiAkun,
  aksiEdit,
  aksiVerifikasiCarik,
  aksiNikTidakSesuai,
  aksiHapusDuplikat,
}: {
  warga: ProfilWargaDetail;
  carik: RingkasanCarik | null;
  duplikat: DuplikatWarga[];
  aksiVerifikasiAkun: (status: string) => Promise<HasilCarik>;
  aksiEdit: (dataBaru: Record<string, unknown>, anggota: AnggotaInput[]) => Promise<HasilCarik>;
  aksiVerifikasiCarik: (dataBaru: Record<string, unknown>, anggota: AnggotaInput[], catatan: string) => Promise<HasilCarik>;
  aksiNikTidakSesuai: () => Promise<HasilCarik>;
  aksiHapusDuplikat: (idTarget: string, sumberTarget: DuplikatWarga["sumber"]) => Promise<HasilCarik>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [modalNikSalah, setModalNikSalah] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: "sukses" | "gagal"; teks: string } | null>(null);

  const [formData, setFormData] = useState({
    nama_lengkap: warga?.nama_lengkap || "",
    tempat_lahir: warga?.tempat_lahir || "",
    tanggal_lahir: String(warga?.tanggal_lahir || "").slice(0, 10),
    jenis_kelamin: normalisasiGender(warga?.jenis_kelamin) || warga?.jenis_kelamin || "",
    agama: warga?.agama || "",
    pekerjaan: warga?.pekerjaan || "",
    pendidikan: warga?.pendidikan || "",
    no_whatsapp: nilaiKosong(warga?.no_whatsapp) ? "" : warga?.no_whatsapp || "",
    status_tinggal: warga?.status_tinggal || "",
    detail_alamat: nilaiKosong(warga?.detail_alamat) ? "" : warga?.detail_alamat || "",
    no_kk: String(warga?.no_kk || "").replace(/\D/g, ""),
    hubungan_kk: warga?.hubungan_kk || "",
    pendapatan_bulanan: warga?.pendapatan_bulanan || "",
    daya_listrik: warga?.daya_listrik || "",
  });
  const [anggota, setAnggota] = useState<AnggotaInput[]>(dariAnggota(warga));
  const [catatanCarik, setCatatanCarik] = useState("");

  const kelengkapan = useMemo(() => hitungKelengkapan({ ...(warga || {}), ...formData }), [warga, formData]);
  const carikSelesai = Boolean(carik?.id);
  const akunMenunggu = warga?.status_verifikasi === "Menunggu" || !warga?.status_verifikasi;

  if (!warga) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 font-semibold">Berkas tidak ditemukan.</div>;
  }

  const laporkan = (tipe: "sukses" | "gagal", teks: string) => setPesan({ tipe, teks });

  const jalankan = async (fn: () => Promise<HasilCarik>) => {
    setLoading(true);
    setPesan(null);
    try {
      const hasil = await fn();
      if (hasil.success) {
        laporkan("sukses", hasil.message);
        setFormTerbuka(false);
        if (hasil.arah) {
          router.push(hasil.arah);
        }
        router.refresh();
      } else {
        laporkan("gagal", hasil.message);
      }
    } catch (error: unknown) {
      laporkan("gagal", pesanKesalahan(error));
    }
    setLoading(false);
  };

  const ubahForm = (nama: keyof typeof formData, nilai: string) => {
    setFormData((sebelum) => ({ ...sebelum, [nama]: nilai }));
  };

  const ubahAnggota = (index: number, nama: keyof AnggotaInput, nilai: string) => {
    setAnggota((sebelum) => {
      const salinan = [...sebelum];
      salinan[index] = { ...salinan[index], [nama]: nilai };
      return salinan;
    });
  };

  const formatWA = (nomor: string) => {
    if (!nomor) return "";
    let bersih = nomor.replace(/\D/g, "");
    if (bersih.startsWith("0")) bersih = "62" + bersih.slice(1);
    return bersih;
  };

  const renderDokumenBadge = (path: string | null, label: string) => {
    if (!path || path === "MENYUSUL") {
      return <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg">{label} menyusul (fisik)</span>;
    }
    if (path === "-") {
      return <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg">{label} diarsipkan</span>;
    }
    return (
      <a href={`/api/admin/dokumen?path=${path}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-2 rounded-lg hover:bg-blue-100">
        Lihat {label}
      </a>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans pb-20">
      <div className="max-w-5xl mx-auto space-y-5">
        <Link href="/admin/warga" className="text-blue-700 font-semibold text-sm hover:underline">
          ← Kembali ke buku induk
        </Link>

        <PesanDialog
          pesan={
            pesan
              ? {
                  ...pesan,
                  judul: pesan.tipe === "gagal" ? "Perubahan belum berhasil" : "Perubahan berhasil",
                  deskripsi:
                    pesan.tipe === "gagal"
                      ? "Periksa keterangan di bawah sebelum mengulangi tindakan."
                      : "Sistem sudah mencatat tindakan pengurus.",
                }
              : null
          }
          onClose={() => setPesan(null)}
        />

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-1">Profil warga · data warisan</p>
              <h1 className="text-2xl font-bold text-slate-900">{warga.nama_lengkap}</h1>
              <p className="font-mono text-sm text-slate-500 mt-1">NIK {warga.nik}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider ${warga.status_verifikasi === "Disetujui" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : warga.status_verifikasi === "Ditolak" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                Akun: {warga.status_verifikasi || "Menunggu"}
              </span>
              <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider ${carikSelesai ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                Carik: {carikSelesai ? "Terverifikasi" : "Wajib diisi"}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Kelengkapan data</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{kelengkapan.persen}%</p>
              <div className="h-2 rounded-full bg-slate-100 mt-2 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${kelengkapan.persen}%` }} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Verifikasi mandiri</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {carikSelesai ? `Selesai ${formatTanggalId(carik?.created_at || null)}` : "Belum dikonfirmasi warga"}
              </p>
              <p className="text-[12px] text-slate-500 mt-1">Data lama wajib dicek pemiliknya.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">NIK</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">Terkunci untuk semua pihak</p>
              <p className="text-[12px] text-slate-500 mt-1">Jika salah, hapus data ini lalu warga daftar ulang.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {akunMenunggu && (
              <>
                <button type="button" disabled={loading} onClick={() => jalankan(() => aksiVerifikasiAkun("Disetujui"))} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">
                  Setujui akun
                </button>
                <button type="button" disabled={loading} onClick={() => jalankan(() => aksiVerifikasiAkun("Ditolak"))} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold">
                  Tolak akun
                </button>
              </>
            )}
            <button type="button" onClick={() => setFormTerbuka(true)} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">
              Perbarui biodata
            </button>
            <button type="button" onClick={() => setModalNikSalah(true)} className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 text-xs font-bold bg-rose-50">
              NIK tidak sesuai — hapus
            </button>
          </div>
        </section>

        {duplikat.length > 0 && (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
            <h2 className="font-bold text-amber-950">Data kembar terdeteksi</h2>
            <p className="text-sm text-amber-900/80">Satu orang hanya boleh punya satu catatan. Hapus data yang salah; NIK pada data yang dipertahankan tetap terkunci.</p>
            <div className="space-y-2">
              {duplikat.map((item) => (
                <div key={`${item.sumber}-${item.id}`} className="bg-white border border-amber-100 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{item.nama_lengkap}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">NIK {item.nik || "—"} · {alasanDuplikat(item.alasan)}</p>
                  </div>
                  {item.alasan === "nik_sama" || item.alasan === "nik_sebagai_anggota" ? (
                    <button type="button" disabled={loading} onClick={() => jalankan(() => aksiHapusDuplikat(item.id, item.sumber))} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold">
                      Hapus data kembar ini
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-800">Kesamaan nama/tanggal lahir wajib diperiksa manual.</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-bold text-slate-900 mb-4">Biodata</h2>
            <dl className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2"><dt className="text-slate-500">TTL</dt><dd className="col-span-2 font-semibold">{warga.tempat_lahir || "—"}, {warga.tanggal_lahir || "—"}</dd></div>
              <div className="grid grid-cols-3 gap-2"><dt className="text-slate-500">Nomor KK</dt><dd className="col-span-2 font-mono font-semibold">{warga.no_kk || "—"}</dd></div>
              <div className="grid grid-cols-3 gap-2"><dt className="text-slate-500">Hubungan KK</dt><dd className="col-span-2 font-semibold">{warga.hubungan_kk === "KK" ? "Kepala keluarga" : (warga.hubungan_kk || "—")}</dd></div>
              <div className="grid grid-cols-3 gap-2"><dt className="text-slate-500">Gender</dt><dd className="col-span-2 font-semibold">{warga.jenis_kelamin || "—"}</dd></div>
              <div className="grid grid-cols-3 gap-2"><dt className="text-slate-500">Agama</dt><dd className="col-span-2 font-semibold">{warga.agama || "—"}</dd></div>
              <div className="grid grid-cols-3 gap-2"><dt className="text-slate-500">Pekerjaan</dt><dd className="col-span-2 font-semibold">{warga.pekerjaan || "—"}</dd></div>
              <div className="grid grid-cols-3 gap-2"><dt className="text-slate-500">Pendidikan</dt><dd className="col-span-2 font-semibold">{warga.pendidikan || "—"}</dd></div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <dt className="text-slate-500">WhatsApp</dt>
                <dd className="col-span-2">
                  {!nilaiKosong(warga.no_whatsapp) ? (
                    <a href={`https://wa.me/${formatWA(warga.no_whatsapp || "")}`} target="_blank" rel="noopener noreferrer" className="font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md text-xs font-semibold">
                      {warga.no_whatsapp}
                    </a>
                  ) : <span className="text-slate-400">—</span>}
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-2"><dt className="text-slate-500">Tinggal</dt><dd className="col-span-2 font-semibold">{warga.status_tinggal}<br /><span className="text-xs text-slate-500 font-normal">{warga.detail_alamat}</span></dd></div>
            </dl>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-bold text-slate-900 mb-4">Profil ekonomi</h2>
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Pendapatan bulanan</p>
                <p className="font-semibold text-slate-800 mt-1">{warga.pendapatan_bulanan || "Belum diisi"}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Daya listrik</p>
                <p className="font-semibold text-slate-800 mt-1">{warga.daya_listrik || "Belum diisi"}</p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {FITUR_KTP_AKTIF && renderDokumenBadge(warga.ktp_path, "KTP")}
                {renderDokumenBadge(warga.kk_path, "Kartu Keluarga")}
              </div>
            </div>
          </section>
        </div>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-4">Anggota keluarga ({warga.anggota_keluarga?.length || 0})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 pr-3">Nama & NIK</th>
                  <th className="py-2 pr-3">TTL</th>
                  <th className="py-2 pr-3">Hubungan</th>
                  <th className="py-2 pr-3">Pendidikan</th>
                  <th className="py-2">Pekerjaan</th>
                </tr>
              </thead>
              <tbody>
                {!warga.anggota_keluarga?.length ? (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-400">Tidak ada tanggungan tercatat.</td></tr>
                ) : warga.anggota_keluarga.map((ak) => (
                  <tr key={ak.id} className="border-b border-slate-100">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-800">{ak.nama_lengkap}</div>
                      <div className="font-mono text-[11px] text-slate-500">{ak.nik || "NIK kosong"}</div>
                    </td>
                    <td className="py-3 pr-3 text-xs">{ak.tempat_lahir || "—"}, {ak.tanggal_lahir || "—"}<div className="text-slate-500">{ak.jenis_kelamin}</div></td>
                    <td className="py-3 pr-3 font-semibold text-slate-700">{ak.hubungan_keluarga === "Lainnya" ? ak.hubungan_detail : ak.hubungan_keluarga}</td>
                    <td className="py-3 pr-3 text-xs text-slate-600">{ak.pendidikan || "—"}</td>
                    <td className="py-3 text-xs text-slate-600">{ak.pekerjaan || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {formTerbuka && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900">Perbarui data carik</h3>
              <button type="button" onClick={() => setFormTerbuka(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
                NIK tidak dapat diubah. Field lain dilengkapi agar data warisan tahun lama menjadi data operasional RT.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={kelasLabel}>NIK</label>
                  <input value={warga.nik} disabled className={kelasKunci} />
                </div>
                <div>
                  <label className={kelasLabel}>Nomor KK</label>
                  <input className={kelasInput} inputMode="numeric" maxLength={16} value={formData.no_kk} onChange={(e) => ubahForm("no_kk", e.target.value.replace(/\D/g, "").slice(0, 16))} />
                </div>
                <div>
                  <label className={kelasLabel}>Hubungan dalam KK</label>
                  <select className={kelasInput} value={formData.hubungan_kk} onChange={(e) => ubahForm("hubungan_kk", e.target.value)}>
                    <option value="">Pilih</option>
                    {opsiDenganNilaiLama(PILIHAN_HUBUNGAN_KK, formData.hubungan_kk).map((n) => <option key={n} value={n}>{n === "KK" ? "Kepala keluarga" : n}</option>)}
                  </select>
                </div>
                <div>
                  <label className={kelasLabel}>Nama lengkap</label>
                  <input className={kelasInput} value={formData.nama_lengkap} onChange={(e) => ubahForm("nama_lengkap", e.target.value)} />
                </div>
                <div>
                  <label className={kelasLabel}>WhatsApp</label>
                  <input className={kelasInput} value={formData.no_whatsapp} onChange={(e) => ubahForm("no_whatsapp", e.target.value.replace(/\D/g, ""))} />
                </div>
                <div>
                  <label className={kelasLabel}>Tempat lahir</label>
                  <input className={kelasInput} value={formData.tempat_lahir} onChange={(e) => ubahForm("tempat_lahir", e.target.value)} />
                </div>
                <div>
                  <label className={kelasLabel}>Tanggal lahir</label>
                  <input type="date" className={kelasInput} value={formData.tanggal_lahir} onChange={(e) => ubahForm("tanggal_lahir", e.target.value)} />
                </div>
                <div>
                  <label className={kelasLabel}>Jenis kelamin</label>
                  <select className={kelasInput} value={formData.jenis_kelamin} onChange={(e) => ubahForm("jenis_kelamin", e.target.value)}>
                    <option value="">Pilih</option>
                    {PILIHAN_JENIS_KELAMIN.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className={kelasLabel}>Agama</label>
                  <select className={kelasInput} value={formData.agama} onChange={(e) => ubahForm("agama", e.target.value)}>
                    <option value="">Pilih</option>
                    {opsiDenganNilaiLama(PILIHAN_AGAMA, formData.agama).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className={kelasLabel}>Pekerjaan</label>
                  <input className={kelasInput} value={formData.pekerjaan} onChange={(e) => ubahForm("pekerjaan", e.target.value)} />
                </div>
                <div>
                  <label className={kelasLabel}>Pendidikan</label>
                  <select className={kelasInput} value={formData.pendidikan} onChange={(e) => ubahForm("pendidikan", e.target.value)}>
                    <option value="">Pilih</option>
                    {opsiDenganNilaiLama(PILIHAN_PENDIDIKAN, formData.pendidikan).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className={kelasLabel}>Status tinggal</label>
                  <select className={kelasInput} value={formData.status_tinggal} onChange={(e) => ubahForm("status_tinggal", e.target.value)}>
                    <option value="">Pilih</option>
                    {opsiDenganNilaiLama(PILIHAN_STATUS_TINGGAL, formData.status_tinggal).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={kelasLabel}>Detail alamat</label>
                  <textarea rows={2} className={kelasInput} value={formData.detail_alamat} onChange={(e) => ubahForm("detail_alamat", e.target.value)} />
                </div>
                <div>
                  <label className={kelasLabel}>Pendapatan bulanan</label>
                  <select className={kelasInput} value={formData.pendapatan_bulanan} onChange={(e) => ubahForm("pendapatan_bulanan", e.target.value)}>
                    <option value="">Pilih</option>
                    {opsiDenganNilaiLama(PILIHAN_PENDAPATAN, formData.pendapatan_bulanan).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className={kelasLabel}>Daya listrik</label>
                  <select className={kelasInput} value={formData.daya_listrik} onChange={(e) => ubahForm("daya_listrik", e.target.value)}>
                    <option value="">Pilih</option>
                    {opsiDenganNilaiLama(PILIHAN_DAYA_LISTRIK, formData.daya_listrik).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-slate-800">Anggota keluarga</h4>
                  <button
                    type="button"
                    onClick={() => setAnggota((sebelum) => [...sebelum, { nama_lengkap: "", nik: "", hubungan_keluarga: "", hubungan_detail: "", tanggal_lahir: "", tempat_lahir: "", jenis_kelamin: "", agama: "", pekerjaan: "", pendidikan: "" }])}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 text-white"
                  >
                    Tambah
                  </button>
                </div>
                {anggota.map((item, index) => (
                  <div key={item.id || `baru-${index}`} className="border border-slate-200 rounded-xl p-3 mb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input className={item.id ? kelasKunci : kelasInput} disabled={Boolean(item.id)} placeholder="NIK terkunci jika sudah tercatat" value={item.nik} onChange={(e) => ubahAnggota(index, "nik", e.target.value.replace(/\D/g, "").slice(0, 16))} />
                    <input className={kelasInput} placeholder="Nama lengkap" value={item.nama_lengkap} onChange={(e) => ubahAnggota(index, "nama_lengkap", e.target.value)} />
                    <input className={kelasInput} placeholder="Tempat lahir" value={item.tempat_lahir} onChange={(e) => ubahAnggota(index, "tempat_lahir", e.target.value)} />
                    <input type="date" className={kelasInput} value={item.tanggal_lahir} onChange={(e) => ubahAnggota(index, "tanggal_lahir", e.target.value)} />
                    <select className={kelasInput} value={item.jenis_kelamin} onChange={(e) => ubahAnggota(index, "jenis_kelamin", e.target.value)}>
                      <option value="">Jenis kelamin</option>
                      {PILIHAN_JENIS_KELAMIN.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <select className={kelasInput} value={item.agama} onChange={(e) => ubahAnggota(index, "agama", e.target.value)}>
                      <option value="">Agama</option>
                      {opsiDenganNilaiLama(PILIHAN_AGAMA, item.agama).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <select className={kelasInput} value={item.hubungan_keluarga} onChange={(e) => ubahAnggota(index, "hubungan_keluarga", e.target.value)}>
                      <option value="">Hubungan</option>
                      {opsiDenganNilaiLama(PILIHAN_HUBUNGAN, item.hubungan_keluarga).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <input className={kelasInput} placeholder="Pekerjaan" value={item.pekerjaan} onChange={(e) => ubahAnggota(index, "pekerjaan", e.target.value)} />
                    <select className={kelasInput} value={item.pendidikan || ""} onChange={(e) => ubahAnggota(index, "pendidikan", e.target.value)}>
                      <option value="">Pendidikan (opsional)</option>
                      {opsiDenganNilaiLama(PILIHAN_PENDIDIKAN, item.pendidikan || "").map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {item.hubungan_keluarga === "Lainnya" && (
                      <input className={`${kelasInput} md:col-span-2`} placeholder="Detail hubungan" value={item.hubungan_detail || ""} onChange={(e) => ubahAnggota(index, "hubungan_detail", e.target.value)} />
                    )}
                    <button type="button" onClick={() => setAnggota((sebelum) => sebelum.filter((_, i) => i !== index))} className="text-xs text-rose-600 font-semibold md:col-span-2 text-left">Hapus anggota ini</button>
                  </div>
                ))}
              </div>

              <div>
                <label className={kelasLabel}>Catatan verifikasi pengurus</label>
                <textarea rows={2} className={kelasInput} value={catatanCarik} onChange={(e) => setCatatanCarik(e.target.value)} placeholder="Opsional, tercatat bila Anda mencap verifikasi carik." />
              </div>

              <div className="sticky bottom-0 bg-white pt-4 flex flex-col md:flex-row justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setFormTerbuka(false)} className="px-4 py-2 text-sm font-semibold text-slate-500">Batal</button>
                <button type="button" disabled={loading} onClick={() => jalankan(() => aksiEdit(formData, anggota))} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">
                  Simpan biodata
                </button>
                <button type="button" disabled={loading} onClick={() => jalankan(() => aksiVerifikasiCarik(formData, anggota, catatanCarik))} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">
                  Simpan & catat verifikasi carik
                </button>
              </div>
              <p className="text-[11px] text-slate-500 text-right">
                Simpan biodata boleh belum lengkap. Tombol verifikasi carik menuntut field wajib terisi.
              </p>
            </div>
          </div>
        </div>
      )}

      {modalNikSalah && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Hapus karena NIK tidak sesuai</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              NIK {warga.nik} tidak bisa diperbaiki. Data ini akan dihapus (atau diarsipkan bila sudah terikat e-voting). Warga harus lapor diri ulang dengan NIK yang benar.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalNikSalah(false)} className="px-4 py-2 text-sm font-semibold text-slate-500">Batal</button>
              <button type="button" disabled={loading} onClick={() => jalankan(() => aksiNikTidakSesuai())} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold">
                Hapus data ini
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
