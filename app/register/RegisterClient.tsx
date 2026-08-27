"use client";
import { useState } from "react";
import imageCompression from "browser-image-compression";
import { useRouter } from "next/navigation";
import Link from "next/link";

// INJEKSI MUTLAK: SAKELAR DEWA (FEATURE FLAG)
// Ubah menjadi 'true' jika suatu saat KTP ingin diwajibkan lagi!
const FITUR_KTP_AKTIF = false; 

type AnggotaKeluarga = {
  nama: string;
  nik: string;
  hubungan: string;
  hubunganDetail: string;
  tglLahir: string;
  tempatLahir: string;
  gender: string;
  pekerjaan: string;
  fileKtp: File | null;
  ktpMenyusul: boolean;
};

export default function RegisterClient({ aksiRegister }: { aksiRegister: any }) {
  const router = useRouter();

  const [nik, setNik] = useState("");
  const [nama, setNama] = useState("");
  const [wa, setWa] = useState("");
  const [pin, setPin] = useState(""); 
  const [statusTinggal, setStatusTinggal] = useState("");
  const [detailAlamat, setDetailAlamat] = useState("");
  const [tglLahir, setTglLahir] = useState("");
  const [tempatLahir, setTempatLahir] = useState("");
  const [gender, setGender] = useState("");
  const [pekerjaan, setPekerjaan] = useState("");
  const [pendapatan, setPendapatan] = useState("");
  const [listrik, setListrik] = useState("");
  const [fileKtp, setFileKtp] = useState<File | null>(null);
  const [fileKk, setFileKk] = useState<File | null>(null);
  const [dokumenMenyusul, setDokumenMenyusul] = useState(false);
  const [anggota, setAnggota] = useState<AnggotaKeluarga[]>([]);
  const [loading, setLoading] = useState(false);
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

  const hitungUmur = (tanggal: string) => {
    if (!tanggal) return 0;
    const today = new Date();
    const birthDate = new Date(tanggal);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const validasiNIKLogika = (nikInput: string, pemilik: string): string | null => {
    if (nikInput.length !== 16) return `NIK ${pemilik} harus 16 digit.`;
    if (/^(\d)\1{15}$/.test(nikInput)) return `NIK ${pemilik} terdeteksi spam (angka berulang).`;
    if (nikInput === "1234567890123456") return `NIK ${pemilik} tidak valid.`;
    return null; 
  };

  const kompresDanUbahKeBase64 = async (fileOri: File) => {
    const options = { maxSizeMB: 0.1, maxWidthOrHeight: 1024, useWebWorker: false, fileType: "image/jpeg" };
    try {
      await new Promise(resolve => setTimeout(resolve, 50)); 
      const fileKompresi = await imageCompression(fileOri, options);
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(fileKompresi);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
      });
    } catch (err: any) {
      throw new Error("Kompresi gambar gagal: " + err.message);
    }
  };

  const tambahAnggota = () => {
    setAnggota([...anggota, { nama: "", nik: "", hubungan: "", hubunganDetail: "", tglLahir: "", tempatLahir: "", gender: "", pekerjaan: "", fileKtp: null, ktpMenyusul: false }]);
  };

  const ubahAnggota = (index: number, field: keyof AnggotaKeluarga, value: any) => {
    const dataBaru = [...anggota];
    (dataBaru[index][field] as any) = value;
    setAnggota(dataBaru);
  };

  const hapusAnggota = (index: number) => setAnggota(anggota.filter((_, i) => i !== index));

  const handleFileAnggota = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      ubahAnggota(index, "fileKtp", file);
    } else {
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const pinLemah = ["123456", "111111", "000000", "654321", "121212", "123123"];
    if (pinLemah.includes(pin)) return alert("PIN terlalu gampang ditebak!");
    const errNikKK = validasiNIKLogika(nik, "Kepala Keluarga");
    if (errNikKK) return alert(errNikKK);

    for (let i = 0; i < anggota.length; i++) {
      const a = anggota[i];
      const namaLabel = a.nama || `Anggota ${i+1}`;
      const errNik = validasiNIKLogika(a.nik, namaLabel);
      if (errNik) return alert(errNik);
      
      const umur = hitungUmur(a.tglLahir);
      if (FITUR_KTP_AKTIF) {
        if (umur >= 17 && !a.fileKtp && !a.ktpMenyusul) {
          return alert(`${namaLabel} berumur ${umur} tahun. Wajib melampirkan foto KTP atau centang 'KTP Menyusul'.`);
        }
      }
    }

    if (FITUR_KTP_AKTIF) {
      if (!dokumenMenyusul && (!fileKtp || !fileKk)) {
        return alert("Lampirkan KTP dan KK Kepala Keluarga, atau centang 'Dokumen Menyusul'.");
      }
    } else {
      if (!dokumenMenyusul && !fileKk) {
        return alert("Lampirkan Foto Kartu Keluarga, atau centang 'Dokumen Menyusul'.");
      }
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
          if (FITUR_KTP_AKTIF && a.fileKtp && !a.ktpMenyusul) {
            pathKtpAnggota = await kompresDanUbahKeBase64(a.fileKtp);
          }
          return {
            nama_lengkap: a.nama,
            nik: a.nik,
            hubungan_keluarga: a.hubungan,
            hubungan_detail: a.hubungan === "Lainnya" ? a.hubunganDetail : null,
            tanggal_lahir: a.tglLahir,
            tempat_lahir: a.tempatLahir,
            jenis_kelamin: a.gender,
            pekerjaan: a.pekerjaan,
            ktp_path: pathKtpAnggota
          };
        })
      );

      const payloadKepala = {
        nik, nama_lengkap: nama, no_whatsapp: wa, pin, status_tinggal: statusTinggal, detail_alamat: detailAlamat,
        tanggal_lahir: tglLahir, tempat_lahir: tempatLahir, jenis_kelamin: gender, pekerjaan,
        pendapatan_bulanan: pendapatan, daya_listrik: listrik,
        ktp_path: pathKtpKK, kk_path: pathKkKK
      };

      setProgressTeks("Mendaftarkan & Mengunggah via Server (Jalur Aman)...");
      await aksiRegister(payloadKepala, anggotaPayload);

      alert("Sempurna! Data Lapor Diri sukses dikirim. Tunggu verifikasi RT.");
      router.push("/login"); 
      
    } catch (err: any) {
      alert("TERJADI KESALAHAN: " + err.message);
      setLoading(false);
      setProgressTeks("");
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
        <h1 className="text-2xl md:text-3xl font-black text-slate-800 mb-2 text-center tracking-tight">Formulir Lapor Diri RT 07</h1>
        <p className="text-center text-slate-500 text-xs md:text-sm mb-8 font-bold">Terintegrasi dengan sistem Pendataan Sensus & DPT Pemilu</p>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="space-y-4 pb-6 border-b border-slate-200">
            <h2 className="font-black text-blue-700 uppercase tracking-widest text-sm flex items-center gap-2">👤 Data Kepala Keluarga / Penanggung Jawab</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">NIK (16 Digit)</label><input type="text" maxLength={16} minLength={16} pattern="[0-9]{16}" required className="w-full border-2 border-slate-200 rounded-lg p-3 text-slate-900 font-mono font-bold" value={nik} onChange={(e) => setNik(e.target.value.replace(/[^0-9]/g, ''))} /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Nama Lengkap</label><input type="text" required className="w-full border-2 border-slate-200 rounded-lg p-3 font-bold" value={nama} onChange={(e) => setNama(e.target.value)} /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Tempat Lahir</label><input type="text" required className="w-full border-2 border-slate-200 rounded-lg p-3" value={tempatLahir} onChange={(e) => setTempatLahir(e.target.value)} /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Tanggal Lahir</label><input type="date" required className="w-full border-2 border-slate-200 rounded-lg p-3 font-bold" value={tglLahir} onChange={(e) => setTglLahir(e.target.value)} /></div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Jenis Kelamin</label>
                <select required className="w-full border-2 border-slate-200 rounded-lg p-3 bg-white font-bold" value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="" disabled>Pilih...</option><option value="Laki-laki">Laki-laki</option><option value="Perempuan">Perempuan</option>
                </select>
              </div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Pekerjaan</label><input type="text" required className="w-full border-2 border-slate-200 rounded-lg p-3" value={pekerjaan} onChange={(e) => setPekerjaan(e.target.value)} /></div>
              
              <div><label className="block text-xs font-bold text-slate-600 mb-1 uppercase">No. WhatsApp</label><input type="tel" minLength={10} maxLength={15} required className="w-full border-2 border-slate-200 rounded-lg p-3 font-mono" value={wa} onChange={(e) => setWa(e.target.value.replace(/[^0-9]/g, ''))} /></div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <label className="block text-[10px] font-black uppercase text-amber-800 mb-1 text-center">Buat PIN Portal (6 Angka)</label>
                <input type="password" maxLength={6} minLength={6} required className="w-full border border-amber-300 rounded p-2 text-slate-900 font-mono tracking-widest text-center text-xl shadow-inner" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Status Tempat Tinggal</label>
              <select required className="w-full border-2 border-slate-200 rounded-lg p-3 bg-white font-bold" value={statusTinggal} onChange={(e) => setStatusTinggal(e.target.value)}>
                <option value="" disabled>-- Pilih Status --</option>
                <option value="Warga Tetap">Warga Tetap (Rumah Pribadi)</option><option value="Penyewa Kos">Penyewa Kos</option><option value="Penyewa Kontrakan">Penyewa Kontrakan</option>
              </select>
            </div>
            
            {/* INJEKSI MUTLAK UX BUNGLON DIMULAI */}
            {statusTinggal && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-inner animate-in fade-in slide-in-from-top-2">
                <label className="block text-xs font-black uppercase tracking-wider text-blue-900 mb-1">
                  {statusTinggal === "Penyewa Kos" 
                    ? "Nama Kos, Kamar & Alamat Lengkap" 
                    : "Nama Gang / Komplek & Nomor Rumah"}
                </label>
                
                <p className="text-[10px] text-blue-700 font-medium mb-3 leading-relaxed">
                  *Tuliskan patokan jalan, nama komplek/kos, dan nomor. <strong className="text-rose-600 bg-rose-100 px-1 rounded">DILARANG</strong> menulis RT/RW dan Kelurahan karena akan otomatis tercetak di surat.
                </p>

                <input 
                  type="text" 
                  required 
                  className="w-full border-2 border-blue-300 rounded-lg p-3 font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder:font-normal placeholder:text-slate-400" 
                  placeholder={
                    statusTinggal === "Penyewa Kos" 
                      ? "Cth: Kos Ibu Budi Kamar 03, Gang Pelita No. 10" 
                      : "Cth: Gang Pelita, Komplek Griya Awalin No. 28"
                  }
                  value={detailAlamat} 
                  onChange={(e) => setDetailAlamat(e.target.value)} 
                />
              </div>
            )}
            {/* INJEKSI MUTLAK UX BUNGLON SELESAI */}

          </div>

          <div className="space-y-4 pb-6 border-b border-slate-200">
            <h2 className="font-black text-emerald-700 uppercase tracking-widest text-sm flex items-center gap-2">📊 Data Profil Ekonomi (Validasi Desil Bansos)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Rata-rata Pendapatan / Bulan</label>
                <select required className="w-full border-2 border-slate-200 rounded-lg p-3 bg-white font-bold text-sm" value={pendapatan} onChange={(e) => setPendapatan(e.target.value)}>
                  <option value="" disabled>Pilih Skala Pendapatan...</option>
                  <option value="< 1 Juta">Kurang dari Rp 1.000.000</option>
                  <option value="1 - 3 Juta">Rp 1.000.000 - Rp 3.000.000</option>
                  <option value="3 - 5 Juta">Rp 3.000.000 - Rp 5.000.000</option>
                  <option value="5 - 10 Juta">Rp 5.000.000 - Rp 10.000.000</option>
                  <option value="> 10 Juta">Lebih dari Rp 10.000.000</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Daya Listrik Terpasang</label>
                <select required className="w-full border-2 border-slate-200 rounded-lg p-3 bg-white font-bold text-sm" value={listrik} onChange={(e) => setListrik(e.target.value)}>
                  <option value="" disabled>Pilih Daya Listrik...</option>
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
                <p className="text-[10px] text-slate-500 font-bold mt-1">
                  {FITUR_KTP_AKTIF ? "Dienkripsi dan diamankan khusus untuk verifikasi pengurus RT." : "Sesuai instruksi RT, saat ini hanya membutuhkan dokumen Kartu Keluarga (KK)."}
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border-2 border-amber-300 text-amber-900 font-bold text-xs shadow-sm hover:bg-amber-50">
                <input type="checkbox" checked={dokumenMenyusul} onChange={(e) => { 
                  setDokumenMenyusul(e.target.checked); 
                  if (e.target.checked) { setFileKtp(null); setFileKk(null); } 
                }} className="w-5 h-5 text-amber-600 rounded" />
                {FITUR_KTP_AKTIF ? "KTP & KK Menyusul" : "KK Menyusul / Fisik"}
              </label>
            </div>
            
            {!dokumenMenyusul && (
              <div className={`grid grid-cols-1 ${FITUR_KTP_AKTIF ? 'md:grid-cols-2' : ''} gap-4`}>
                {FITUR_KTP_AKTIF && (
                  <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <label className="block text-xs font-black uppercase text-slate-700 mb-2">📸 Foto E-KTP (Kepala Keluarga)</label>
                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'ktp')} className="w-full text-xs" />
                    {fileKtp && <div className="text-[10px] text-emerald-600 font-black mt-2 bg-emerald-50 px-2 py-1 rounded w-fit">✓ File terlampir</div>}
                  </div>
                )}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                  <label className="block text-xs font-black uppercase text-slate-700 mb-2">📸 Foto Kartu Keluarga</label>
                  <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'kk')} className="w-full text-xs" />
                  {fileKk && <div className="text-[10px] text-emerald-600 font-black mt-2 bg-emerald-50 px-2 py-1 rounded w-fit">✓ File terlampir</div>}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl text-white shadow-md">
              <div>
                <h2 className="font-black text-sm uppercase tracking-widest">👥 Data Anggota Keluarga</h2>
                {FITUR_KTP_AKTIF && <p className="text-[10px] text-slate-400 mt-1">Wajib KTP jika umur ≥ 17 Tahun (Sistem Sensus).</p>}
              </div>
              <button type="button" onClick={tambahAnggota} className="bg-blue-500 text-white font-black uppercase tracking-widest px-4 py-2.5 rounded-lg hover:bg-blue-600 text-xs">+ Tambah Warga</button>
            </div>
            
            {anggota.map((item, index) => {
              const umur = hitungUmur(item.tglLahir);
              const wajibKtp = umur >= 17;

              return (
                <div key={index} className="bg-slate-50 p-4 md:p-6 rounded-xl border-2 border-slate-200 shadow-sm relative pt-10">
                  <span className="absolute top-0 left-0 bg-slate-200 text-slate-600 text-[10px] font-black px-3 py-1 rounded-br-lg uppercase tracking-widest">Warga #{index + 1}</span>
                  <button type="button" onClick={() => hapusAnggota(index)} className="absolute top-2 right-2 text-rose-500 hover:bg-rose-100 p-1.5 rounded font-bold text-xs transition-colors">❌ Hapus</button>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div><label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">NIK (16 Digit)</label><input type="text" maxLength={16} minLength={16} required className="w-full border-2 border-slate-200 rounded p-2.5 font-mono text-sm font-bold" value={item.nik} onChange={(e) => ubahAnggota(index, "nik", e.target.value.replace(/[^0-9]/g, ''))} /></div>
                    <div><label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Nama Lengkap</label><input type="text" required className="w-full border-2 border-slate-200 rounded p-2.5 text-sm font-bold" value={item.nama} onChange={(e) => ubahAnggota(index, "nama", e.target.value)} /></div>
                    <div><label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Tempat Lahir</label><input type="text" required className="w-full border-2 border-slate-200 rounded p-2.5 text-sm" value={item.tempatLahir} onChange={(e) => ubahAnggota(index, "tempatLahir", e.target.value)} /></div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase flex justify-between">Tanggal Lahir <span className="text-blue-600">{item.tglLahir ? `(Umur: ${umur} Thn)` : ''}</span></label>
                      <input type="date" required className="w-full border-2 border-slate-200 rounded p-2.5 text-sm font-bold" value={item.tglLahir} onChange={(e) => ubahAnggota(index, "tglLahir", e.target.value)} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Gender</label>
                        <select required className="w-full border-2 border-slate-200 rounded p-2.5 text-xs font-bold" value={item.gender} onChange={(e) => ubahAnggota(index, "gender", e.target.value)}>
                          <option value="" disabled>Pilih...</option><option value="Laki-laki">L</option><option value="Perempuan">P</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Hubungan</label>
                        <select required className="w-full border-2 border-slate-200 rounded p-2.5 text-xs font-bold" value={item.hubungan} onChange={(e) => ubahAnggota(index, "hubungan", e.target.value)}>
                          <option value="" disabled>Pilih...</option><option value="Istri">Istri</option><option value="Suami">Suami</option><option value="Anak">Anak</option><option value="Lainnya">Lainnya</option>
                        </select>
                      </div>
                    </div>
                    
                    <div><label className="block text-[10px] font-bold text-slate-600 mb-1 uppercase">Pekerjaan</label><input type="text" required className="w-full border-2 border-slate-200 rounded p-2.5 text-sm" value={item.pekerjaan} onChange={(e) => ubahAnggota(index, "pekerjaan", e.target.value)} /></div>
                  </div>

                  {item.hubungan === "Lainnya" && (
                    <div className="mb-4 bg-amber-50 p-3 rounded border border-amber-200">
                      <label className="block text-[10px] font-bold text-amber-800 mb-1 uppercase">Spesifikasikan Hubungan Keluarga</label>
                      <input type="text" required className="w-full border-2 border-amber-200 rounded p-2.5 text-sm" placeholder="Mertua / Keponakan / Adik..." value={item.hubunganDetail} onChange={(e) => ubahAnggota(index, "hubunganDetail", e.target.value)} />
                    </div>
                  )}

                  {FITUR_KTP_AKTIF && wajibKtp && (
                    <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg flex flex-col md:flex-row justify-between items-start gap-4">
                      <div className="w-full">
                        <label className="block text-xs font-black uppercase text-blue-800 mb-1">⚠️ Wajib Upload KTP (Usia ≥ 17 thn)</label>
                        <input type="file" accept="image/*" disabled={item.ktpMenyusul} onChange={(e) => handleFileAnggota(e, index)} className="w-full text-xs mt-2" />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded border border-blue-200 text-blue-800 font-bold text-[10px] shrink-0 mt-2 md:mt-0">
                        <input type="checkbox" checked={item.ktpMenyusul} onChange={(e) => { ubahAnggota(index, "ktpMenyusul", e.target.checked); if(e.target.checked) ubahAnggota(index, "fileKtp", null); }} className="w-4 h-4 rounded" />
                        KTP Menyusul
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button type="submit" disabled={loading} className={`w-full text-white text-lg font-black tracking-widest uppercase rounded-xl p-5 transition-all mt-8 shadow-xl relative overflow-hidden ${loading ? 'bg-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:scale-[1.02]'}`}>
            {loading ? <span className="flex items-center justify-center gap-3"><span className="animate-spin text-2xl">⏳</span> {progressTeks}</span> : "SUBMIT DATA SENSUS & LAPOR DIRI"}
          </button>
        </form>
      </div>
    </div>
  );
}