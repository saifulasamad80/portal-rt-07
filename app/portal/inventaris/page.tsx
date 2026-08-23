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

  const [barangId, setBarangId] = useState("");
  const [jumlah, setJumlah] = useState("1");
  const [tanggal, setTanggal] = useState("");
  const [keterangan, setKeterangan] = useState("");

  useEffect(() => {
    const cekSesiWarga = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      const { data: profilWarga } = await supabase
        .from("warga")
        .select("*")
        .eq("auth_email", session.user.email)
        .single();

      if (profilWarga) {
        setWarga(profilWarga);
        fetchData(profilWarga.id);
      } else {
        router.push("/login");
      }
    };
    cekSesiWarga();
  }, [router]);

  const fetchData = async (idWarga: string) => {
    setLoading(true);
    const { data: dataRiwayat } = await supabase
      .from("peminjaman_inventaris")
      .select("*, master_inventaris(nama_barang)")
      .eq("warga_id", idWarga)
      .order("tanggal_pinjam", { ascending: true });
    
    // FAKTA: Tarik dari tabel master_inventaris asli
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

    if (!barangId) {
      alert("Pilih barang terlebih dahulu!");
      setSubmitLoading(false);
      return;
    }

    const qty = parseInt(jumlah);
    if (qty < 1) {
      alert("Jumlah pinjam minimal 1!");
      setSubmitLoading(false);
      return;
    }

    // FAKTA: Cek batas stok dengan kolom total_unit
    const barangTerpilih = masterBarang.find(b => b.id === barangId);
    if (barangTerpilih && qty > barangTerpilih.total_unit) {
      alert(`DITOLAK: Total kapasitas ${barangTerpilih.nama_barang} di RT hanya ${barangTerpilih.total_unit} unit.`);
      setSubmitLoading(false);
      return;
    }

    const { data: cekBentrok } = await supabase
      .from("peminjaman_inventaris")
      .select("id")
      .eq("barang_id", barangId)
      .eq("tanggal_pinjam", tanggal)
      .in("status", ["Menunggu", "Disetujui"]);

    if (cekBentrok && cekBentrok.length > 0) {
      alert(`PERINGATAN: Barang ini sudah ada yang mengajukan booking pada tanggal tersebut. Silakan konfirmasi ke RT apakah stok masih mencukupi.`);
    }

    const { error } = await supabase.from("peminjaman_inventaris").insert([{
      warga_id: warga.id,
      barang_id: barangId, 
      jumlah_pinjam: qty, 
      tanggal_pinjam: tanggal,
      keterangan: keterangan
    }]);

    if (error) {
      alert("Gagal melakukan booking: " + error.message);
    } else {
      alert("Booking berhasil diajukan! Menunggu persetujuan RT.");
      setBarangId(""); setJumlah("1"); setTanggal(""); setKeterangan("");
      fetchData(warga.id);
    }
    setSubmitLoading(false);
  };

  const getStatusColor = (status: string) => {
    if (status === 'Disetujui') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'Ditolak') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (status === 'Dikembalikan') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-amber-100 text-amber-700 border-amber-200'; 
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-500">Membuka kalender inventaris...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/portal" className="text-amber-700 font-bold hover:underline mb-4 inline-block">&larr; Kembali ke Dasbor</Link>
        <div className="bg-white p-6 rounded-xl shadow border-l-8 border-amber-600">
          <h1 className="text-2xl font-bold text-slate-800">Kalender Inventaris RT</h1>
          <p className="text-slate-500 text-sm">Booking fasilitas RT. Pengajuan akan direview oleh pengurus.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-white p-6 rounded-xl shadow h-fit">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Form Booking</h2>
            <form onSubmit={handleBooking} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Fasilitas / Barang</label>
                <select required className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 font-medium" value={barangId} onChange={(e) => setBarangId(e.target.value)}>
                  <option value="" disabled>-- Daftar Barang Tersedia --</option>
                  {masterBarang.map(b => (
                    <option key={b.id} value={b.id}>{b.nama_barang} (Total: {b.total_unit} unit)</option>
                  ))}
                </select>
                {masterBarang.length === 0 && <div className="text-xs text-rose-500 mt-1 font-bold">Tidak ada barang yang tersedia saat ini.</div>}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Jumlah Unit</label>
                  <input type="number" required min="1" className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900" value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tanggal Pakai</label>
                  <input type="date" required min={new Date().toISOString().split('T')[0]} className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Keperluan</label>
                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900" placeholder="Cth: Acara syukuran keluarga" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>
              <button type="submit" disabled={submitLoading || masterBarang.length === 0} className="w-full bg-amber-600 text-white font-bold rounded-lg p-3 shadow-md hover:bg-amber-700 transition-colors disabled:bg-slate-400 mt-2">
                {submitLoading ? "Mengajukan..." : "Ajukan Booking"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Riwayat Booking Saya</h2>
            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
              {riwayat.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Belum ada riwayat peminjaman.</p>
              ) : (
                riwayat.map(t => (
                  <div key={t.id} className={`p-4 border rounded-lg ${getStatusColor(t.status)}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-slate-800">
                        {t.master_inventaris?.nama_barang || t.nama_barang || "Barang Tidak Diketahui"}
                      </h3>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded bg-white/60">
                        {t.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-700 bg-white/50 inline-block px-2 py-1 rounded">
                      <span>📦 {t.jumlah_pinjam || 1} Unit</span>
                      <span className="text-slate-400">|</span>
                      <span>📅 {new Date(t.tanggal_pinjam).toLocaleDateString('id-ID')}</span>
                    </div>

                    <div className="text-sm text-slate-600 italic border-t border-black/10 pt-2 mt-1">"{t.keterangan}"</div>
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