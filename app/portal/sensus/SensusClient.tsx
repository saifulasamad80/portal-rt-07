"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SensusClient({ aksiKirim }: { aksiKirim: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // 1. STATE KLASTER KONDISI KHUSUS (Default: false)
  const [kondisi, setKondisi] = useState({
    ada_ibu_hamil: false, ada_disabilitas: false, ada_ibu_menyusui: false,
    ada_ibu_meninggal: false, ada_bayi_meninggal: false, ada_balita_meninggal: false,
    ada_bayi_baru_lahir: false, bayi_tanpa_akta: false, ada_ibu_nifas: false,
  });

  // 2. STATE KLASTER SANITASI & FASILITAS
  const [fasilitas, setFasilitas] = useState({
    sumber_air_utama: "", status_kesehatan_rumah: "",
    memiliki_mck: false, memiliki_tempat_sampah: false, memiliki_spal: false, memiliki_resapan_air: false,
  });

  // 3. STATE KLASTER PEMBERDAYAAN EKONOMI
  const [ekonomi, setEkonomi] = useState({
    jenis_makanan_pokok: "", ikut_up2k: false, ikut_pemanfaatan_pekarangan: false, ikut_industri_rt: false, ikut_kesehatan_lingkungan: false,
  });

  // 4. META & CAPTCHA ENGINE
  const [catatan, setCatatan] = useState("");
  const [mathTask, setMathTask] = useState({ a: 0, b: 0, operator: '+', result: 0 });
  const [captchaInput, setCaptchaInput] = useState("");

  const generateCaptcha = () => {
    const isPlus = Math.random() > 0.5;
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    if (isPlus) {
      setMathTask({ a, b, operator: '+', result: a + b });
    } else {
      const max = Math.max(a, b);
      const min = Math.min(a, b);
      setMathTask({ a: max, b: min, operator: '-', result: max - min });
    }
    setCaptchaInput("");
  };

  useEffect(() => { generateCaptcha(); }, []);

  const handleToggle = (group: 'kondisi' | 'fasilitas' | 'ekonomi', field: string) => {
    if (group === 'kondisi') setKondisi({ ...kondisi, [field]: !(kondisi as any)[field] });
    if (group === 'fasilitas') setFasilitas({ ...fasilitas, [field]: !(fasilitas as any)[field] });
    if (group === 'ekonomi') setEkonomi({ ...ekonomi, [field]: !(ekonomi as any)[field] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fasilitas.sumber_air_utama) return alert("Pilih Sumber Air Utama keluarga Anda!");
    if (!fasilitas.status_kesehatan_rumah) return alert("Pilih Status Kesehatan Rumah Anda!");
    if (!ekonomi.jenis_makanan_pokok) return alert("Pilih Jenis Makanan Pokok keluarga Anda!");
    
    // VERIFIKASI CAPTCHA
    if (parseInt(captchaInput) !== mathTask.result) {
      alert("⚠️ Validasi Keamanan Gagal: Jawaban matematika Anda salah!");
      generateCaptcha();
      return;
    }

    setLoading(true);
    try {
      const payloadGabungan = { ...kondisi, ...fasilitas, ...ekonomi, catatan_tambahan: catatan };
      await aksiKirim(payloadGabungan);
      alert("✅ TERIMA KASIH!\n\nData Sensus Profil Keluarga Anda berhasil dikirim ke database RT. Pengurus akan segera memvalidasi data Anda.");
      router.push("/portal");
      router.refresh();
    } catch (error: any) {
      alert("Gagal mengirim data sensus: " + error.message);
      setLoading(false);
    }
  };

  // Komponen Helper untuk UI Toggle Switch
  const ToggleSwitch = ({ label, desc, checked, onChange }: { label: string, desc: string, checked: boolean, onChange: () => void }) => (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 transition-colors hover:bg-slate-100 cursor-pointer active:scale-[0.99]" onClick={onChange}>
      <div className="pr-4">
        <h4 className="font-bold text-slate-800 text-sm">{label}</h4>
        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{desc}</p>
      </div>
      <div className={`w-12 h-6 flex items-center rounded-full p-1 shrink-0 transition-colors duration-300 ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-0'}`}></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 pb-20 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        
        <Link href="/portal" className="text-slate-500 font-bold hover:text-slate-800 text-sm inline-flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 transition-all active:scale-95">
          <span>&larr;</span> Batal & Kembali
        </Link>

        {/* HEADER */}
        <div className="bg-rose-600 p-8 rounded-2xl shadow-xl text-white relative overflow-hidden">
          <div className="absolute -right-10 -top-10 text-9xl opacity-10">📋</div>
          <h1 className="text-2xl md:text-3xl font-black mb-2">Sensus Kesejahteraan Keluarga</h1>
          <p className="text-rose-100 text-xs md:text-sm max-w-lg leading-relaxed">
            Data ini diintegrasikan dengan standar <strong>DTKS & BPS Pusat</strong>. Validitas data menentukan prioritas Bantuan Sosial (Bansos), Posyandu, dan Bedah Rumah di lingkungan RT 07.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* KLASTER 1: KERENTANAN & KESEHATAN */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-rose-500">
            <h2 className="font-black text-lg text-slate-800 mb-1">1. Kondisi Khusus & Kerentanan</h2>
            <p className="text-xs text-slate-500 mb-6 border-b border-slate-100 pb-4">Tandai kondisi yang memerlukan perhatian khusus program PKK & Puskesmas.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ToggleSwitch label="Terdapat Ibu Hamil" desc="Mendapat prioritas layanan Posyandu bulanan." checked={kondisi.ada_ibu_hamil} onChange={() => handleToggle('kondisi', 'ada_ibu_hamil')} />
              <ToggleSwitch label="Anggota Disabilitas" desc="Terdapat anggota disabilitas fisik/mental/netra." checked={kondisi.ada_disabilitas} onChange={() => handleToggle('kondisi', 'ada_disabilitas')} />
              <ToggleSwitch label="Ibu Sedang Nifas" desc="Pemantauan kesehatan pasca melahirkan." checked={kondisi.ada_ibu_nifas} onChange={() => handleToggle('kondisi', 'ada_ibu_nifas')} />
              <ToggleSwitch label="Ibu Menyusui" desc="Diikutkan program gizi dan edukasi ASI." checked={kondisi.ada_ibu_menyusui} onChange={() => handleToggle('kondisi', 'ada_ibu_menyusui')} />
              <ToggleSwitch label="Bayi Baru Lahir" desc="Kunjungan khusus kader & pemantauan gizi." checked={kondisi.ada_bayi_baru_lahir} onChange={() => handleToggle('kondisi', 'ada_bayi_baru_lahir')} />
              <ToggleSwitch label="Bayi Tanpa Akta" desc="Bantuan pengurusan dokumen dari Kelurahan." checked={kondisi.bayi_tanpa_akta} onChange={() => handleToggle('kondisi', 'bayi_tanpa_akta')} />
              <ToggleSwitch label="Ada Ibu Meninggal" desc="Pendampingan keluarga korban & batuan sosial." checked={kondisi.ada_ibu_meninggal} onChange={() => handleToggle('kondisi', 'ada_ibu_meninggal')} />
              <ToggleSwitch label="Ada Balita Meninggal" desc="Evaluasi kesehatan lingkungan sekitar." checked={kondisi.ada_balita_meninggal} onChange={() => handleToggle('kondisi', 'ada_balita_meninggal')} />
            </div>
          </div>

          {/* KLASTER 2: SANITASI & RUMAH */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-blue-500">
            <h2 className="font-black text-lg text-slate-800 mb-1">2. Sanitasi & Kelayakan Hunian</h2>
            <p className="text-xs text-slate-500 mb-6 border-b border-slate-100 pb-4">Data riil fisik bangunan untuk program perbaikan gorong-gorong / sanitasi RT.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wide">Sumber Air Utama</label>
                <select required className="w-full border-2 border-slate-200 rounded-xl p-3.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 bg-white" value={fasilitas.sumber_air_utama} onChange={(e) => setFasilitas({...fasilitas, sumber_air_utama: e.target.value})}>
                  <option value="" disabled>Pilih Sumber Air...</option>
                  <option value="PAM / Leding">PAM / Leding</option>
                  <option value="Sumur Bor / Pompa">Sumur Bor / Pompa Air</option>
                  <option value="Sumur Gali">Sumur Gali</option>
                  <option value="Air Kemasan / Isi Ulang">Air Kemasan / Isi Ulang (Beli)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wide">Kondisi Fisik Rumah</label>
                <select required className="w-full border-2 border-slate-200 rounded-xl p-3.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 bg-white" value={fasilitas.status_kesehatan_rumah} onChange={(e) => setFasilitas({...fasilitas, status_kesehatan_rumah: e.target.value})}>
                  <option value="" disabled>Pilih Status...</option>
                  <option value="Rumah Sehat">Rumah Sehat (Layak Huni)</option>
                  <option value="Kurang Sehat">Kurang Sehat / Butuh Perbaikan</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ToggleSwitch label="Memiliki Sarana MCK" desc="Mandi, Cuci, Kakus mandiri di dalam rumah." checked={fasilitas.memiliki_mck} onChange={() => handleToggle('fasilitas', 'memiliki_mck')} />
              <ToggleSwitch label="Saluran Limbah (SPAL)" desc="Memiliki jalur pembuangan air limbah cair yang baik." checked={fasilitas.memiliki_spal} onChange={() => handleToggle('fasilitas', 'memiliki_spal')} />
              <ToggleSwitch label="Tempat Sampah Memadai" desc="Tersedia penampungan sementara yang tertutup." checked={fasilitas.memiliki_tempat_sampah} onChange={() => handleToggle('fasilitas', 'memiliki_tempat_sampah')} />
              <ToggleSwitch label="Sumur Resapan Air" desc="Sistem penyerapan air hujan aktif di rumah." checked={fasilitas.memiliki_resapan_air} onChange={() => handleToggle('fasilitas', 'memiliki_resapan_air')} />
            </div>
          </div>

          {/* KLASTER 3: PANGAN & PEMBERDAYAAN */}
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-emerald-500">
            <h2 className="font-black text-lg text-slate-800 mb-1">3. Pangan & Pemberdayaan Ekonomi</h2>
            <p className="text-xs text-slate-500 mb-6 border-b border-slate-100 pb-4">Aktivitas produktif dan ketahanan pangan skala rumah tangga.</p>
            
            <div className="mb-6">
              <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wide">Makanan Pokok Sehari-hari</label>
              <select required className="w-full border-2 border-slate-200 rounded-xl p-3.5 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 bg-white" value={ekonomi.jenis_makanan_pokok} onChange={(e) => setEkonomi({...ekonomi, jenis_makanan_pokok: e.target.value})}>
                <option value="" disabled>Pilih Jenis Makanan Utama...</option>
                <option value="Beras / Nasi">Beras / Nasi</option>
                <option value="Non-Beras (Sagu/Jagung/Ketela)">Non-Beras (Sagu / Jagung / Ketela)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ToggleSwitch label="Mengikuti UP2K" desc="Usaha Peningkatan Pendapatan Keluarga (Binaan PKK)." checked={ekonomi.ikut_up2k} onChange={() => handleToggle('ekonomi', 'ikut_up2k')} />
              <ToggleSwitch label="Industri Rumah Tangga" desc="Melakukan produksi barang/jasa skala rumahan." checked={ekonomi.ikut_industri_rt} onChange={() => handleToggle('ekonomi', 'ikut_industri_rt')} />
              <ToggleSwitch label="Pemanfaatan Pekarangan" desc="Budidaya sayur/tanaman di lahan rumah." checked={ekonomi.ikut_pemanfaatan_pekarangan} onChange={() => handleToggle('ekonomi', 'ikut_pemanfaatan_pekarangan')} />
              <ToggleSwitch label="Aktivitas Kesehatan Lingkungan" desc="Aktif dalam kegiatan kerja bakti & kebersihan RT." checked={ekonomi.ikut_kesehatan_lingkungan} onChange={() => handleToggle('ekonomi', 'ikut_kesehatan_lingkungan')} />
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100">
              <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wide">Keterangan / Catatan Tambahan Bantuan (Opsional)</label>
              <textarea rows={3} className="w-full border-2 border-slate-200 rounded-xl p-3.5 text-sm text-slate-700 outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors" placeholder="Tuliskan kendala ekonomi, rumah rubuh, atau kebutuhan kesehatan mendesak keluarga Anda di sini..." value={catatan} onChange={(e) => setCatatan(e.target.value)}></textarea>
            </div>
          </div>

          {/* KLASTER 4: VALIDASI CAPTCHA & SUBMIT */}
          <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-xl text-white border border-slate-800">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="w-full md:w-1/2">
                <h3 className="font-black text-lg mb-2">Verifikasi Kemanusiaan</h3>
                <p className="text-xs text-slate-400 mb-4">Selesaikan soal matematika dasar ini untuk memastikan bahwa Anda bukan robot/sistem otomatis (Spam).</p>
                <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-700">
                  <div className="text-2xl font-black text-rose-400 tracking-widest bg-slate-800 px-4 py-2 rounded-lg border border-slate-600">
                    {mathTask.a} {mathTask.operator} {mathTask.b} =
                  </div>
                  <input 
                    type="number" 
                    required 
                    className="flex-1 bg-transparent border-b-2 border-slate-600 focus:border-rose-500 p-2 text-2xl font-black text-center outline-none transition-colors w-24 placeholder:text-slate-700" 
                    placeholder="?"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                  />
                </div>
                <button type="button" onClick={generateCaptcha} className="text-[10px] text-slate-500 hover:text-white mt-3 font-bold uppercase tracking-widest transition-colors flex items-center gap-1">
                  <span>🔄</span> Ganti Soal
                </button>
              </div>

              <div className="w-full md:w-1/2">
                <button 
                  type="submit" 
                  disabled={loading || !captchaInput} 
                  className={`w-full h-16 flex items-center justify-center rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg active:scale-95 ${loading || !captchaInput ? 'bg-slate-700 text-slate-500 cursor-not-allowed shadow-none' : 'bg-rose-600 hover:bg-rose-500 text-white'}`}
                >
                  {loading ? (
                    <span className="flex items-center gap-2"><span className="animate-spin text-lg">⏳</span> Mengunci Data...</span>
                  ) : "Kirim Data Sensus"}
                </button>
                <p className="text-[9px] text-slate-500 text-center mt-4 uppercase tracking-widest leading-relaxed">
                  Dengan menekan tombol di atas, saya menyatakan bahwa data yang diisi adalah <strong className="text-slate-400">FAKTA</strong> dan bersedia diverifikasi langsung oleh Tim Survei / Kader PKK RT 07.
                </p>
              </div>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}