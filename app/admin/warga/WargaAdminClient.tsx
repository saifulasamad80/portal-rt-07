"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const FITUR_KTP_AKTIF = false;

export default function WargaAdminClient({ wargaList, aksiHapus, aksiUbahStatus, aksiImportMassal, aksiResetPin }: { wargaList: any[], aksiHapus: any, aksiUbahStatus: any, aksiImportMassal: any, aksiResetPin: any }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const filteredWarga = wargaList.filter(w => 
    w.nama_lengkap.toLowerCase().includes(search.toLowerCase()) || 
    w.nik.includes(search)
  );

  const handleHapus = async (id: string, nama: string) => {
    if (!confirm(`PERINGATAN FATAL: Menghapus data ${nama} akan menghapus SEMUA data kas, sampah, laporan, dan siskamling yang terkait dengan warga ini (Cascade Delete). YAKIN?`)) return;
    
    setLoadingId(id);
    try {
      await aksiHapus(id);
      router.refresh();
    } catch (error: any) { alert("Gagal menghapus warga: " + error.message); }
    setLoadingId("");
  };

  const handleUbahStatus = async (id: string, nama: string, statusBaru: string) => {
    const pesan = statusBaru === "Menunggu" 
      ? `PERINGATAN: Anda akan MENCABUT akses login ${nama}. Mereka tidak akan bisa masuk ke portal sampai disetujui kembali. Yakin?`
      : `Anda akan memberikan AKSES LOGIN SAH kepada ${nama}. Yakin?`;

    if (!confirm(pesan)) return;
    setLoadingId(id);
    try {
      await aksiUbahStatus(id, statusBaru);
      alert(`Status ${nama} berhasil diubah menjadi: ${statusBaru.toUpperCase()}!`);
      router.refresh();
    } catch (error: any) { alert("Gagal mengubah status: " + error.message); }
    setLoadingId("");
  };

  // INJEKSI MUTLAK: Reset PIN 1-Klik (Otomatis ke 123456)
  const handleResetPin = async (id: string, nama: string) => {
    if (!confirm(`🔑 RESET PIN AKSES WARGA\n\nAnda akan mereset sandi milik ${nama} kembali ke PIN Default (123456).\n\nSistem akan secara otomatis MEMAKSA warga tersebut untuk membuat PIN baru pada saat mereka login. Lanjutkan?`)) return;

    setLoadingId(id);
    try {
      await aksiResetPin(id, "123456");
      alert(`Sempurna! PIN untuk ${nama} telah direset ke 123456.\n\nSilakan instruksikan warga tersebut untuk login, sistem akan memandu mereka untuk mengganti PIN.`);
      router.refresh();
    } catch (error: any) {
      alert("Gagal mereset PIN: " + error.message);
    }
    setLoadingId("");
  };

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF("landscape"); 
      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text("BUKU INDUK DEMOGRAFI RT 07", 14, 20);
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 27);
      doc.text(`Total Warga Terdaftar: ${filteredWarga.length} Kepala Keluarga`, 14, 32);

      const tableData = filteredWarga.map((w, index) => [
        index + 1, w.nama_lengkap, w.nik, w.no_whatsapp, w.status_tinggal, w.detail_alamat, w.anggota_keluarga ? w.anggota_keluarga.length : 0
      ]);

      autoTable(doc, {
        startY: 40, head: [['No', 'Nama Kepala Keluarga', 'NIK', 'WhatsApp', 'Status', 'Alamat', 'Jml Tanggungan']],
        body: tableData, theme: 'grid', headStyles: { fillColor: [30, 41, 59] }, styles: { fontSize: 8 }, columnStyles: { 0: { cellWidth: 10 }, 2: { font: "courier" } }
      });

      const finalY = (doc as any).lastAutoTable.finalY || 40;
      doc.setTextColor(220, 38, 38); doc.setDrawColor(220, 38, 38); doc.setLineWidth(0.5);
      doc.circle(250, finalY + 25, 16); doc.circle(250, finalY + 25, 15); doc.setFontSize(9);
      doc.text("SAH & TERVERIFIKASI", 250, finalY + 23, { align: "center" }); doc.text("PENGURUS RT 07", 250, finalY + 28, { align: "center" });
      doc.save(`Buku_Induk_RT07_${Date.now()}.pdf`);
    } catch (error) { alert("Gagal merakit PDF. Pastikan internet stabil."); }
    setPdfLoading(false);
  };

  const downloadTemplateCSV = () => {
    const headers = "nik,nama_lengkap,no_whatsapp,status_tinggal,detail_alamat,tanggal_lahir,tempat_lahir,jenis_kelamin,pekerjaan\n";
    const sample = "3171000000000001,Budi Santoso,081234567890,Warga Tetap,Blok A No 1,1985-08-15,Jakarta,Laki-laki,Karyawan Swasta\n";
    const blob = new Blob([headers + sample], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "Template_Import_Warga_RT07.csv"; a.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Sistem akan mengimpor data dari file "${file.name}". Seluruh warga yang diimpor akan mendapatkan PIN "123456" dan dipaksa ganti PIN saat login. Lanjutkan?`)) {
      e.target.value = ''; return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = text.split("\n").filter(row => row.trim() !== "");
      if (rows.length < 2) {
        alert("File CSV kosong atau tidak memiliki data!");
        setIsUploading(false); return;
      }

      const headers = rows[0].split(",").map(h => h.trim().toLowerCase());
      const dataWarga = [];

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
        const obj: any = {};
        headers.forEach((header, index) => { obj[header] = values[index]; });
        dataWarga.push(obj);
      }

      try {
        const res = await aksiImportMassal(dataWarga);
        alert(`🏁 IMPORT SELESAI!\n\nBerhasil Masuk: ${res.berhasil} Warga\nGagal/Ditolak (Duplikat NIK): ${res.gagal} Baris`);
        router.refresh();
      } catch (error: any) {
        alert("Gagal mengimpor data: " + error.message);
      }
      setIsUploading(false);
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <Link href="/admin" className="text-blue-600 font-bold text-sm hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-blue-500 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Buku Induk Warga</h1>
            <p className="text-slate-400 text-sm">Database demografi, kontak, dan dokumen kependudukan RT 07.</p>
          </div>
          <div className="text-5xl hidden md:block grayscale brightness-200">👥</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-blue-500">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4 border-b border-slate-200 pb-4">
            <h2 className="font-black text-xl text-slate-800 shrink-0">Daftar Warga Terdaftar</h2>
            
            <div className="w-full xl:w-auto flex flex-col sm:flex-row flex-wrap gap-2">
              <input 
                type="text" 
                placeholder="🔍 Cari Nama atau NIK..." 
                className="flex-1 sm:flex-none sm:w-64 border-2 border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-blue-500 bg-slate-50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              
              <button 
                onClick={downloadTemplateCSV}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                📥 Template CSV
              </button>
              
              <label className={`cursor-pointer px-4 py-2.5 rounded-lg font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 ${isUploading ? 'bg-slate-300 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                {isUploading ? "Memproses Data..." : "🚀 Upload CSV"}
              </label>

              <button 
                onClick={handleExportPDF} 
                disabled={pdfLoading || filteredWarga.length === 0}
                className={`px-4 py-2.5 rounded-lg font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 ${pdfLoading ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}
              >
                {pdfLoading ? "Merakit PDF..." : "📄 Cetak PDF"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[700px] overflow-y-auto custom-scrollbar rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 text-xs">
                <tr>
                  <th className="p-4 border-b-2 border-slate-200 whitespace-nowrap">Nama & Kontak</th>
                  <th className="p-4 border-b-2 border-slate-200">Demografi & Status</th>
                  <th className="p-4 border-b-2 border-slate-200">Anggota Keluarga</th>
                  <th className="p-4 border-b-2 border-slate-200">Dokumen Validasi</th>
                  <th className="p-4 border-b-2 border-slate-200 text-center">Aksi (Bahaya)</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarga.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold italic">Tidak ada data warga ditemukan.</td></tr>
                ) : (
                  filteredWarga.map((w) => (
                    <tr key={w.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                      <td className="p-4 align-top">
                        <div className="font-black text-slate-800 text-base mb-1">{w.nama_lengkap}</div>
                        <div className="text-[10px] text-slate-500 font-mono font-bold bg-slate-200 px-2 py-0.5 rounded w-fit mb-1">NIK: {w.nik}</div>
                        <div className="text-[10px] text-slate-500 font-mono font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded w-fit mb-2">WA: {w.no_whatsapp}</div>
                        
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-sm inline-block ${w.status_verifikasi === 'Disetujui' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          Login: {w.status_verifikasi === 'Disetujui' ? 'SAH' : 'DIBLOKIR'}
                        </span>
                      </td>
                      <td className="p-4 align-top">
                        <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider block w-fit mb-1.5 shadow-sm">
                          {w.status_tinggal}
                        </span>
                        <div className="text-xs text-slate-600 max-w-[200px] leading-relaxed">{w.detail_alamat}</div>
                      </td>
                      <td className="p-4 align-top">
                        {(!w.anggota_keluarga || w.anggota_keluarga.length === 0) ? (
                          <span className="text-xs italic text-slate-400 font-bold">Tidak ada tanggungan</span>
                        ) : (
                          <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                            {w.anggota_keluarga.map((ak: any) => (
                              <li key={ak.id}><b>{ak.nama_lengkap}</b> <span className="text-[10px] text-slate-400">({ak.hubungan_keluarga})</span></li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-col gap-1.5">
                          {FITUR_KTP_AKTIF && (
                            w.ktp_path && w.ktp_path !== 'MENYUSUL' ? (
                              <a href={`/api/admin/dokumen?path=${w.ktp_path}`} target="_blank" className="text-[10px] bg-slate-800 text-white px-3 py-1.5 rounded font-bold hover:bg-slate-700 transition-colors shadow-sm text-center">📄 KTP Warga</a>
                            ) : (
                              <span className="text-[10px] bg-rose-50 text-rose-500 px-3 py-1.5 rounded font-bold border border-rose-100 text-center">KTP Fisik/Menyusul</span>
                            )
                          )}
                          {w.kk_path && w.kk_path !== 'MENYUSUL' ? (
                            <a href={`/api/admin/dokumen?path=${w.kk_path}`} target="_blank" className="text-[10px] bg-slate-800 text-white px-3 py-1.5 rounded font-bold hover:bg-slate-700 transition-colors shadow-sm text-center">📄 Kartu Keluarga</a>
                          ) : (
                            <span className="text-[10px] bg-rose-50 text-rose-500 px-3 py-1.5 rounded font-bold border border-rose-100 text-center">KK Fisik/Menyusul</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-top text-center">
                        <Link href={`/admin/warga/${w.id}`} className="bg-blue-100 hover:bg-blue-500 hover:text-white text-blue-700 border border-blue-200 text-[10px] font-black px-4 py-2 rounded transition-colors shadow-sm uppercase tracking-wider w-full mb-2 inline-block">
                          Detail Warga
                        </Link>
                        
                        <button onClick={() => handleResetPin(w.id, w.nama_lengkap)} disabled={loadingId === w.id} className="bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-700 border border-slate-200 text-[10px] font-black px-4 py-2 rounded transition-colors shadow-sm disabled:opacity-50 uppercase tracking-wider w-full mb-2">
                          {loadingId === w.id ? 'Memproses...' : '🔑 Reset PIN'}
                        </button>
                        
                        {w.status_verifikasi === 'Disetujui' ? (
                          <button onClick={() => handleUbahStatus(w.id, w.nama_lengkap, 'Menunggu')} disabled={loadingId === w.id} className="bg-amber-100 hover:bg-amber-500 hover:text-white text-amber-700 border border-amber-200 text-[10px] font-black px-4 py-2 rounded transition-colors shadow-sm disabled:opacity-50 uppercase tracking-wider w-full mb-2">
                            {loadingId === w.id ? 'Memproses...' : 'Batal Sah (Cabut)'}
                          </button>
                        ) : (
                          <button onClick={() => handleUbahStatus(w.id, w.nama_lengkap, 'Disetujui')} disabled={loadingId === w.id} className="bg-emerald-100 hover:bg-emerald-500 hover:text-white text-emerald-700 border border-emerald-200 text-[10px] font-black px-4 py-2 rounded transition-colors shadow-sm disabled:opacity-50 uppercase tracking-wider w-full mb-2">
                            {loadingId === w.id ? 'Memproses...' : 'Setujui (Sah)'}
                          </button>
                        )}

                        <button onClick={() => handleHapus(w.id, w.nama_lengkap)} disabled={loadingId === w.id} className="bg-rose-100 hover:bg-rose-500 hover:text-white text-rose-600 border border-rose-200 text-[10px] font-black px-4 py-2 rounded transition-colors shadow-sm disabled:opacity-50 uppercase tracking-wider w-full">
                          {loadingId === w.id ? 'Memproses...' : 'Hapus Warga'}
                        </button>
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
  );
}