"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { kompresGambarKeDataUrl, MAKS_BYTE_GAMBAR_ASLI } from "@/lib/kompresi-gambar-klien";
import {
  PATH_KEBIJAKAN_PRIVASI,
  USIA_ANAK_PDP,
  VERSI_KEBIJAKAN_PRIVASI,
  umurDariTanggalIso,
} from "@/lib/kebijakan-privasi";
import { PILIHAN_PENDIDIKAN } from "@/lib/verifikasi-carik";

const FITUR_KTP_AKTIF = false; 
const MAKS_ANGGOTA = 30;
// The server applies the authoritative limit after compression as well.  This
// client-side limit prevents a browser from spending unbounded CPU/memory on
// an image that could never be accepted by the action.
const MAKS_BYTE_FILE_ASLI = MAKS_BYTE_GAMBAR_ASLI.dokumenIdentitas;
const TIPE_GAMBAR_SAH = new Set(["image/jpeg", "image/png", "image/webp"]);
const KUNCI_DRAFT = (rt: string, wilayah: string) =>
  `aplikasi-rt:register-draft:${encodeURIComponent(rt || wilayah || "default")}`;

// FIX: Tambahkan properti agama
type AnggotaKeluarga = {
  nama: string; nik: string; hubungan: string; hubunganDetail: string;
  tglLahir: string; tempatLahir: string; gender: string; agama: string; pekerjaan: string; pendidikan: string;
  fileKtp: File | null; ktpMenyusul: boolean;
};

type DraftRegister = {
  dokumenMenyusul: boolean;
  jumlahAnggota: number;
};

type HasilRegister = { success: boolean; message: string };
type AksiRegister = (payloadKepala: unknown, anggotaPayload: unknown, persetujuan: unknown) => Promise<HasilRegister>;

export default function RegisterClient({ aksiRegister, alasan, namaWilayah }: { aksiRegister: AksiRegister; alasan?: string; namaWilayah: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kunciDraft = KUNCI_DRAFT(searchParams.get("rt") || "", namaWilayah);

  const [nik, setNik] = useState(""); const [nama, setNama] = useState("");
  const [wa, setWa] = useState(""); const [pin, setPin] = useState(""); 
  const [statusTinggal, setStatusTinggal] = useState(""); const [detailAlamat, setDetailAlamat] = useState("");
  const [tglLahir, setTglLahir] = useState(""); const [tempatLahir, setTempatLahir] = useState("");
  const [gender, setGender] = useState(""); const [agama, setAgama] = useState(""); const [pekerjaan, setPekerjaan] = useState("");
  const [pendidikan, setPendidikan] = useState(""); const [noKk, setNoKk] = useState("");
  const [pendapatan, setPendapatan] = useState(""); const [listrik, setListrik] = useState("");
  const [fileKtp, setFileKtp] = useState<File | null>(null); const [fileKk, setFileKk] = useState<File | null>(null);
  const [dokumenMenyusul, setDokumenMenyusul] = useState(false);
  const [anggota, setAnggota] = useState<AnggotaKeluarga[]>([]);
  const [loading, setLoading] = useState(false); const [progressTeks, setProgressTeks] = useState("");
  const [draftSiap, setDraftSiap] = useState(false);
  const [bacaKebijakan, setBacaKebijakan] = useState(false);
  const [setujuPribadi, setSetujuPribadi] = useState(false);
  const [setujuAnggota, setSetujuAnggota] = useState(false);
  const [setujuAnak, setSetujuAnak] = useState(false);
  const [setujuKeuangan, setSetujuKeuangan] = useState(false);
  const [setujuKesehatan, setSetujuKesehatan] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const mentah = window.localStorage.getItem(kunciDraft);
      if (mentah) {
        const parsed = JSON.parse(mentah) as Record<string, unknown> | null;
        if (parsed && typeof parsed === "object") {
          if (typeof parsed.nik === "string" && parsed.nik) {
            window.localStorage.removeItem(kunciDraft);
          } else {
            setDokumenMenyusul(Boolean(parsed.dokumenMenyusul));
            const jumlah = Number(parsed.jumlahAnggota);
            if (Number.isInteger(jumlah) && jumlah > 0) {
              setAnggota(Array.from({ length: Math.min(jumlah, MAKS_ANGGOTA) }, () => ({
                nama: "", nik: "", hubungan: "", hubunganDetail: "", tglLahir: "",
                tempatLahir: "", gender: "", agama: "", pekerjaan: "", pendidikan: "",
                fileKtp: null, ktpMenyusul: false,
              })));
            }
          }
        }
      }
    } catch {
      // Draft rusak diabaikan.
    } finally {
      setDraftSiap(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [kunciDraft]);

  useEffect(() => {
    if (!draftSiap) return;
    try {
      const draft: DraftRegister = {
        dokumenMenyusul,
        jumlahAnggota: anggota.length,
      };
      window.localStorage.setItem(kunciDraft, JSON.stringify(draft));
    } catch {
      // Abaikan kuota atau mode privat.
    }
  }, [draftSiap, kunciDraft, dokumenMenyusul, anggota.length]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, tipe: 'ktp' | 'kk') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!TIPE_GAMBAR_SAH.has(file.type.toLowerCase())) {
      alert("Hanya boleh mengunggah gambar JPEG, PNG, atau WEBP.");
      e.target.value = "";
      return;
    }
    if (file.size <= 0 || file.size > MAKS_BYTE_FILE_ASLI) {
      alert("Ukuran dokumen terlalu besar. Maksimal 5 MB sebelum kompresi.");
      e.target.value = "";
      return;
    }
    if (tipe === 'ktp') setFileKtp(file);
    if (tipe === 'kk') setFileKk(file);
  };

  const tanggalValid = (tanggal: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return false;
    const parsed = new Date(`${tanggal}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== tanggal) return false;
    return parsed.getTime() <= Date.now();
  };

  const hitungUmur = (tanggal: string) => {
    if (!tanggal) return 0;
    const today = new Date(); const birthDate = new Date(tanggal);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const validasiNIKLogika = (nikInput: string, pemilik: string): string | null => {
    if (!/^\d{16}$/.test(nikInput)) return `NIK ${pemilik} harus 16 digit.`;
    if (/^(\d)\1{15}$/.test(nikInput)) return `NIK ${pemilik} terdeteksi spam (angka berulang).`;
    if (nikInput === "1234567890123456") return `NIK ${pemilik} tidak valid.`;
    return null; 
  };

  const kompresDanUbahKeBase64 = async (fileOri: File) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return await kompresGambarKeDataUrl(fileOri, "dokumenIdentitas");
    } catch {
      throw new Error("Kompresi gambar gagal. Silakan pilih dokumen lain.");
    }
  };

  const tambahAnggota = () => {
    setAnggota((dataLama) => {
      if (dataLama.length >= MAKS_ANGGOTA) return dataLama;
      return [...dataLama, { nama: "", nik: "", hubungan: "", hubunganDetail: "", tglLahir: "", tempatLahir: "", gender: "", agama: "", pekerjaan: "", pendidikan: "", fileKtp: null, ktpMenyusul: false }];
    });
  };
  const ubahAnggota = <K extends keyof AnggotaKeluarga>(index: number, field: K, value: AnggotaKeluarga[K]) => {
    setAnggota((dataLama) => dataLama.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };
  const hapusAnggota = (index: number) => setAnggota((dataLama) => dataLama.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const pinLemah = ["123456", "111111", "000000", "654321", "121212", "123123"];
    if (pinLemah.includes(pin)) return alert("PIN terlalu gampang ditebak!");
    const errNikKK = validasiNIKLogika(nik, "Kepala Keluarga");
    if (errNikKK) return alert(errNikKK);
    if (noKk.replace(/\D/g, "").length !== 16) return alert("Nomor KK Kepala Keluarga wajib 16 digit.");
    if (!pendidikan) return alert("Pendidikan Kepala Keluarga wajib dipilih.");
    if (!tanggalValid(tglLahir)) return alert("Tanggal lahir Kepala Keluarga tidak valid.");
    const umurKk = umurDariTanggalIso(tglLahir);
    if (umurKk != null && umurKk < USIA_ANAK_PDP) {
      return alert("Lapor diri mandiri hanya untuk penanggung jawab berusia 18 tahun atau lebih. Data anak didaftarkan oleh orang tua atau wali.");
    }
    if (anggota.length > MAKS_ANGGOTA) return alert(`Maksimal ${MAKS_ANGGOTA} anggota keluarga.`);

    const nikTerdaftar = new Set<string>([nik]);

    for (let i = 0; i < anggota.length; i++) {
      const a = anggota[i]; const namaLabel = a.nama || `Anggota ${i+1}`;
      const errNik = validasiNIKLogika(a.nik, namaLabel); if (errNik) return alert(errNik);
      if (nikTerdaftar.has(a.nik)) return alert("NIK Kepala Keluarga dan anggota harus berbeda.");
      nikTerdaftar.add(a.nik);
      if (!tanggalValid(a.tglLahir)) return alert(`Tanggal lahir ${namaLabel} tidak valid.`);
      const umur = hitungUmur(a.tglLahir);
      if (FITUR_KTP_AKTIF && umur >= 17 && !a.fileKtp && !a.ktpMenyusul) return alert(`${namaLabel} berumur ${umur} tahun. Wajib melampirkan foto KTP atau centang 'KTP Menyusul'.`);
    }

    if (FITUR_KTP_AKTIF) {
      if (!dokumenMenyusul && (!fileKtp || !fileKk)) return alert("Lampirkan KTP dan KK Kepala Keluarga, atau centang 'Dokumen Menyusul'.");
    } else {
      if (!dokumenMenyusul && !fileKk) return alert("Lampirkan Foto Kartu Keluarga, atau centang 'Dokumen Menyusul'.");
    }

    if (!bacaKebijakan || !setujuPribadi || !setujuKeuangan) {
      return alert("Baca dan setujui Kebijakan Privasi, pemrosesan data pribadi, dan data keuangan rumah tangga sebelum mengirim.");
    }
    if (anggota.length > 0 && !setujuAnggota) {
      return alert("Pendaftaran anggota keluarga membutuhkan persetujuan tersendiri dari penanggung jawab.");
    }
    const adaAnak = anggota.some((item) => {
      const umur = umurDariTanggalIso(item.tglLahir);
      return umur != null && umur < USIA_ANAK_PDP;
    });
    if (adaAnak && !setujuAnak) {
      return alert("Data anak di bawah 18 tahun membutuhkan persetujuan orang tua atau wali.");
    }
    if ((pendapatan || listrik) && !setujuKeuangan) {
      return alert("Kisaran pendapatan hanya disimpan jika Anda mencentang izin data keuangan. Kosongkan isian itu atau beri izin.");
    }

    setLoading(true);
    try {
      let pathKtpKK = dokumenMenyusul ? "MENYUSUL" : null;
      let pathKkKK = dokumenMenyusul ? "MENYUSUL" : null;

      setProgressTeks("Mempersiapkan dokumen Kepala Keluarga...");
      await new Promise(resolve => setTimeout(resolve, 50)); 
      
      if (FITUR_KTP_AKTIF && !dokumenMenyusul && fileKtp) pathKtpKK = await kompresDanUbahKeBase64(fileKtp);
      if (!dokumenMenyusul && fileKk) pathKkKK = await kompresDanUbahKeBase64(fileKk);

      setProgressTeks("Mempersiapkan dokumen Anggota Keluarga...");
      await new Promise(resolve => setTimeout(resolve, 50)); 
      
      const anggotaPayload = await Promise.all(
        anggota.map(async (a) => {
          let pathKtpAnggota = a.ktpMenyusul ? "MENYUSUL" : null;
          if (FITUR_KTP_AKTIF && a.fileKtp && !a.ktpMenyusul) pathKtpAnggota = await kompresDanUbahKeBase64(a.fileKtp);
          return {
            nama_lengkap: a.nama, nik: a.nik, hubungan_keluarga: a.hubungan,
            hubungan_detail: a.hubungan === "Lainnya" ? a.hubunganDetail : null,
            tanggal_lahir: a.tglLahir, tempat_lahir: a.tempatLahir, jenis_kelamin: a.gender,
            agama: a.agama, pekerjaan: a.pekerjaan, pendidikan: a.pendidikan || null, ktp_path: pathKtpAnggota
          };
        })
      );

      // FIX INJEKSI AGAMA
      const payloadKepala = {
        nik, nama_lengkap: nama, no_whatsapp: wa, pin, status_tinggal: statusTinggal, detail_alamat: detailAlamat,
        tanggal_lahir: tglLahir, tempat_lahir: tempatLahir, jenis_kelamin: gender, agama, pekerjaan, pendidikan,
        no_kk: noKk, hubungan_kk: "KK",
        pendapatan_bulanan: pendapatan, daya_listrik: listrik, ktp_path: pathKtpKK, kk_path: pathKkKK
      };

      setProgressTeks("Mendaftarkan & Mengunggah via Server (Jalur Aman)...");
      const hasil = await aksiRegister(payloadKepala, anggotaPayload, {
        versi_naskah: VERSI_KEBIJAKAN_PRIVASI,
        baca_kebijakan: bacaKebijakan,
        data_pribadi: setujuPribadi,
        data_anggota: anggota.length > 0 && setujuAnggota,
        data_anak: adaAnak && setujuAnak,
        data_keuangan: setujuKeuangan,
        data_kesehatan: setujuKesehatan,
      });
      if (!hasil?.success) {
        alert(hasil?.message || "Pendaftaran belum dapat diproses saat ini.");
        setLoading(false); setProgressTeks("");
        return;
      }

      try {
        window.localStorage.removeItem(kunciDraft);
      } catch {
        // Abaikan jika storage tidak tersedia.
      }

      alert("Sempurna! Data Lapor Diri sukses dikirim. Tunggu verifikasi RT.");
      router.replace("/login");
      
    } catch (err: unknown) {
      const pesanMentah = err instanceof Error && err.message ? err.message : "";
      const pesan = !pesanMentah || /minified react error/i.test(pesanMentah)
        ? "Pendaftaran belum dapat diproses saat ini."
        : pesanMentah;
      alert(pesan);
      setLoading(false); setProgressTeks("");
    } 
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 flex flex-col items-center py-10 font-sans">
      
      <div className="w-full max-w-4xl mb-4 text-left">
        <Link href="/login" className="text-blue-600 font-bold hover:underline inline-flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 transition-all active:scale-95 hover:bg-blue-50">
          <span>&larr;</span> Kembali ke Login
        </Link>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg w-full max-w-4xl border-t-[8px] border-t-blue-600">
        <h1 className="text-2xl md:text-3xl font-black text-slate-800 mb-2 text-center tracking-tight">Formulir Lapor Diri {namaWilayah}</h1>
        <p className="text-center text-slate-500 text-xs md:text-sm mb-8 font-bold">Data masuk antrean pengurus. Belum tercatat sebagai warga sah sebelum disetujui.</p>
        <p className="text-center text-xs text-slate-500 mb-6 leading-relaxed">
          Dengan mengisi formulir ini Anda akan mengirim data pribadi kepada pengurus RT.
          Baca <Link href={PATH_KEBIJAKAN_PRIVASI} target="_blank" className="text-blue-700 font-black underline">Kebijakan Privasi versi {VERSI_KEBIJAKAN_PRIVASI}</Link> sebelum menyetujui di bagian bawah.
        </p>
        {alasan === "nik-tidak-sesuai" && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 leading-relaxed">
            Data warisan sebelumnya dihapus karena NIK tidak sesuai. NIK tidak bisa diubah. Isi formulir ini dengan NIK yang tertera di KTP, lalu tunggu persetujuan pengurus RT.
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="space-y-4 pb-6 border-b border-slate-200">
            <h2 className="font-black text-blue-700 uppercase tracking-widest text-sm flex items-center gap-2">👤 Data Kepala Keluarga / Penanggung Jawab</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">NIK (16 Digit)</label><input type="text" maxLength={16} minLength={16} pattern="[0-9]{16}" required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded-lg p-3 font-mono font-bold" value={nik} onChange={(e) => setNik(e.target.value.replace(/[^0-9]/g, ''))} /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Nomor KK (16 Digit)</label><input type="text" maxLength={16} minLength={16} pattern="[0-9]{16}" required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded-lg p-3 font-mono font-bold" value={noKk} onChange={(e) => setNoKk(e.target.value.replace(/[^0-9]/g, ''))} /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Nama Lengkap</label><input type="text" required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded-lg p-3 font-bold" value={nama} onChange={(e) => setNama(e.target.value)} /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Tempat Lahir</label><input type="text" required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded-lg p-3 font-bold" value={tempatLahir} onChange={(e) => setTempatLahir(e.target.value)} /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Tanggal Lahir</label><input type="date" required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded-lg p-3 font-bold" value={tglLahir} onChange={(e) => setTglLahir(e.target.value)} /></div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Gender</label>
                  <select required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded-lg p-3 font-bold" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="" disabled>Pilih...</option><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Agama</label>
                  <select required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded-lg p-3 font-bold" value={agama} onChange={(e) => setAgama(e.target.value)}>
                    <option value="" disabled>Pilih...</option><option value="Islam">Islam</option><option value="Kristen/Katolik">Kristen/Katolik</option><option value="Hindu">Hindu</option><option value="Budha">Budha</option><option value="Konghucu">Konghucu</option>
                  </select>
                </div>
              </div>
              
              <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Pekerjaan</label><input type="text" required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded-lg p-3 font-bold" value={pekerjaan} onChange={(e) => setPekerjaan(e.target.value)} /></div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Pendidikan</label>
                <select required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded-lg p-3 font-bold" value={pendidikan} onChange={(e) => setPendidikan(e.target.value)}>
                  <option value="" disabled>Pilih...</option>
                  {PILIHAN_PENDIDIKAN.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              
              <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">No. WhatsApp</label><input type="tel" minLength={10} maxLength={15} required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded-lg p-3 font-mono font-bold" value={wa} onChange={(e) => setWa(e.target.value.replace(/[^0-9]/g, ''))} /></div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <label className="block text-[10px] font-black uppercase text-amber-800 mb-1 text-center">Buat PIN Portal (6 Angka)</label>
                <input type="password" maxLength={6} minLength={6} required className="w-full border border-amber-300 bg-white text-slate-900 rounded p-2 font-mono tracking-widest text-center text-xl shadow-inner" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} autoComplete="new-password" />
                <p className="text-[10px] text-amber-800 mt-1.5 leading-relaxed">Draf peramban tidak menyimpan PIN, NIK, WhatsApp, nomor KK, atau data keuangan.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Status Tempat Tinggal</label>
              <select required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded-lg p-3 font-bold" value={statusTinggal} onChange={(e) => setStatusTinggal(e.target.value)}>
                <option value="" disabled>-- Pilih Status --</option>
                <option value="Penduduk Tetap">Penduduk Tetap</option>
                <option value="Penduduk Tidak Tetap">Penduduk Tidak Tetap</option>
                <option value="Penyewa Kos">Penyewa Kos</option>
                <option value="Penyewa Kontrakan">Penyewa Kontrakan</option>
              </select>
            </div>
            
            {statusTinggal && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-inner animate-in fade-in slide-in-from-top-2">
                <label className="block text-xs font-black uppercase tracking-wider text-blue-900 mb-1">
                  {statusTinggal === "Penyewa Kos" ? "Nama Kos, Kamar & Alamat Lengkap" : "Nama Gang / Komplek & Nomor Rumah"}
                </label>
                <p className="text-[10px] text-blue-700 font-medium mb-3 leading-relaxed">
                  *Tuliskan patokan jalan, nama komplek/kos, dan nomor. <strong className="text-rose-600 bg-rose-100 px-1 rounded">DILARANG</strong> menulis RT/RW dan Kelurahan karena akan otomatis tercetak di surat.
                </p>
                <input type="text" required className="w-full border-2 border-blue-300 bg-white text-slate-900 rounded-lg p-3 font-bold outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400" placeholder={statusTinggal === "Penyewa Kos" ? "Cth: Kos Ibu Budi Kamar 03, Gang Pelita No. 10" : "Cth: Gang Pelita, Komplek Griya Awalin No. 28"} value={detailAlamat} onChange={(e) => setDetailAlamat(e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-4 pb-6 border-b border-slate-200">
            <h2 className="font-black text-emerald-700 uppercase tracking-widest text-sm flex items-center gap-2">Profil rumah tangga</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">Kisaran pendapatan dan daya listrik untuk program RT (santunan, pendataan lingkungan). Bukan data DTKS dan bukan penyaluran bansos pemerintah. Termasuk data keuangan pribadi — persetujuan khusus di bagian bawah.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Rata-rata Pendapatan / Bulan (opsional)</label>
                <select className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded-lg p-3 font-bold text-sm" value={pendapatan} onChange={(e) => setPendapatan(e.target.value)}>
                  <option value="">Tidak diisi</option>
                  <option value="< 1 Juta">Kurang dari Rp 1.000.000</option>
                  <option value="1 - 3 Juta">Rp 1.000.000 - Rp 3.000.000</option>
                  <option value="3 - 5 Juta">Rp 3.000.000 - Rp 5.000.000</option>
                  <option value="5 - 10 Juta">Rp 5.000.000 - Rp 10.000.000</option>
                  <option value="> 10 Juta">Lebih dari Rp 10.000.000</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Daya Listrik Terpasang (opsional)</label>
                <select className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded-lg p-3 font-bold text-sm" value={listrik} onChange={(e) => setListrik(e.target.value)}>
                  <option value="">Tidak diisi</option>
                  <option value="450 VA (Subsidi)">450 VA (Subsidi)</option>
                  <option value="900 VA (Subsidi)">900 VA (Subsidi)</option>
                  <option value="900 VA (Non-Subsidi)">900 VA (Non-Subsidi)</option>
                  <option value="1300 VA">1300 VA</option>
                  <option value="2200 VA">2200 VA</option>
                  <option value="> 2200 VA">Lebih dari 2200 VA</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4 pb-6 border-b border-slate-200 bg-slate-100 p-4 md:p-6 rounded-xl shadow-inner">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h2 className="font-black text-slate-800 uppercase text-sm">🔒 Dokumen Kepala Keluarga</h2>
                <p className="text-[10px] text-slate-500 font-bold mt-1">Sesuai instruksi RT, saat ini hanya membutuhkan dokumen Kartu Keluarga (KK).</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border-2 border-amber-300 text-amber-900 font-bold text-xs shadow-sm hover:bg-amber-50">
                <input type="checkbox" checked={dokumenMenyusul} onChange={(e) => { setDokumenMenyusul(e.target.checked); if (e.target.checked) { setFileKtp(null); setFileKk(null); } }} className="w-5 h-5 text-amber-600 rounded" />
                KK Menyusul / Fisik
              </label>
            </div>
            
            {!dokumenMenyusul && (
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                  <label className="block text-xs font-black uppercase text-slate-700 mb-2">📸 Foto Kartu Keluarga</label>
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'kk')} className="w-full text-xs text-slate-900" />
                  {fileKk && <div className="text-[10px] text-emerald-600 font-black mt-2 bg-emerald-50 px-2 py-1 rounded w-fit">✓ File terlampir</div>}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl text-white shadow-md">
              <h2 className="font-black text-sm uppercase tracking-widest">👥 Data Anggota Keluarga</h2>
              <button type="button" onClick={tambahAnggota} disabled={anggota.length >= MAKS_ANGGOTA} className="bg-blue-500 text-white font-black uppercase tracking-widest px-4 py-2.5 rounded-lg hover:bg-blue-600 text-xs disabled:bg-slate-500 disabled:cursor-not-allowed">+ Tambah Warga ({anggota.length}/{MAKS_ANGGOTA})</button>
            </div>
            
            {anggota.map((item, index) => {
              const umur = hitungUmur(item.tglLahir);
              return (
                <div key={index} className="bg-slate-50 p-4 md:p-6 rounded-xl border-2 border-slate-200 shadow-sm relative pt-10">
                  <span className="absolute top-0 left-0 bg-slate-200 text-slate-600 text-[10px] font-black px-3 py-1 rounded-br-lg uppercase tracking-widest">Warga #{index + 1}</span>
                  <button type="button" onClick={() => hapusAnggota(index)} className="absolute top-2 right-2 text-rose-500 hover:bg-rose-100 p-1.5 rounded font-bold text-xs transition-colors">❌ Hapus</button>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div><label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">NIK (16 Digit)</label><input type="text" maxLength={16} minLength={16} required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded p-2.5 font-mono text-sm font-bold" value={item.nik} onChange={(e) => ubahAnggota(index, "nik", e.target.value.replace(/[^0-9]/g, ''))} /></div>
                    <div><label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Nama Lengkap</label><input type="text" required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded p-2.5 text-sm font-bold" value={item.nama} onChange={(e) => ubahAnggota(index, "nama", e.target.value)} /></div>
                    <div><label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Tempat Lahir</label><input type="text" required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded p-2.5 text-sm font-bold" value={item.tempatLahir} onChange={(e) => ubahAnggota(index, "tempatLahir", e.target.value)} /></div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase flex justify-between">Tanggal Lahir <span className="text-blue-600">{item.tglLahir ? `(Umur: ${umur} Thn)` : ''}</span></label>
                      <input type="date" required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded p-2.5 text-sm font-bold" value={item.tglLahir} onChange={(e) => ubahAnggota(index, "tglLahir", e.target.value)} />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Gender</label>
                        <select required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded p-2.5 text-xs font-bold" value={item.gender} onChange={(e) => ubahAnggota(index, "gender", e.target.value)}>
                          <option value="" disabled>Pilih</option><option value="Laki-laki">L</option><option value="Perempuan">P</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Agama</label>
                        <select required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded p-2.5 text-xs font-bold" value={item.agama} onChange={(e) => ubahAnggota(index, "agama", e.target.value)}>
                          <option value="" disabled>Pilih</option><option value="Islam">Islam</option><option value="Kristen/Katolik">Kristen</option><option value="Hindu">Hindu</option><option value="Budha">Budha</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Hubungan</label>
                        <select required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded p-2.5 text-xs font-bold" value={item.hubungan} onChange={(e) => ubahAnggota(index, "hubungan", e.target.value)}>
                          <option value="" disabled>Pilih</option><option value="Istri">Istri</option><option value="Suami">Suami</option><option value="Anak">Anak</option><option value="Lainnya">Lainnya</option>
                        </select>
                      </div>
                    </div>
                    
                    <div><label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Pekerjaan</label><input type="text" required className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded p-2.5 text-sm font-bold" value={item.pekerjaan} onChange={(e) => ubahAnggota(index, "pekerjaan", e.target.value)} /></div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Pendidikan</label>
                      <select className="w-full border-2 border-slate-200 bg-white text-slate-900 rounded p-2.5 text-sm font-bold" value={item.pendidikan} onChange={(e) => ubahAnggota(index, "pendidikan", e.target.value)}>
                        <option value="">Opsional</option>
                        {PILIHAN_PENDIDIKAN.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>

                  {item.hubungan === "Lainnya" && (
                    <div className="mb-4 bg-amber-50 p-3 rounded border border-amber-200">
                      <label className="block text-[10px] font-bold text-amber-800 mb-1 uppercase">Spesifikasikan Hubungan Keluarga</label>
                      <input type="text" required className="w-full border-2 border-amber-200 bg-white text-slate-900 rounded p-2.5 text-sm font-bold" placeholder="Mertua / Keponakan / Adik..." value={item.hubunganDetail} onChange={(e) => ubahAnggota(index, "hubunganDetail", e.target.value)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-3 rounded-xl border-2 border-slate-200 bg-slate-50 p-4 md:p-5">
            <p className="text-xs font-black uppercase tracking-widest text-slate-700">Persetujuan pemrosesan data</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Centang hanya setelah membaca naskah. Persetujuan dicatat di server (versi {VERSI_KEBIJAKAN_PRIVASI}), bukan di draf peramban.
            </p>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={bacaKebijakan} onChange={(e) => setBacaKebijakan(e.target.checked)} />
              <span className="text-sm text-slate-700 leading-relaxed">
                Saya telah membaca <Link href={PATH_KEBIJAKAN_PRIVASI} target="_blank" className="text-blue-700 font-bold underline">Kebijakan Privasi</Link> versi {VERSI_KEBIJAKAN_PRIVASI}.
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={setujuPribadi} onChange={(e) => setSetujuPribadi(e.target.checked)} />
              <span className="text-sm text-slate-700 leading-relaxed">
                Saya menyetujui pemrosesan data pribadi saya untuk administrasi RT (buku induk, verifikasi, surat, iuran, dan layanan portal).
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={setujuKeuangan} onChange={(e) => setSetujuKeuangan(e.target.checked)} />
              <span className="text-sm text-slate-700 leading-relaxed">
                Saya menyetujui pemrosesan kisaran pendapatan dan daya listrik rumah tangga untuk program RT, bukan untuk DTKS/bansos pemerintah.
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={setujuKesehatan} onChange={(e) => setSetujuKesehatan(e.target.checked)} />
              <span className="text-sm text-slate-700 leading-relaxed">
                Saya menyetujui pencatatan kunjungan posyandu individu (berat, tinggi, imunisasi, atau tensi) bila pengurus menimbangnya. Tanpa centang ini, rekam kesehatan individu tidak disimpan.
              </span>
            </label>
            {anggota.length > 0 ? (
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer">
                <input type="checkbox" className="mt-1" checked={setujuAnggota} onChange={(e) => setSetujuAnggota(e.target.checked)} />
                <span className="text-sm text-slate-700 leading-relaxed">
                  Saya adalah penanggung jawab rumah tangga dan berwenang mendaftarkan data anggota keluarga yang saya isi.
                </span>
              </label>
            ) : null}
            {anggota.some((item) => {
              const umur = umurDariTanggalIso(item.tglLahir);
              return umur != null && umur < USIA_ANAK_PDP;
            }) ? (
              <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 cursor-pointer">
                <input type="checkbox" className="mt-1" checked={setujuAnak} onChange={(e) => setSetujuAnak(e.target.checked)} />
                <span className="text-sm text-amber-950 leading-relaxed">
                  Saya orang tua atau wali dari anak di bawah 18 tahun yang didaftarkan, dan menyetujui pemrosesan data anak itu.
                </span>
              </label>
            ) : null}
          </div>

          <button type="submit" disabled={loading} className={`w-full text-white text-lg font-black tracking-widest uppercase rounded-xl p-5 transition-all mt-8 shadow-xl relative overflow-hidden ${loading ? 'bg-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:scale-[1.02]'}`}>
            {loading ? <span className="flex items-center justify-center gap-3"><span className="animate-spin text-2xl">⏳</span> {progressTeks}</span> : "SUBMIT DATA SENSUS & LAPOR DIRI"}
          </button>
        </form>
      </div>
    </div>
  );
}
