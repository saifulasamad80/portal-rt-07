"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LaporDiri() {
  const [nik, setNik] = useState("");
  const [nama, setNama] = useState("");
  const [wa, setWa] = useState("");
  const [pin, setPin] = useState(""); 
  const [statusTinggal, setStatusTinggal] = useState("");
  const [detailAlamat, setDetailAlamat] = useState("");
  
  // FAKTA PERBAIKAN: Menambahkan 'nik' ke dalam struktur anggota keluarga
  const [anggota, setAnggota] = useState<{ nama: string; nik: string; hubungan: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const tambahAnggota = () => setAnggota([...anggota, { nama: "", nik: "", hubungan: "" }]);
  const ubahAnggota = (index: number, field: "nama" | "nik" | "hubungan", value: string) => {
    const dataBaru = [...anggota];
    dataBaru[index][field] = value;
    setAnggota(dataBaru);
  };
  const hapusAnggota = (index: number) => setAnggota(anggota.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const pinLemah = ["123456", "111111", "000000", "654321", "121212"];
    if (pinLemah.includes(pin)) {
      alert("PIN terlalu gampang ditebak! Tolong gunakan kombinasi angka lain yang lebih aman.");
      return;
    }

    // Double-check NIK Anggota (wajib 16 digit jika diisi)
    for (let i = 0; i < anggota.length; i++) {
      if (anggota[i].nik.length !== 16) {
        alert(`NIK untuk anggota keluarga bernama ${anggota[i].nama || 'ke-' + (i+1)} tidak valid. Wajib 16 digit!`);
        return;
      }
    }

    setLoading(true);

    const { data: dataWarga, error: errorWarga } = await supabase
      .from("warga")
      .insert([{
          nik: nik,
          nama_lengkap: nama,
          no_whatsapp: wa,
          pin: pin, 
          status_tinggal: statusTinggal,
          detail_alamat: detailAlamat,
      }])
      .select();

    if (errorWarga) {
      alert("Gagal menyimpan data warga: " + errorWarga.message);
      setLoading(false);
      return;
    }

    if (anggota.length > 0 && dataWarga) {
      const idWarga = dataWarga[0].id;
      const payloadAnggota = anggota.map((a) => ({
        warga_id: idWarga,
        nama_lengkap: a.nama,
        nik: a.nik, // FAKTA PERBAIKAN: NIK anggota sekarang masuk ke Supabase
        hubungan_keluarga: a.hubungan,
      }));

      const { error: errorAnggota } = await supabase.from("anggota_keluarga").insert(payloadAnggota);

      if (errorAnggota) {
        alert("Warga tersimpan, tapi gagal menyimpan anggota keluarga: " + errorAnggota.message);
        setLoading(false);
        return;
      }
    }

    alert("Sempurna! Data Kepala Keluarga beserta Anggota Keluarga berhasil didaftarkan.");
    setNik(""); setNama(""); setWa(""); setPin(""); setStatusTinggal(""); setDetailAlamat(""); setAnggota([]);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center py-10">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">Portal Lapor Diri RT 07</h1>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4 pb-4 border-b border-slate-200">
            <h2 className="font-bold text-blue-700">Data Penanggung Jawab (Kepala Keluarga)</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">NIK (16 Digit)</label>
                <input type="text" maxLength={16} minLength={16} pattern="[0-9]{16}" title="NIK wajib 16 digit angka!" required className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-blue-500 text-slate-900" placeholder="16 Digit NIK" value={nik} onChange={(e) => setNik(e.target.value.replace(/[^0-9]/g, ''))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-blue-500 text-slate-900" placeholder="Sesuai KTP" value={nama} onChange={(e) => setNama(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">No. WhatsApp</label>
                <input type="tel" minLength={10} maxLength={15} pattern="[0-9]+" title="Minimal 10 digit angka" required className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-blue-500 text-slate-900" placeholder="Cth: 0812xxxx" value={wa} onChange={(e) => setWa(e.target.value.replace(/[^0-9]/g, ''))} />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex flex-col justify-center">
                <label className="block text-xs font-bold text-amber-800 mb-1">Buat PIN Akses (Seperti PIN ATM)</label>
                <input type="password" maxLength={6} minLength={6} pattern="[0-9]{6}" required className="w-full border border-amber-300 rounded p-1.5 outline-none focus:border-amber-500 text-slate-900 font-mono tracking-widest text-center text-lg" placeholder="••••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status Tempat Tinggal</label>
              <select required className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:border-blue-500 bg-white text-slate-900" value={statusTinggal} onChange={(e) => setStatusTinggal(e.target.value)}>
                <option value="" disabled>-- Pilih Status --</option>
                <option value="Warga Tetap">Warga Tetap (Rumah Pribadi)</option>
                <option value="Penyewa Kos">Penyewa Kos</option>
                <option value="Penyewa Kontrakan">Penyewa Kontrakan</option>
              </select>
            </div>
            {statusTinggal && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <label className="block text-sm font-bold text-blue-800 mb-1">{statusTinggal === "Warga Tetap" ? "Blok / Nomor Rumah" : "Nama Properti & No. Kamar"}</label>
                <input type="text" required className="w-full border border-blue-300 rounded-lg p-2.5 outline-none focus:border-blue-600 text-slate-900" placeholder="Isi alamat detail..." value={detailAlamat} onChange={(e) => setDetailAlamat(e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-100 p-2 rounded">
              <div>
                <h2 className="font-bold text-blue-700">Anggota Keluarga</h2>
                <p className="text-xs text-slate-500">Wajib isi NIK agar terbaca di Demografi RT.</p>
              </div>
              <button type="button" onClick={tambahAnggota} className="text-sm bg-blue-600 text-white font-bold px-3 py-1.5 rounded hover:bg-blue-700 shadow-sm">+ Tambah</button>
            </div>
            
            {anggota.map((item, index) => (
              <div key={index} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex-1 w-full space-y-3">
                  <input type="text" required className="w-full border border-slate-300 rounded p-2 text-sm outline-none focus:border-blue-500 text-slate-900" placeholder="Nama Lengkap Anggota" value={item.nama} onChange={(e) => ubahAnggota(index, "nama", e.target.value)} />
                  <div className="flex gap-2">
                    <input type="text" maxLength={16} minLength={16} required className="w-2/3 border border-slate-300 rounded p-2 text-sm outline-none focus:border-blue-500 text-slate-900" placeholder="NIK (16 Digit)" value={item.nik} onChange={(e) => ubahAnggota(index, "nik", e.target.value.replace(/[^0-9]/g, ''))} />
                    <select required className="w-1/3 border border-slate-300 rounded p-2 text-sm outline-none focus:border-blue-500 bg-white text-slate-900" value={item.hubungan} onChange={(e) => ubahAnggota(index, "hubungan", e.target.value)}>
                      <option value="" disabled>Hubungan</option>
                      <option value="Istri">Istri</option>
                      <option value="Suami">Suami</option>
                      <option value="Anak">Anak</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                </div>
                <button type="button" onClick={() => hapusAnggota(index)} className="w-full md:w-auto bg-red-100 text-red-600 hover:bg-red-200 font-bold px-3 py-2 rounded transition-colors text-sm">Hapus</button>
              </div>
            ))}
          </div>

          <button type="submit" disabled={loading} className={`w-full text-white text-lg font-bold rounded-xl p-4 transition-all mt-6 shadow-md ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'}`}>
            {loading ? "Menyinkronkan ke Database..." : "Kirim Data Lapor Diri"}
          </button>
        </form>
      </div>
    </div>
  );
}