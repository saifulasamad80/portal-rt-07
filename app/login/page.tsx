"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import imageCompression from "browser-image-compression"; // FAKTA: Wajib panggil library kompresi

export default function LoginWarga() {
  const [nik, setNik] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState({ text: "", type: "" });
  const router = useRouter();

  // FAKTA: State khusus untuk Mode Susulan Dokumen
  const [modeSusulan, setModeSusulan] = useState(false);
  const [wargaId, setWargaId] = useState("");
  const [fileKtp, setFileKtp] = useState<File | null>(null);
  const [fileKk, setFileKk] = useState<File | null>(null);
  const [progressTeks, setProgressTeks] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, tipe: 'ktp' | 'kk') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Hanya boleh mengunggah file gambar (JPG/PNG/JPEG)!");
      e.target.value = "";
      return;
    }
    if (tipe === 'ktp') setFileKtp(file);
    if (tipe === 'kk') setFileKk(file);
  };

  const kompresDanUploadFile = async (fileOri: File, tipe: string, nikWarga: string) => {
    const options = { maxSizeMB: 0.2, maxWidthOrHeight: 1024, useWebWorker: true, fileType: "image/jpeg" };
    try {
      setProgressTeks(`Mengompres dokumen ${tipe.toUpperCase()}...`);
      const fileKompresi = await imageCompression(fileOri, options);
      
      setProgressTeks(`Mengirim dokumen ${tipe.toUpperCase()} ke brankas RT...`);
      const fileName = `${nikWarga}_${tipe}_${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('dokumen_warga').upload(fileName, fileKompresi, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      return fileName;
    } catch (error: any) {
      throw new Error(`Gagal upload ${tipe}: ` + error.message);
    }
  };

  const handleUploadSusulan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileKtp || !fileKk) {
      alert("Mohon lengkapi Foto KTP dan Foto KK terlebih dahulu!");
      return;
    }
    setLoading(true);
    try {
      const pathKtp = await kompresDanUploadFile(fileKtp, 'ktp', nik);
      const pathKk = await kompresDanUploadFile(fileKk, 'kk', nik);

      setProgressTeks("Memperbarui status pendaftaran...");
      const { error } = await supabase
        .from("warga")
        .update({ ktp_path: pathKtp, kk_path: pathKk })
        .eq("id", wargaId);

      if (error) throw error;

      alert("Dokumen berhasil disusulkan! Pak RT akan segera memvalidasi pendaftaran Anda.");
      setModeSusulan(false);
      setFileKtp(null);
      setFileKk(null);
      setPin(""); 
    } catch (err: any) {
      alert("TERJADI KESALAHAN: " + err.message);
    } finally {
      setLoading(false);
      setProgressTeks("");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPesan({ text: "", type: "" });

    const { data: cekData, error: cekError } = await supabase
      .from("warga")
      .select("id, status_verifikasi, auth_email, ktp_path, kk_path")
      .eq("nik", nik)
      .eq("pin", pin)
      .single();

    if (cekError || !cekData) {
      setPesan({ text: "Gagal: NIK atau PIN salah, atau Anda belum terdaftar.", type: "error" });
      setLoading(false);
      return;
    }

    // FAKTA: Cegat warga yang statusnya Menunggu
    if (cekData.status_verifikasi === "Menunggu") {
      // Jika dokumennya "MENYUSUL", aktifkan mode upload dokumen!
      if (cekData.ktp_path === "MENYUSUL" || cekData.kk_path === "MENYUSUL") {
        setWargaId(cekData.id);
        setModeSusulan(true);
        setLoading(false);
        return;
      }
      // Jika dokumen sudah ada tapi belum di-acc, suruh sabar
      setPesan({ text: "Status: Data Anda masih dalam antrean verifikasi Pak RT.", type: "warning" });
      setLoading(false);
      return;
    }

    if (cekData.status_verifikasi === "Ditolak") {
      setPesan({ text: "Ditolak: Pendaftaran Anda dibatalkan oleh RT.", type: "error" });
      setLoading(false);
      return;
    }

    const emailOtentikasi = cekData.auth_email || `${nik}@warga.rt07.com`;
    let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailOtentikasi, password: pin,
    });

    if (authError) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: emailOtentikasi, password: pin,
      });

      if (signUpError) {
        setPesan({ text: `Enkripsi Gagal: ${signUpError.message}`, type: "error" });
        setLoading(false);
        return;
      }

      await supabase.from("warga").update({ auth_email: emailOtentikasi }).eq("id", cekData.id);

      if (!signUpData.session || !signUpData.user) {
        setPesan({ text: "Gagal: Pengaturan 'Confirm Email' menyala!", type: "error" });
        setLoading(false);
        return;
      }
      authData = {
        user: signUpData.user,
        session: signUpData.session,
      };
    } else if (!authData.user) {
      setPesan({ text: "Otentikasi Gagal: Kesalahan sistem enkripsi.", type: "error" });
      setLoading(false);
      return;
    }

    setPesan({ text: "Otentikasi JWT Berhasil! Mengalihkan...", type: "success" });
    setTimeout(() => { router.push("/portal"); }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 flex flex-col items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm border-t-4 border-blue-600 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded-bl-lg">SECURE JWT</div>
        
        <h1 className="text-2xl font-bold text-slate-800 mb-2 text-center">
          {modeSusulan ? "Upload Susulan" : "Masuk Portal Warga"}
        </h1>
        <p className="text-sm text-slate-500 mb-6 text-center">
          {modeSusulan ? "Sistem mendeteksi dokumen Anda belum lengkap." : "Gunakan NIK dan PIN yang telah didaftarkan"}
        </p>
        
        {pesan.text && !modeSusulan && (
          <div className={`p-3 mb-4 text-sm font-bold rounded-lg ${
            pesan.type === 'error' ? 'bg-red-100 text-red-700' : 
            pesan.type === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
          }`}>
            {pesan.text}
          </div>
        )}

        {/* LOGIKA CABANG: Tampilkan Form Upload ATAU Form Login */}
        {modeSusulan ? (
          <form onSubmit={handleUploadSusulan} className="space-y-4">
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-800 text-xs font-bold text-center mb-4">
              Akun Anda tertahan. Unggah KTP & KK sekarang agar Pak RT dapat memvalidasi pendaftaran Anda.
            </div>
            
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1">📸 Foto E-KTP</label>
                <input type="file" required accept="image/*" onChange={(e) => handleFileChange(e, 'ktp')} className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-bold file:bg-blue-100 file:text-blue-700" />
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1">📸 Foto Kartu Keluarga</label>
                <input type="file" required accept="image/*" onChange={(e) => handleFileChange(e, 'kk')} className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-bold file:bg-blue-100 file:text-blue-700" />
              </div>
            </div>

            <button type="submit" disabled={loading} className={`w-full text-white font-bold rounded-lg p-3 transition-colors mt-2 shadow ${loading ? 'bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⌛</span> {progressTeks || "Memproses..."}
                </span>
              ) : "Unggah & Ajukan Ulang"}
            </button>
            <button type="button" disabled={loading} onClick={() => { setModeSusulan(false); setPin(""); }} className="w-full text-slate-500 font-bold text-sm py-2 hover:text-slate-700">
              Batal
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NIK (16 Digit)</label>
              <input type="text" required maxLength={16} minLength={16} pattern="[0-9]{16}" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-blue-500 text-slate-900 font-mono tracking-wider" placeholder="16 Digit Angka" value={nik} onChange={(e) => setNik(e.target.value.replace(/[^0-9]/g, ''))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PIN Rahasia (6 Digit)</label>
              <input type="password" required maxLength={6} minLength={6} pattern="[0-9]{6}" className="w-full border border-slate-300 rounded-lg p-3 outline-none focus:border-blue-500 text-slate-900 font-mono tracking-widest text-center text-xl" placeholder="••••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} />
            </div>
            <button type="submit" disabled={loading} className={`w-full text-white font-bold rounded-lg p-3 transition-colors mt-2 shadow ${loading ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {loading ? "Otentikasi Server..." : "Masuk"}
            </button>
          </form>
        )}

        {!modeSusulan && (
          <div className="mt-6 text-center text-sm text-slate-500 border-t border-slate-200 pt-4">
            Warga baru atau belum lapor RT? <br/>
            <Link href="/register" className="text-blue-600 font-bold hover:underline mt-1 inline-block">
              Ajukan Data Lapor Diri Sekarang
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}