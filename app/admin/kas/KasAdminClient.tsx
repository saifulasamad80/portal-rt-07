"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function KasAdminClient({ adminAktif, transaksiList, wargaList, aksiSimpan }: { adminAktif: any, transaksiList: any[], wargaList: any[], aksiSimpan: any }) {
  const router = useRouter();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false); // State khusus untuk tombol PDF

  const [wargaId, setWargaId] = useState("");
  const [tipe, setTipe] = useState("Pemasukan");
  const [kategori, setKategori] = useState("Iuran Wajib Bulanan");
  const [nominal, setNominal] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const totalPemasukan = transaksiList.filter(t => t.tipe_transaksi === "Pemasukan").reduce((sum, t) => sum + t.nominal, 0);
  const totalPengeluaran = transaksiList.filter(t => t.tipe_transaksi === "Pengeluaran").reduce((sum, t) => sum + t.nominal, 0);
  const saldoAkhir = totalPemasukan - totalPengeluaran;

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    const uang = parseInt(nominal);

    try {
      const res = await aksiSimpan(tipe, wargaId, kategori, uang, keterangan);
      if (res && !res.success) {
        alert("Gagal menyimpan transaksi: " + res.message);
      } else {
        setNominal(""); 
        setKeterangan("");
        router.refresh();
      }
    } catch (error: any) {
      alert("Terjadi kesalahan sistem: " + error.message);
    }
    setSubmitLoading(false);
  };

  // INJEKSI MUTLAK: Logika Export PDF Kinerja Tinggi
  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      // Dynamic import agar website tidak lambat saat pertama kali dibuka
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();
      
      // Kop Surat & Judul
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("LAPORAN KAS & KEUANGAN RT 07", 14, 20);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Dicetak oleh: ${adminAktif.nama} (${adminAktif.email})`, 14, 27);
      doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 32);

      // Pembuatan Tabel Data
      const tableData = transaksiList.map(t => [
        new Date(t.created_at).toLocaleDateString('id-ID'),
        t.tipe_transaksi,
        t.kategori,
        t.warga?.nama_lengkap || "-",
        `Rp ${t.nominal.toLocaleString('id-ID')}`
      ]);

      autoTable(doc, {
        startY: 40,
        head: [['Tanggal', 'Tipe', 'Kategori', 'Sumber Dana', 'Nominal']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] }, // slate-800
        styles: { fontSize: 8 },
      });

      // Rekapitulasi Akhir
      const finalY = (doc as any).lastAutoTable.finalY || 40;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Total Pemasukan: Rp ${totalPemasukan.toLocaleString('id-ID')}`, 14, finalY + 10);
      doc.text(`Total Pengeluaran: Rp ${totalPengeluaran.toLocaleString('id-ID')}`, 14, finalY + 16);
      doc.text(`SALDO AKHIR: Rp ${saldoAkhir.toLocaleString('id-ID')}`, 14, finalY + 24);

      // Injeksi Stempel Otomatis (Anti repot gambar eksternal)
      doc.setTextColor(220, 38, 38); 
      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(0.5);
      doc.circle(160, finalY + 20, 16); // Lingkaran luar
      doc.circle(160, finalY + 20, 15); // Lingkaran dalam
      doc.setFontSize(9);
      doc.text("SAH & TERVERIFIKASI", 160, finalY + 18, { align: "center" });
      doc.text("PENGURUS RT 07", 160, finalY + 23, { align: "center" });

      // Eksekusi Unduhan
      doc.save(`Laporan_Kas_RT07_${Date.now()}.pdf`);
    } catch (error) {
      alert("Gagal merakit PDF. Pastikan internet stabil.");
    }
    setPdfLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-blue-600 font-bold text-sm hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        {/* HEADER */}
        <div className="bg-slate-800 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-blue-500 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Manajemen Kas RT</h1>
            <p className="text-slate-300 text-sm">Rekapitulasi iuran warga dan biaya operasional lingkungan.</p>
          </div>
          {/* TOMBOL EXPORT PDF DENGAN LOADING STATE */}
          <button 
            onClick={handleExportPDF} 
            disabled={pdfLoading || transaksiList.length === 0}
            className={`hidden md:flex items-center gap-2 px-5 py-3 rounded-lg font-black text-sm shadow-md transition-all ${pdfLoading ? 'bg-slate-600 text-slate-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}
          >
            {pdfLoading ? "Merakit PDF..." : "📄 Cetak Laporan PDF"}
          </button>
        </div>

        {/* Tombol PDF versi Mobile (Tampil jika layar kecil) */}
        <button 
            onClick={handleExportPDF} 
            disabled={pdfLoading || transaksiList.length === 0}
            className={`w-full md:hidden flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-black text-sm shadow-md transition-all ${pdfLoading ? 'bg-slate-600 text-slate-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}
          >
            {pdfLoading ? "Merakit PDF..." : "📄 Cetak Laporan PDF"}
        </button>

        {/* WIDGET SALDO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-emerald-500">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Pemasukan</h3>
            <div className="text-2xl md:text-3xl font-black text-emerald-600 mt-2">Rp {totalPemasukan.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-rose-500">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Pengeluaran</h3>
            <div className="text-2xl md:text-3xl font-black text-rose-600 mt-2">Rp {totalPengeluaran.toLocaleString('id-ID')}</div>
          </div>
          <div className="bg-blue-600 p-5 md:p-6 rounded-2xl shadow-lg text-white">
            <h3 className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Saldo Akhir Kas</h3>
            <div className="text-3xl md:text-4xl font-black mt-2">Rp {saldoAkhir.toLocaleString('id-ID')}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
          
          {/* FORM TRANSAKSI */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit border-t-[6px] border-t-slate-800">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">✍️ Catat Transaksi</h2>
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Tipe Transaksi</label>
                <select className="w-full border-2 border-slate-200 rounded-lg p-3 font-bold outline-none focus:border-blue-500" value={tipe} onChange={(e) => setTipe(e.target.value)}>
                  <option value="Pemasukan" className="text-emerald-600">Pemasukan (+)</option>
                  <option value="Pengeluaran" className="text-rose-600">Pengeluaran (-)</option>
                </select>
              </div>
              
              {tipe === "Pemasukan" && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Sumber Dana (Warga)</label>
                  <select className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-blue-500 text-sm" value={wargaId} onChange={(e) => setWargaId(e.target.value)}>
                    <option value="">-- Pemasukan Umum / Eksternal --</option>
                    {wargaList.map(w => <option key={w.id} value={w.id}>{w.nama_lengkap}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Kategori / Judul</label>
                <input type="text" required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-blue-500 text-sm" placeholder="Cth: Iuran Sampah / Perbaikan Lampu" value={kategori} onChange={(e) => setKategori(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Nominal (Rp)</label>
                <input type="number" required min="100" className="w-full border-2 border-slate-200 rounded-lg p-3 font-mono font-black text-lg text-blue-700 outline-none focus:border-blue-500" placeholder="50000" value={nominal} onChange={(e) => setNominal(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Keterangan (Opsional)</label>
                <input type="text" className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm outline-none focus:border-blue-500" placeholder="Catatan tambahan..." value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>
              
              {/* TOMBOL SIMPAN DENGAN LOADING STATE */}
              <button type="submit" disabled={submitLoading} className={`w-full text-white font-black rounded-lg p-3.5 shadow-md mt-4 transition-colors ${submitLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {submitLoading ? "Mencatat..." : "Simpan ke Buku Kas"}
              </button>
            </form>
          </div>

          {/* TABEL BUKU BESAR */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">📒 Buku Besar Transaksi</h2>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-800 text-white text-xs">
                  <tr>
                    <th className="p-4 border-b-2 border-slate-900">Tanggal & Kategori</th>
                    <th className="p-4 border-b-2 border-slate-900">Detail Sumber/Keterangan</th>
                    <th className="p-4 border-b-2 border-slate-900 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {transaksiList.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-slate-400 font-bold italic">Belum ada transaksi tercatat.</td></tr>
                  ) : (
                    transaksiList.map((t) => (
                      <tr key={t.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                        <td className="p-4 align-top">
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{new Date(t.created_at).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}</div>
                          <div className={`font-black mt-1.5 text-xs px-2 py-1 inline-block rounded-md ${t.tipe_transaksi === 'Pemasukan' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {t.kategori}
                          </div>
                        </td>
                        <td className="p-4 align-top">
                          {t.warga_id && <div className="font-black text-slate-800 mb-1">{t.warga?.nama_lengkap}</div>}
                          <div className="text-slate-500 text-xs">{t.keterangan || <span className="italic opacity-50">Tanpa keterangan</span>}</div>
                        </td>
                        <td className={`p-4 align-top text-right font-mono font-black text-sm md:text-base ${t.tipe_transaksi === 'Pemasukan' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.tipe_transaksi === 'Pemasukan' ? '+' : '-'} Rp {t.nominal.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}