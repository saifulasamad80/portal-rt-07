"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function InventarisWarga() {
  const [warga, setWarga] = useState<any>(null);
  const [riwayat, setRiwayat] = useState<any[]>([]);
  const [masterBarang, setMasterBarang] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const router = useRouter();

  const [barang, setBarang] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [keterangan, setKeterangan] = useState("");

  useEffect(() => {
    const sesi = localStorage.getItem("warga_aktif");
    if (!sesi) {
      router.push("/login");
      return;
    }
    const dataWarga = JSON.parse(sesi);
    setWarga(dataWarga);
    fetchData(dataWarga.id);
  }, [router]);

  const fetchData = async (idWarga: string) => {
    setLoading(true);
    // FAKTA: Ambil riwayat warga
    const { data: dataRiwayat } = await supabase
      .from("peminjaman_inventaris")
      .select("*")
      .eq("warga_id", idWarga)
      .order("tanggal_pinjam", { ascending: true });
    
    // FAKTA: Ambil list barang dari database (Dinamis, bukan hardcode)
    const { data: dataMaster } = await supabase
      .from("master_inventaris")
      .select("*")
      .order("nama_barang", { ascending: true });
    
    if (dataRiwayat) setRiwayat(dataRiwayat);
    if (dataMaster) setMasterBarang(dataMaster);
    setLoading(false);
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    const { data: cekBentrok } = await supabase
      .from("peminjaman_inventaris")
      .select("id")
      .eq("nama_barang", barang)
      .eq("tanggal_pinjam", tanggal)
      .in("status", ["Menunggu", "Disetujui"]);

    if (cekBentrok && cekBentrok.length > 0) {
      alert(`DITOLAK OTOMATIS: Maaf, ${barang} sudah di-booking oleh warga lain pada tanggal tersebut. Silakan pilih tanggal lain!`);
      setSubmitLoading(false);
      return;
    }

    const { error } = await supabase.from("peminjaman_inventaris").insert([{
      warga_id: warga.id,
      nama_barang: barang,
      tanggal_pinjam: tanggal,
      keterangan: keterangan
    }]);

    if (error) {
      alert("Gagal melakukan booking: " + error.message);
    } else {
      alert("Booking berhasil dikirim! Menunggu persetujuan RT.");
      setBarang(""); setTanggal(""); setKeterangan("");
      fetchData(warga.id);
    }
    setSubmitLoading(false);
  };

  const getStatusColor = (status: string) => {
    if (status === 'Disetujui') return 'bg-emerald-100 text-emerald-700';
    if (status === 'Ditolak') return 'bg-rose-100 text-rose-700';
    if (status === 'Dikembalikan') return 'bg-blue-100 text-blue-700';
    return 'bg-amber-100 text-amber-700'; 
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Membuka kalender inventaris...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <Link href="/portal" className="text-amber-700 font-bold hover:underline mb-4 inline-block">
          &larr; Kembali ke Dasbor
        </Link>

        <div className="bg-white p-6 rounded-xl shadow border-l-8 border-amber-600">
          <h1 className="text-2xl font-bold text-slate-800">Kalender Inventaris RT</h1>
          <p className="text-slate-500 text-sm">Booking fasilitas RT dengan sistem anti-bentrok. Pastikan barang dikembalikan dalam kondisi baik.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Form Booking</h2>
            <form onSubmit={handleBooking} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Fasilitas / Barang</label>
                <select required className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-900" value={barang} onChange={(e) => setBarang(e.target.value)}>
                  <option value="" disabled>-- Pilih Barang --</option>
                  {masterBarang.map(b => (
                    <option key={b.id} value={b.nama_barang}>{b.nama_barang}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Tanggal Pemakaian</label>
                <input type="date" required min={new Date().toISOString().split('T')[0]} className="w-full border border-slate-300 rounded-lg p-2 text-slate-900" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Keperluan</label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2 text-slate-900" placeholder="Cth: Acara syukuran keluarga" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>
              <button type="submit" disabled={submitLoading} className="w-full bg-amber-600 text-white font-bold rounded-lg p-3 shadow hover:bg-amber-700 transition-colors">
                {submitLoading ? "Mengecek Ketersediaan..." : "Ajukan Booking"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Riwayat Booking Saya</h2>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {riwayat.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Belum ada riwayat peminjaman.</p>
              ) : (
                riwayat.map(t => (
                  <div key={t.id} className="p-4 border rounded-lg bg-slate-50">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-slate-800 text-sm">{t.nama_barang}</h3>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded ${getStatusColor(t.status)}`}>
                        {t.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 mb-1">📅 {new Date(t.tanggal_pinjam).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    <div className="text-xs text-slate-500 italic">"{t.keterangan}"</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}