"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  hitungKelengkapan,
  nilaiKosong,
  PILIHAN_AGAMA,
  PILIHAN_DAYA_LISTRIK,
  PILIHAN_HUBUNGAN,
  PILIHAN_JENIS_KELAMIN,
  PILIHAN_PENDAPATAN,
  PILIHAN_STATUS_TINGGAL,
  type AnggotaInput,
} from "@/lib/verifikasi-carik";
import { aksiNikTidakSesuai, aksiSimpanCarik } from "./actions";

const LANGKAH = [
  { id: "nik", judul: "Identitas NIK" },
  { id: "biodata", judul: "Biodata" },
  { id: "keluarga", judul: "Keluarga" },
  { id: "ekonomi", judul: "Ekonomi" },
  { id: "pernyataan", judul: "Pernyataan" },
];

const kelasLabel = "block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1.5";
const kelasInput =
  "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const kelasKunci =
  "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-600 bg-slate-50 cursor-not-allowed";
const KUNCI_DRAFT = (idWarga: string, modeRevisi: boolean) =>
  `aplikasi-rt:sensus-draft:${modeRevisi ? "revisi" : "mandiri"}:${idWarga}`;

type AnggotaProfil = {
  id: string;
  nama_lengkap: string | null;
  nik: string | null;
  hubungan_keluarga: string | null;
  hubungan_detail: string | null;
  tanggal_lahir: string | null;
  tempat_lahir: string | null;
  jenis_kelamin: string | null;
  agama: string | null;
  pekerjaan: string | null;
};

type ProfilSensus = {
  id: string;
  nik: string;
  nama_lengkap: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  jenis_kelamin: string | null;
  agama: string | null;
  pekerjaan: string | null;
  no_whatsapp: string | null;
  status_tinggal: string | null;
  detail_alamat: string | null;
  pendapatan_bulanan: string | null;
  daya_listrik: string | null;
  anggota_keluarga: AnggotaProfil[] | null;
};

type BiodataSensus = {
  nama_lengkap: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  jenis_kelamin: string;
  agama: string;
  pekerjaan: string;
  no_whatsapp: string;
  status_tinggal: string;
  detail_alamat: string;
  pendapatan_bulanan: string;
  daya_listrik: string;
};

type DraftSensus = {
  biodata: BiodataSensus;
  anggota: AnggotaInput[];
  catatan: string;
  nikDikonfirmasi: boolean;
  setujuData: boolean;
  setujuTanggungJawab: boolean;
  langkah: number;
};

function pesanKesalahan(error: unknown, cadangan: string) {
  return error instanceof Error && error.message ? error.message : cadangan;
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

function anggotaKosong(): AnggotaInput {
  return {
    nama_lengkap: "",
    nik: "",
    hubungan_keluarga: "",
    hubungan_detail: "",
    tanggal_lahir: "",
    tempat_lahir: "",
    jenis_kelamin: "",
    agama: "",
    pekerjaan: "",
  };
}

function dariWarga(warga: ProfilSensus): AnggotaInput[] {
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
  }));
}

function buatBiodataAwal(warga: ProfilSensus): BiodataSensus {
  return {
    nama_lengkap: warga?.nama_lengkap || "",
    tempat_lahir: warga?.tempat_lahir || "",
    tanggal_lahir: String(warga?.tanggal_lahir || "").slice(0, 10),
    jenis_kelamin: normalisasiGender(warga?.jenis_kelamin) || warga?.jenis_kelamin || "",
    agama: warga?.agama || "",
    pekerjaan: warga?.pekerjaan || "",
    no_whatsapp: nilaiKosong(warga?.no_whatsapp) ? "" : warga?.no_whatsapp || "",
    status_tinggal: warga?.status_tinggal || "",
    detail_alamat: nilaiKosong(warga?.detail_alamat) ? "" : warga?.detail_alamat || "",
    pendapatan_bulanan: warga?.pendapatan_bulanan || "",
    daya_listrik: warga?.daya_listrik || "",
  };
}

function normalisasiBiodataDraft(mentah: unknown, fallback: BiodataSensus): BiodataSensus {
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return fallback;
  const data = mentah as Record<string, unknown>;
  return {
    nama_lengkap: String(data.nama_lengkap ?? fallback.nama_lengkap),
    tempat_lahir: String(data.tempat_lahir ?? fallback.tempat_lahir),
    tanggal_lahir: String(data.tanggal_lahir ?? fallback.tanggal_lahir).slice(0, 10),
    jenis_kelamin: String(data.jenis_kelamin ?? fallback.jenis_kelamin),
    agama: String(data.agama ?? fallback.agama),
    pekerjaan: String(data.pekerjaan ?? fallback.pekerjaan),
    no_whatsapp: String(data.no_whatsapp ?? fallback.no_whatsapp),
    status_tinggal: String(data.status_tinggal ?? fallback.status_tinggal),
    detail_alamat: String(data.detail_alamat ?? fallback.detail_alamat),
    pendapatan_bulanan: String(data.pendapatan_bulanan ?? fallback.pendapatan_bulanan),
    daya_listrik: String(data.daya_listrik ?? fallback.daya_listrik),
  };
}

function normalisasiAnggotaDraft(mentah: unknown, fallback: AnggotaInput[]): AnggotaInput[] {
  if (!Array.isArray(mentah) || mentah.length === 0) return fallback;
  return mentah
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : undefined,
      nama_lengkap: String(item.nama_lengkap ?? ""),
      nik: String(item.nik ?? ""),
      hubungan_keluarga: String(item.hubungan_keluarga ?? ""),
      hubungan_detail: String(item.hubungan_detail ?? ""),
      tanggal_lahir: String(item.tanggal_lahir ?? ""),
      tempat_lahir: String(item.tempat_lahir ?? ""),
      jenis_kelamin: String(item.jenis_kelamin ?? ""),
      agama: String(item.agama ?? ""),
      pekerjaan: String(item.pekerjaan ?? ""),
    }));
}

export default function SensusClient({
  warga,
  modeRevisi = false,
}: {
  warga: ProfilSensus;
  modeRevisi?: boolean;
}) {
  const router = useRouter();
  const kunciDraft = KUNCI_DRAFT(warga?.id || warga?.nik || "unknown", modeRevisi);
  const [langkah, setLangkah] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: "sukses" | "gagal"; teks: string } | null>(null);
  const [nikDikonfirmasi, setNikDikonfirmasi] = useState(false);
  const [modalNikSalah, setModalNikSalah] = useState(false);
  const [modalLanjutKeluarga, setModalLanjutKeluarga] = useState(false);
  const [setujuData, setSetujuData] = useState(false);
  const [setujuTanggungJawab, setSetujuTanggungJawab] = useState(false);
  const [catatan, setCatatan] = useState("");
  const [biodata, setBiodata] = useState<BiodataSensus>(() => buatBiodataAwal(warga));
  const [anggota, setAnggota] = useState<AnggotaInput[]>(() => dariWarga(warga));
  const [draftSiap, setDraftSiap] = useState(false);

  const kelengkapan = useMemo(() => hitungKelengkapan(biodata), [biodata]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const mentah = window.localStorage.getItem(kunciDraft);
      if (mentah) {
        const parsed = JSON.parse(mentah) as Partial<DraftSensus> | null;
        if (parsed && typeof parsed === "object") {
          const biodataFallback = buatBiodataAwal(warga);
          setBiodata(normalisasiBiodataDraft(parsed.biodata, biodataFallback));
          setAnggota(normalisasiAnggotaDraft(parsed.anggota, dariWarga(warga)));
          setCatatan(typeof parsed.catatan === "string" ? parsed.catatan : "");
          setNikDikonfirmasi(Boolean(parsed.nikDikonfirmasi));
          setSetujuData(Boolean(parsed.setujuData));
          setSetujuTanggungJawab(Boolean(parsed.setujuTanggungJawab));
          setLangkah(Number.isInteger(parsed.langkah) ? Math.max(0, Math.min(parsed.langkah as number, LANGKAH.length - 1)) : 0);
        }
      }
    } catch {
      // Draft lama yang rusak diabaikan saja.
    } finally {
      setDraftSiap(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [kunciDraft, warga]);

  useEffect(() => {
    if (!draftSiap) return;
    try {
      const draft: DraftSensus = {
        biodata,
        anggota,
        catatan,
        nikDikonfirmasi,
        setujuData,
        setujuTanggungJawab,
        langkah,
      };
      window.localStorage.setItem(kunciDraft, JSON.stringify(draft));
    } catch {
      // Abaikan kuota atau mode privat.
    }
  }, [draftSiap, kunciDraft, biodata, anggota, catatan, nikDikonfirmasi, setujuData, setujuTanggungJawab, langkah]);

  const ubahBiodata = (nama: keyof typeof biodata, nilai: string) => {
    setBiodata((sebelum) => ({ ...sebelum, [nama]: nilai }));
  };

  const ubahAnggota = (index: number, nama: keyof AnggotaInput, nilai: string) => {
    setAnggota((sebelum) => {
      const salinan = [...sebelum];
      salinan[index] = { ...salinan[index], [nama]: nilai };
      return salinan;
    });
  };

  const validasiLangkah = (index: number) => {
    if (index === 0 && !nikDikonfirmasi) {
      return "Konfirmasikan dulu bahwa NIK di KTP sama dengan NIK pada data warisan ini.";
    }
    if (index === 1) {
      if (!biodata.nama_lengkap || !biodata.tempat_lahir || !biodata.tanggal_lahir) return "Lengkapi nama dan tempat/tanggal lahir.";
      if (!biodata.jenis_kelamin || !biodata.agama || !biodata.pekerjaan) return "Lengkapi jenis kelamin, agama, dan pekerjaan.";
      if (!biodata.no_whatsapp || biodata.no_whatsapp.replace(/\D/g, "").length < 10) return "Nomor WhatsApp wajib diisi.";
      if (!biodata.status_tinggal || !biodata.detail_alamat) return "Lengkapi status tinggal dan detail alamat.";
    }
    if (index === 2) {
      for (let i = 0; i < anggota.length; i++) {
        const a = anggota[i];
        const label = a.nama_lengkap || `Anggota ${i + 1}`;
        if (!a.nama_lengkap || !a.nik || a.nik.replace(/\D/g, "").length !== 16) return `NIK dan nama ${label} wajib lengkap (16 digit).`;
        if (!a.tempat_lahir || !a.tanggal_lahir || !a.jenis_kelamin || !a.agama || !a.pekerjaan || !a.hubungan_keluarga) {
          return `Lengkapi biodata ${label}.`;
        }
        if (a.hubungan_keluarga === "Lainnya" && !a.hubungan_detail) return `Jelaskan hubungan keluarga untuk ${label}.`;
      }
    }
    if (index === 3 && (!biodata.pendapatan_bulanan || !biodata.daya_listrik)) {
      return "Pilih pendapatan bulanan dan daya listrik terpasang.";
    }
    return null;
  };

  const lanjut = () => {
    const gagal = validasiLangkah(langkah);
    if (gagal) {
      setPesan({ tipe: "gagal", teks: gagal });
      return;
    }
    setPesan(null);
    if (langkah === 2) {
      setModalLanjutKeluarga(true);
      return;
    }
    setLangkah((n) => Math.min(n + 1, LANGKAH.length - 1));
  };

  const handleSimpan = async () => {
    if (!setujuData || !setujuTanggungJawab) {
      setPesan({ tipe: "gagal", teks: "Centang kedua pernyataan verifikasi sebelum mengirim." });
      return;
    }
    const gagal = validasiLangkah(1) || validasiLangkah(2) || validasiLangkah(3);
    if (gagal) {
      setPesan({ tipe: "gagal", teks: gagal });
      return;
    }

    setLoading(true);
    setPesan(null);
    try {
      const hasil = await aksiSimpanCarik(biodata, anggota, catatan);
      if (hasil.success) {
        try {
          window.localStorage.removeItem(kunciDraft);
        } catch {
          // Abaikan jika storage tidak tersedia.
        }
        setPesan({ tipe: "sukses", teks: hasil.message });
        router.push(hasil.arah || "/portal");
        router.refresh();
        return;
      }
      setPesan({ tipe: "gagal", teks: hasil.message });
    } catch (error: unknown) {
      setPesan({ tipe: "gagal", teks: pesanKesalahan(error, "Jaringan terputus saat menyimpan.") });
    }
    setLoading(false);
  };

  const handleNikSalah = async () => {
    setLoading(true);
    setPesan(null);
    try {
      const hasil = await aksiNikTidakSesuai();
      if (hasil.success) {
        router.replace(hasil.arah || "/login?alasan=nik-tidak-sesuai");
        router.refresh();
        return;
      }
      setPesan({ tipe: "gagal", teks: hasil.message });
      setModalNikSalah(false);
    } catch (error: unknown) {
      setPesan({ tipe: "gagal", teks: pesanKesalahan(error, "Gagal mengirim laporan NIK.") });
      setModalNikSalah(false);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans text-slate-800">
      <header className="bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-8 pb-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300 mb-2">
            {modeRevisi ? "Revisi · Izin pengurus" : "Wajib · Verifikasi Data Carik"}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold leading-tight">
            {modeRevisi ? "Koreksi data keluarga Anda" : "Perbarui data keluarga Anda"}
          </h1>
          <p className="text-sm text-slate-300 mt-3 leading-relaxed max-w-2xl">
            {modeRevisi
              ? "Pengurus RT mengizinkan perubahan. NIK tetap terkunci. Layanan portal lain terbuka kembali setelah data ini disimpan."
              : "Catatan ini diambil dari pendataan tahun-tahun sebelumnya. Pengurus RT tidak boleh mengubah NIK. Bandingkan dengan KTP. Jika NIK salah, kirim laporan agar pengurus dapat memeriksanya tanpa menghapus data."}
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 md:px-6 -mt-5 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Kelengkapan biodata</p>
            <p className="text-sm font-semibold text-slate-800 tabular-nums">{kelengkapan.persen}%</p>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${kelengkapan.persen}%` }} />
          </div>
        </div>

        <ol className="grid grid-cols-5 gap-1.5">
          {LANGKAH.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  if (index <= langkah) setLangkah(index);
                }}
                className={`w-full rounded-xl px-1 py-2 text-center border text-[10px] font-semibold ${
                  index === langkah
                    ? "bg-slate-900 text-white border-slate-900"
                    : index < langkah
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-white text-slate-400 border-slate-200"
                }`}
              >
                {index + 1}. {item.judul}
              </button>
            </li>
          ))}
        </ol>

        {pesan && (
          <div className={`rounded-2xl border p-4 text-sm font-medium ${pesan.tipe === "gagal" ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
            {pesan.teks}
          </div>
        )}

        {langkah === 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-7 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Apakah NIK ini milik Anda?</h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                NIK adalah kunci login dan tidak dapat diubah oleh siapa pun, termasuk pengurus RT.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1">NIK terkunci</p>
              <p className="font-mono text-xl md:text-2xl font-semibold tracking-wide text-slate-900">{warga.nik}</p>
              <p className="text-sm text-slate-600 mt-2">{warga.nama_lengkap}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setNikDikonfirmasi(true);
                  setPesan(null);
                  setLangkah(1);
                }}
                className={`rounded-2xl border p-4 text-left transition-colors ${nikDikonfirmasi ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50"}`}
              >
                <p className="font-semibold text-emerald-800">Ya, NIK ini sesuai KTP</p>
                <p className="text-[13px] text-slate-600 mt-1">Lanjutkan mengisi dan mengoreksi data keluarga.</p>
              </button>
              <button
                type="button"
                onClick={() => setModalNikSalah(true)}
                className="rounded-2xl border border-slate-200 p-4 text-left hover:border-rose-300 hover:bg-rose-50/70 transition-colors"
              >
                <p className="font-semibold text-rose-800">Tidak, NIK ini salah</p>
                <p className="text-[13px] text-slate-600 mt-1">Kirim laporan kepada pengurus. Data tidak akan dihapus otomatis.</p>
              </button>
            </div>
          </section>
        )}

        {langkah === 1 && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-7 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Biodata kepala keluarga</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={kelasLabel}>NIK</label>
                <input value={warga.nik} disabled className={kelasKunci} />
              </div>
              <div>
                <label className={kelasLabel}>Nama lengkap</label>
                <input className={kelasInput} value={biodata.nama_lengkap} onChange={(e) => ubahBiodata("nama_lengkap", e.target.value)} />
              </div>
              <div>
                <label className={kelasLabel}>No. WhatsApp</label>
                <input className={kelasInput} inputMode="numeric" value={biodata.no_whatsapp} onChange={(e) => ubahBiodata("no_whatsapp", e.target.value.replace(/[^\d]/g, ""))} placeholder="08xxxxxxxxxx" />
              </div>
              <div>
                <label className={kelasLabel}>Tempat lahir</label>
                <input className={kelasInput} value={biodata.tempat_lahir} onChange={(e) => ubahBiodata("tempat_lahir", e.target.value)} />
              </div>
              <div>
                <label className={kelasLabel}>Tanggal lahir</label>
                <input type="date" className={kelasInput} value={biodata.tanggal_lahir} onChange={(e) => ubahBiodata("tanggal_lahir", e.target.value)} />
              </div>
              <div>
                <label className={kelasLabel}>Jenis kelamin</label>
                <select className={kelasInput} value={biodata.jenis_kelamin} onChange={(e) => ubahBiodata("jenis_kelamin", e.target.value)}>
                  <option value="">Pilih</option>
                  {PILIHAN_JENIS_KELAMIN.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={kelasLabel}>Agama</label>
                <select className={kelasInput} value={biodata.agama} onChange={(e) => ubahBiodata("agama", e.target.value)}>
                  <option value="">Pilih</option>
                  {opsiDenganNilaiLama(PILIHAN_AGAMA, biodata.agama).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={kelasLabel}>Pekerjaan</label>
                <input className={kelasInput} value={biodata.pekerjaan} onChange={(e) => ubahBiodata("pekerjaan", e.target.value)} />
              </div>
              <div>
                <label className={kelasLabel}>Status tinggal</label>
                <select className={kelasInput} value={biodata.status_tinggal} onChange={(e) => ubahBiodata("status_tinggal", e.target.value)}>
                  <option value="">Pilih</option>
                  {PILIHAN_STATUS_TINGGAL.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={kelasLabel}>Detail alamat</label>
                <input className={kelasInput} value={biodata.detail_alamat} onChange={(e) => ubahBiodata("detail_alamat", e.target.value)} placeholder="Gang / blok / nomor rumah" />
              </div>
            </div>
          </section>
        )}

        {langkah === 2 && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-7 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Anggota keluarga</h2>
              <p className="text-sm text-slate-500 mt-1">
                NIK anggota yang sudah tercatat tidak bisa diubah. Jika NIK salah, hapus baris itu lalu tambah data baru.
                NIK yang sudah dipakai rumah tangga lain akan ditahan untuk pemeriksaan pengurus, bukan digabung otomatis.
              </p>
            </div>

            {anggota.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Belum ada tanggungan. Tambah istri/suami/anak jika ada, atau lanjut jika tinggal sendiri.
              </div>
            ) : (
              <div className="space-y-4">
                {anggota.map((item, index) => {
                  const nikTerkunci = Boolean(item.id);
                  return (
                    <div key={item.id || `baru-${index}`} className="rounded-2xl border border-slate-200 p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Anggota {index + 1}</p>
                        <button type="button" onClick={() => setAnggota((sebelum) => sebelum.filter((_, i) => i !== index))} className="text-xs font-semibold text-rose-600">
                          Hapus
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className={kelasLabel}>NIK</label>
                          <input
                            className={nikTerkunci ? kelasKunci : kelasInput}
                            disabled={nikTerkunci}
                            maxLength={16}
                            value={item.nik}
                            onChange={(e) => ubahAnggota(index, "nik", e.target.value.replace(/\D/g, "").slice(0, 16))}
                          />
                        </div>
                        <div>
                          <label className={kelasLabel}>Nama lengkap</label>
                          <input className={kelasInput} value={item.nama_lengkap} onChange={(e) => ubahAnggota(index, "nama_lengkap", e.target.value)} />
                        </div>
                        <div>
                          <label className={kelasLabel}>Tempat lahir</label>
                          <input className={kelasInput} value={item.tempat_lahir} onChange={(e) => ubahAnggota(index, "tempat_lahir", e.target.value)} />
                        </div>
                        <div>
                          <label className={kelasLabel}>Tanggal lahir</label>
                          <input type="date" className={kelasInput} value={item.tanggal_lahir} onChange={(e) => ubahAnggota(index, "tanggal_lahir", e.target.value)} />
                        </div>
                        <div>
                          <label className={kelasLabel}>Jenis kelamin</label>
                          <select className={kelasInput} value={item.jenis_kelamin} onChange={(e) => ubahAnggota(index, "jenis_kelamin", e.target.value)}>
                            <option value="">Pilih</option>
                            {PILIHAN_JENIS_KELAMIN.map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={kelasLabel}>Agama</label>
                          <select className={kelasInput} value={item.agama} onChange={(e) => ubahAnggota(index, "agama", e.target.value)}>
                            <option value="">Pilih</option>
                            {opsiDenganNilaiLama(PILIHAN_AGAMA, item.agama).map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={kelasLabel}>Hubungan</label>
                          <select className={kelasInput} value={item.hubungan_keluarga} onChange={(e) => ubahAnggota(index, "hubungan_keluarga", e.target.value)}>
                            <option value="">Pilih</option>
                            {opsiDenganNilaiLama(PILIHAN_HUBUNGAN, item.hubungan_keluarga).map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={kelasLabel}>Pekerjaan</label>
                          <input className={kelasInput} value={item.pekerjaan} onChange={(e) => ubahAnggota(index, "pekerjaan", e.target.value)} />
                        </div>
                        {item.hubungan_keluarga === "Lainnya" && (
                          <div className="md:col-span-2">
                            <label className={kelasLabel}>Detail hubungan</label>
                            <input className={kelasInput} value={item.hubungan_detail || ""} onChange={(e) => ubahAnggota(index, "hubungan_detail", e.target.value)} placeholder="Mertua / keponakan / adik" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => setAnggota((sebelum) => [...sebelum, anggotaKosong()])}
              className="w-full rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold py-3.5 text-sm"
            >
              + Tambah anggota keluarga
            </button>
          </section>
        )}

        {langkah === 3 && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-7 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Profil ekonomi rumah tangga</h2>
            <p className="text-sm text-slate-500">Dipakai pengurus untuk pemetaan desil bansos, bukan untuk dipublikasikan.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={kelasLabel}>Pendapatan bulanan</label>
                <select className={kelasInput} value={biodata.pendapatan_bulanan} onChange={(e) => ubahBiodata("pendapatan_bulanan", e.target.value)}>
                  <option value="">Pilih</option>
                  {opsiDenganNilaiLama(PILIHAN_PENDAPATAN, biodata.pendapatan_bulanan).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={kelasLabel}>Daya listrik terpasang</label>
                <select className={kelasInput} value={biodata.daya_listrik} onChange={(e) => ubahBiodata("daya_listrik", e.target.value)}>
                  <option value="">Pilih</option>
                  {opsiDenganNilaiLama(PILIHAN_DAYA_LISTRIK, biodata.daya_listrik).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}

        {langkah === 4 && (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-7 space-y-5">
            <h2 className="text-lg font-bold text-slate-900">Tinjau dan nyatakan</h2>
            <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 text-sm">
              <div className="p-4 flex justify-between gap-3"><span className="text-slate-500">NIK</span><span className="font-mono font-semibold">{warga.nik}</span></div>
              <div className="p-4 flex justify-between gap-3"><span className="text-slate-500">Nama</span><span className="font-semibold text-right">{biodata.nama_lengkap}</span></div>
              <div className="p-4 flex justify-between gap-3"><span className="text-slate-500">TTL</span><span className="font-semibold text-right">{biodata.tempat_lahir}, {biodata.tanggal_lahir}</span></div>
              <div className="p-4 flex justify-between gap-3"><span className="text-slate-500">Alamat</span><span className="font-semibold text-right">{biodata.detail_alamat}</span></div>
              <div className="p-4 flex justify-between gap-3"><span className="text-slate-500">Anggota keluarga</span><span className="font-semibold text-right">{anggota.length === 0 ? "Tidak ada" : anggota.map((a) => a.nama_lengkap).join(", ")}</span></div>
            </div>
            <div>
              <label className={kelasLabel}>Catatan untuk pengurus (opsional)</label>
              <textarea rows={3} className={kelasInput} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Misalnya anggota yang baru lahir, atau yang sudah pindah." />
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={setujuData} onChange={(e) => setSetujuData(e.target.checked)} />
              <span className="text-sm text-slate-700 leading-relaxed">Saya telah mencocokkan NIK dengan KTP dan menyatakan data keluarga di atas sesuai kondisi saat ini.</span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={setujuTanggungJawab} onChange={(e) => setSetujuTanggungJawab(e.target.checked)} />
              <span className="text-sm text-slate-700 leading-relaxed">Saya bertanggung jawab atas kebenaran isian ini. Konflik identitas akan diperiksa pengurus tanpa penghapusan otomatis.</span>
            </label>
          </section>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (langkah === 0) {
                router.push("/api/warga/logout");
                return;
              }
              setLangkah((n) => Math.max(0, n - 1));
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600"
          >
            {langkah === 0 ? "Keluar" : "Kembali"}
          </button>
          {langkah < LANGKAH.length - 1 ? (
            <div className="flex items-center gap-2">
              {langkah === 2 && (
                <button
                  type="button"
                  onClick={() => setAnggota((sebelum) => [...sebelum, anggotaKosong()])}
                  className="px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 text-sm font-semibold"
                >
                  Tambah anggota
                </button>
              )}
              <button type="button" onClick={lanjut} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold">
                Lanjut
              </button>
            </div>
          ) : (
            <button type="button" disabled={loading || !setujuData || !setujuTanggungJawab} onClick={handleSimpan} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">
              {loading ? "Menyimpan..." : "Kirim verifikasi"}
            </button>
          )}
        </div>
      </div>

      {modalLanjutKeluarga && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Sudah semua anggota tercatat?</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {anggota.length === 0
                ? "Belum ada anggota keluarga. Lanjut hanya jika Anda memang tinggal sendiri."
                : `Saat ini tercatat ${anggota.length} anggota: ${anggota.map((a) => a.nama_lengkap || "tanpa nama").join(", ")}. Tambah lagi jika masih ada istri/suami/anak yang belum masuk.`}
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalLanjutKeluarga(false);
                  setAnggota((sebelum) => [...sebelum, anggotaKosong()]);
                }}
                className="px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 text-sm font-semibold"
              >
                Tambah anggota lagi
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalLanjutKeluarga(false);
                  setLangkah((n) => Math.min(n + 1, LANGKAH.length - 1));
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold"
              >
                Ya, lanjut
              </button>
            </div>
          </div>
        </div>
      )}
      {modalNikSalah && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Laporkan NIK tidak sesuai</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Data warisan atas NIK {warga.nik} tidak akan dihapus. Akun akan diblokir sementara dan pengurus RT akan memeriksa laporan Anda.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalNikSalah(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500">Batal</button>
              <button type="button" disabled={loading} onClick={handleNikSalah} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold disabled:opacity-50">
                {loading ? "Mengirim..." : "Kirim laporan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
