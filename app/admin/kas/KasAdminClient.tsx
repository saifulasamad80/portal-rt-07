"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function KasAdminClient({ adminAktif, transaksiList, wargaList, aksiSimpan }: { adminAktif: any, transaksiList: any[], wargaList: any[], aksiSimpan: any }) {
  const router = useRouter();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [wargaId, setWargaId] = useState("");
  const [tipe, setTipe] = useState("Pemasukan");
  const [kategori, setKategori] = useState("Iuran Wajib Bulanan");
  const [nominal, setNominal] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const totalPemasukan = transaksiList.filter(t => t.tipe_transaksi === "Pemasukan").reduce((sum, t) => sum + t.nominal, 0);
  const totalPengeluaran = transaksiList.filter(t => t.tipe_transaksi === "Pengeluaran").reduce((sum, t) => sum + t.nominal, 0);
  const saldoAkhir = totalPemasukan - totalPengeluaran;

  const formatWA = (nomor: string) => {
    if (!nomor) return "";
    let bersih = nomor.replace(/\D/g, '');
    if (bersih.startsWith('0')) bersih = '62' + bersih.slice(1);
    return bersih;
  };

  // INJEKSI MUTLAK: MESIN KALKULASI TUNGGAKAN IURAN (HEURISTIC)
  const getBulanTunggakan = (lastDateStr: string | null) => {
    if (!lastDateStr) return { bulan: 3, teks: "Belum Pernah Bayar / > 3 Bulan" };
    const now = new Date();
    const lastDate = new Date(lastDateStr);
    const diffMonths = (now.getFullYear() - lastDate.getFullYear()) * 12 + (now.getMonth() - lastDate.getMonth());
    
    if (diffMonths <= 0) return { bulan: 0, teks: "Aman (Bulan Ini)" };
    if (diffMonths >= 3) return { bulan: 3, teks: "Nunggak 3 Bulan" };
    return { bulan: diffMonths, teks: `Nunggak ${diffMonths} Bulan` };
  };

  const statusTunggakanWarga = wargaList.map(w => {
    // Cari semua transaksi pemasukan warga ini
    const iuranWarga = transaksiList.filter(t => t.warga_id === w.id && t.tipe_transaksi === "Pemasukan");
    // Ambil tanggal terakhir (array sudah terurut descending dari server)
    const lastPayment = iuranWarga.length > 0 ? iuranWarga[0].created_at : null;
    const tunggakan = getBulanTunggakan(lastPayment);
    return { ...w, lastPayment, tunggakan };
  }).sort((a, b) => b.tunggakan.bulan - a.tunggakan.bulan); // Urutkan yang nunggak paling parah di atas

  const wargaNunggak = statusTunggakanWarga.filter(w => w.tunggakan.bulan > 0);

  const handleSimpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    const uang = parseInt(nominal);
    try {
      const res = await aksiSimpan(tipe, wargaId, kategori, uang, keterangan);
      if (res && !res.success) { alert("Gagal: " + res.message); } 
      else { setNominal(""); setKeterangan(""); router.refresh(); }
    } catch (error: any) { alert("Sistem Error: " + error.message); }
    setSubmitLoading(false);
  };

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF();
      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text("LAPORAN KAS & KEUANGAN RT 07", 14, 20);
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(`Dicetak oleh: ${adminAktif.nama}`, 14, 27); doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 32);

      const tableData = transaksiList.map(t => [
        new Date(t.created_at).toLocaleDateString('id-ID'), t.tipe_transaksi, t.kategori, t.warga?.nama_lengkap || "-", `Rp ${t.nominal.toLocaleString('id-ID')}`
      ]);

      autoTable(doc, {
        startY: 40, head: [['Tanggal', 'Tipe', 'Kategori', 'Sumber Dana', 'Nominal']], body: tableData, theme: 'grid', headStyles: { fillColor: [30, 41, 59] }, styles: { fontSize: 8 },
      });

      const finalY = (doc as any).lastAutoTable.finalY || 40;
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(`Total Pemasukan: Rp ${totalPemasukan.toLocaleString('id-ID')}`, 14, finalY + 10); doc.text(`Total Pengeluaran: Rp ${totalPengeluaran.toLocaleString('id-ID')}`, 14, finalY + 16); doc.text(`SALDO AKHIR: Rp ${saldoAkhir.toLocaleString('id-ID')}`, 14, finalY + 24);
      doc.setTextColor(220, 38, 38); doc.setDrawColor(220, 38, 38); doc.setLineWidth(0.5); doc.circle(160, finalY + 20, 16); doc.circle(160, finalY + 20, 15); doc.setFontSize(9);
      doc.text("SAH & TERVERIFIKASI", 160, finalY + 18, { align: "center" }); doc.text("PENGURUS RT 07", 160, finalY + 23, { align: "center" });
      doc.save(`Laporan_Kas_RT07_${Date.now()}.pdf`);
    } catch (error) { alert("Gagal merakit PDF."); }
    setPdfLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans pb-20">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-blue-600 font-bold text-sm hover:underline mb-2 inline-block">&larr; Kembali ke Pusat Komando</Link>

        <div className="bg-slate-800 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-blue-500 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Manajemen Kas RT</h1>
            <p className="text-slate-300 text-sm">Rekapitulasi iuran warga dan biaya operasional lingkungan.</p>
          </div>
          <button onClick={handleExportPDF} disabled={pdfLoading || transaksiList.length === 0} className={`hidden md:flex items-center gap-2 px-5 py-3 rounded-lg font-black text-sm shadow-md transition-all ${pdfLoading ? 'bg-slate-600 text-slate-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
            {pdfLoading ? "Merakit PDF..." : "📄 Cetak Laporan PDF"}
          </button>
        </div>

        <button onClick={handleExportPDF} disabled={pdfLoading || transaksiList.length === 0} className={`w-full md:hidden flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-black text-sm shadow-md transition-all mb-4 ${pdfLoading ? 'bg-slate-600 text-slate-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
            {pdfLoading ? "Merakit PDF..." : "📄 Cetak Laporan PDF"}
        </button>

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
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit border-t-[6px] border-t-slate-800">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">✍️ Catat Transaksi</h2>
            <form onSubmit={handleSimpan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Tipe Transaksi</label>
                <select className="w-full border-2 border-slate-200 rounded-lg p-3 font-bold outline-none focus:border-blue-500" value={tipe} onChange={(e) => setTipe(e.target.value)}>
                  <option value="Pemasukan" className="text-emerald-600">Pemasukan (+)</option><option value="Pengeluaran" className="text-rose-600">Pengeluaran (-)</option>
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

              <div><label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Kategori / Judul</label><input type="text" required className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-blue-500 text-sm" placeholder="Cth: Iuran Sampah / Perbaikan Lampu" value={kategori} onChange={(e) => setKategori(e.target.value)} /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Nominal (Rp)</label><input type="number" required min="100" className="w-full border-2 border-slate-200 rounded-lg p-3 font-mono font-black text-lg text-blue-700 outline-none focus:border-blue-500" placeholder="50000" value={nominal} onChange={(e) => setNominal(e.target.value)} /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Keterangan (Opsional)</label><input type="text" className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm outline-none focus:border-blue-500" placeholder="Catatan tambahan..." value={keterangan} onChange={(e) => setKeterangan(e.target.value)} /></div>
              
              <button type="submit" disabled={submitLoading} className={`w-full text-white font-black rounded-lg p-3.5 shadow-md mt-4 transition-colors ${submitLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {submitLoading ? "Mencatat..." : "Simpan ke Buku Kas"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
            <h2 className="font-black text-lg text-slate-800 mb-6 border-b border-slate-200 pb-3">📒 Buku Besar Transaksi</h2>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-800 text-white text-xs">
                  <tr><th className="p-4 border-b-2 border-slate-900">Tanggal & Kategori</th><th className="p-4 border-b-2 border-slate-900">Detail Sumber/Keterangan</th><th className="p-4 border-b-2 border-slate-900 text-right">Nominal</th></tr>
                </thead>
                <tbody>
                  {transaksiList.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-slate-400 font-bold italic">Belum ada transaksi tercatat.</td></tr>
                  ) : (
                    transaksiList.map((t) => (
                      <tr key={t.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                        <td className="p-4 align-top">
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{new Date(t.created_at).toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}</div>
                          <div className={`font-black mt-1.5 text-xs px-2 py-1 inline-block rounded-md ${t.tipe_transaksi === 'Pemasukan' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{t.kategori}</div>
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

        {/* INJEKSI MUTLAK: RADAR TUNGGAKAN IURAN */}
        <div className="bg-rose-50 p-6 md:p-8 rounded-2xl shadow-sm border border-rose-200 mt-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-rose-200 pb-4 gap-4">
            <div>
              <h2 className="font-black text-xl text-rose-800 flex items-center gap-2">📡 Radar Tunggakan Iuran Warga</h2>
              <p className="text-xs text-rose-600 font-medium mt-1">Estimasi keterlambatan berdasarkan jarak bulan dari pembayaran terakhir.</p>
            </div>
            <div className="bg-white border border-rose-200 px-4 py-2 rounded-lg text-rose-700 text-xs font-black shadow-sm shrink-0">
              Total Nunggak: {wargaNunggak.length} Warga
            </div>
          </div>

          {wargaNunggak.length === 0 ? (
            <div className="text-center p-8 bg-white/60 rounded-xl border border-rose-100">
              <span className="text-4xl mb-3 block">🎉</span>
              <p className="text-emerald-600 font-black">Luar Biasa! Seluruh warga tertib membayar iuran bulan ini.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wargaNunggak.map(w => {
                // Template Pesan WA Otomatis
                const waPesan = encodeURIComponent(`Halo Bapak/Ibu ${w.nama_lengkap},\n\nKami dari Pengurus RT 07 menginformasikan bahwa berdasarkan catatan kas, belum ada pembayaran iuran atas nama Bapak/Ibu untuk *${w.tunggakan.teks}* terakhir.\n\nMohon konfirmasi dan partisipasinya untuk kas lingkungan kita. Terima kasih! 🙏`);
                const waLink = w.no_whatsapp ? `https://wa.me/${formatWA(w.no_whatsapp)}?text=${waPesan}` : '#';

                return (
                  <div key={w.id} className="bg-white p-4 rounded-xl shadow-sm border border-rose-100 flex flex-col justify-between">
                    <div>
                      <h3 className="font-black text-slate-800 text-base">{w.nama_lengkap}</h3>
                      <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-wider">{w.status_tinggal || 'Warga'}</p>
                      
                      <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-100 mb-4">
                        <div className="text-[9px] text-rose-600 font-black uppercase tracking-widest mb-1">Status Keterlambatan:</div>
                        <div className="font-black text-rose-700 text-sm">{w.tunggakan.teks}</div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          Terakhir bayar: {w.lastPayment ? new Date(w.lastPayment).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'}) : 'Tidak ada data'}
                        </div>
                      </div>
                    </div>
                    
                    {w.no_whatsapp ? (
                      <a href={waLink} target="_blank" rel="noopener noreferrer" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-3 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm active:scale-95">
                        <span>💬</span> Tagih via WA
                      </a>
                    ) : (
                      <button disabled className="w-full bg-slate-200 text-slate-400 font-black text-xs py-3 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed">
                        🚫 Nomor WA Kosong
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}