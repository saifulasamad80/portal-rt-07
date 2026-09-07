"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { posisiAkhirTabelPdf } from "@/lib/pdf-autotable";

const FITUR_KTP_AKTIF = false;

type Notifikasi = { tipe: "sukses" | "gagal"; pesan: string } | null;

export default function WargaAdminClient({ wargaList, aksiHapus, aksiUbahStatus, aksiImportMassal, aksiResetPin }: { wargaList: any[], aksiHapus: any, aksiUbahStatus: any, aksiImportMassal: any, aksiResetPin: any }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notifikasi, setNotifikasi] = useState<Notifikasi>(null);

  const daftarAman = Array.isArray(wargaList) ? wargaList : [];

  // Pencarian defensif: baris hasil arsip pemilu bisa memiliki nama atau NIK
  // bernilai null, dan memanggil .toLowerCase() di atasnya akan mematikan
  // seluruh halaman.
  const kunciCari = search.trim().toLowerCase();
  const filteredWarga = daftarAman.filter((w) => {
    if (!kunciCari) return true;
    const nama = String(w?.nama_lengkap || "").toLowerCase();
    const nik = String(w?.nik || "");
    return nama.includes(kunciCari) || nik.includes(kunciCari);
  });

  const formatWA = (nomor: string) => {
    if (!nomor) return "";
    let bersih = nomor.replace(/\D/g, '');
    if (bersih.startsWith('0')) bersih = '62' + bersih.slice(1);
    return bersih;
  };

  // Data yang diarsipkan diisi tanda "-" pada kolom NOT NULL, dan pendaftaran
  // lama memakai penanda "MENYUSUL". Keduanya harus dibaca sebagai KOSONG,
  // supaya tidak merender tautan wa.me atau tautan dokumen yang rusak.
  const nilaiKosong = (nilai: unknown) => {
    const teks = String(nilai ?? "").trim();
    return teks === "" || teks === "-" || teks === "MENYUSUL";
  };

  const adaWhatsApp = (nomor: unknown) => !nilaiKosong(nomor) && formatWA(String(nomor)).length >= 8;

  const laporkan = (tipe: "sukses" | "gagal", pesan: string) => setNotifikasi({ tipe, pesan });

  /**
   * Menghapus / menonaktifkan warga.
   *
   * Jalur utama adalah API route. Server Action hanya dipakai sebagai cadangan
   * ketika API tidak dapat dihubungi atau membalas respons yang bukan JSON
   * (mis. halaman error Vercel). Bila API sudah membalas Result Object yang
   * sah, jawabannya dipercaya apa adanya supaya perintah hapus tidak
   * dieksekusi dua kali.
   */
  const handleHapus = async (id: string, nama: string) => {
    const namaTampil = nama || "warga ini";
    if (!confirm(`Hapus data ${namaTampil} dari buku induk?\n\nJika warga ini sudah memilih di e-voting, data suara tidak akan dihapus. Akun akan dinonaktifkan dan data personal dilepas.`)) return;

    setLoadingId(id);
    setNotifikasi(null);

    const jalankanCadangan = async (alasan: string) => {
      try {
        const cadangan = await aksiHapus(id);
        if (cadangan?.success) {
          laporkan("sukses", cadangan.message || "Perintah hapus selesai diproses.");
          router.refresh();
        } else {
          laporkan("gagal", cadangan?.message || alasan);
          router.refresh();
        }
      } catch (err: any) {
        laporkan("gagal", `${alasan} Cadangan Server Action juga gagal: ${err?.message || "kesalahan tidak diketahui"}`);
      }
    };

    try {
      const api = await fetch("/api/admin/warga", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const res = await api.json().catch(() => null);

      if (res && typeof res.success === "boolean") {
        if (res.success) {
          laporkan("sukses", res.message || "Perintah hapus selesai diproses.");
        } else if (api.status === 401) {
          laporkan("gagal", res.message || "Sesi pengurus sudah berakhir. Silakan masuk kembali.");
        } else {
          laporkan("gagal", res.message || "Perintah hapus ditolak server tanpa keterangan.");
        }
        // Selalu segarkan: data di layar bisa saja sudah usang.
        router.refresh();
      } else {
        await jalankanCadangan(`Server membalas respons tidak terbaca (HTTP ${api.status}).`);
      }
    } catch (error: any) {
      await jalankanCadangan(`Tidak dapat menghubungi API (${error?.message || "jaringan terputus"}).`);
    }

    setLoadingId("");
  };

  const handleUbahStatus = async (id: string, nama: string, statusBaru: string) => {
    const namaTampil = nama || "warga ini";
    const pesan = statusBaru === "Menunggu" ? `PERINGATAN: Cabut akses login ${namaTampil}?` : `Berikan akses login SAH kepada ${namaTampil}?`;
    if (!confirm(pesan)) return;

    setLoadingId(id);
    setNotifikasi(null);
    try {
      const res = await aksiUbahStatus(id, statusBaru);
      if (res?.success) {
        laporkan("sukses", res.message || `Status ${namaTampil} berhasil diubah.`);
      } else {
        laporkan("gagal", res?.message || "Status gagal diubah tanpa keterangan dari server.");
      }
      router.refresh();
    } catch (error: any) {
      laporkan("gagal", "Sistem Error: " + (error?.message || "kesalahan tidak diketahui"));
    }
    setLoadingId("");
  };

  const handleResetPin = async (id: string, nama: string) => {
    const namaTampil = nama || "warga ini";
    if (!confirm(`🔑 RESET PIN\n\nAnda akan mereset sandi milik ${namaTampil} ke (123456). Lanjutkan?`)) return;

    setLoadingId(id);
    setNotifikasi(null);
    try {
      const res = await aksiResetPin(id, "123456");
      if (res?.success) {
        laporkan("sukses", res.message || `PIN ${namaTampil} direset ke 123456.`);
        router.refresh();
      } else {
        laporkan("gagal", res?.message || "PIN gagal direset tanpa keterangan dari server.");
      }
    } catch (error: any) {
      laporkan("gagal", "Sistem Error: " + (error?.message || "kesalahan tidak diketahui"));
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
        index + 1,
        w.nama_lengkap || "-",
        w.nik || "-",
        w.no_whatsapp || "-",
        w.status_tinggal || "-",
        w.detail_alamat || "-",
        w.anggota_keluarga ? w.anggota_keluarga.length : 0
      ]);

      autoTable(doc, {
        startY: 40, head: [['No', 'Nama Kepala Keluarga', 'NIK', 'WhatsApp', 'Status', 'Alamat', 'Jml Tanggungan']],
        body: tableData, theme: 'grid', headStyles: { fillColor: [30, 41, 59] }, styles: { fontSize: 8 }, columnStyles: { 0: { cellWidth: 10 }, 2: { font: "courier" } }
      });

      const finalY = posisiAkhirTabelPdf(doc);
      doc.setTextColor(220, 38, 38); doc.setDrawColor(220, 38, 38); doc.setLineWidth(0.5);
      doc.circle(250, finalY + 25, 16); doc.circle(250, finalY + 25, 15); doc.setFontSize(9);
      doc.text("SAH & TERVERIFIKASI", 250, finalY + 23, { align: "center" }); doc.text("PENGURUS RT 07", 250, finalY + 28, { align: "center" });
      doc.save(`Buku_Induk_RT07_${Date.now()}.pdf`);
    } catch (error) { laporkan("gagal", "Gagal merakit PDF. Pastikan internet stabil."); }
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
    if (!confirm(`Impor data dari file "${file.name}"?`)) { e.target.value = ''; return; }

    setIsUploading(true);
    setNotifikasi(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = (text || "").split("\n").filter(row => row.trim() !== "");
      if (rows.length < 2) { laporkan("gagal", "File CSV kosong atau hanya berisi baris judul."); setIsUploading(false); return; }

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
        if (res?.success) {
          const berhasil = res.hasil?.berhasil ?? 0;
          const gagal = res.hasil?.gagal ?? 0;
          laporkan("sukses", `🏁 IMPORT SELESAI! Sukses: ${berhasil} Warga. Gagal/Duplikat: ${gagal} baris.`);
          router.refresh();
        } else {
          laporkan("gagal", res?.message || "Impor gagal tanpa keterangan dari server.");
        }
      } catch (error: any) {
        laporkan("gagal", "Sistem Error: " + (error?.message || "kesalahan tidak diketahui"));
      }
      setIsUploading(false);
    };
    reader.onerror = () => { laporkan("gagal", "Gagal membaca file CSV dari perangkat Anda."); setIsUploading(false); };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const totalKK = filteredWarga.length;
  const totalAnggota = filteredWarga.reduce((sum, w) => sum + (w.anggota_keluarga ? w.anggota_keluarga.length : 0), 0);
  const totalJiwa = totalKK + totalAnggota;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <Link href="/admin" className="text-blue-600 font-bold text-sm hover:underline mb-2 inline-block">&larr; Kembali ke Pusat Komando</Link>
        <div className="bg-slate-900 p-6 md:p-8 rounded-2xl shadow-lg border-l-[12px] border-blue-500 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-1">Buku Induk Warga</h1>
            <p className="text-slate-400 text-sm">Hanya warga dengan status validasi Disetujui. Pendaftar baru ada di antrean verifikasi.</p>
            <Link href="/admin/verifikasi" className="inline-block mt-3 text-[11px] font-bold uppercase tracking-widest text-amber-300 hover:text-amber-200">
              Buka antrean verifikasi →
            </Link>
          </div>
          <div className="text-5xl hidden md:block grayscale brightness-200">👥</div>
        </div>

        {notifikasi && (
          <div className={`rounded-xl border p-4 flex items-start justify-between gap-4 shadow-sm ${notifikasi.tipe === 'sukses' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            <div className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">{notifikasi.tipe === 'sukses' ? '✅' : '⚠️'}</span>
              <p className="text-xs font-bold leading-relaxed">{notifikasi.pesan}</p>
            </div>
            <button onClick={() => setNotifikasi(null)} className="text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 shrink-0">Tutup</button>
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 border-t-[6px] border-t-blue-500">
          
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-6 border-b border-slate-200 pb-6">
            <div>
              <h2 className="font-black text-xl text-slate-800 mb-3">Daftar Warga Terdaftar</h2>
              <div className="flex gap-2">
                <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border border-blue-200 shadow-sm">
                  {totalKK} KK
                </span>
                <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border border-emerald-200 shadow-sm">
                  + {totalAnggota} Tanggungan
                </span>
                <span className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest shadow-md">
                  = {totalJiwa} TOTAL JIWA
                </span>
              </div>
            </div>

            <div className="w-full xl:w-auto flex flex-col sm:flex-row flex-wrap gap-2">
              <input type="text" placeholder="🔍 Cari Nama atau NIK..." className="flex-1 sm:flex-none sm:w-64 border-2 border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-blue-500 bg-slate-50" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button onClick={downloadTemplateCSV} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-95">📥 Template CSV</button>
              <label className={`cursor-pointer px-4 py-2.5 rounded-lg font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 ${isUploading ? 'bg-slate-300 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                {isUploading ? "Memproses..." : "🚀 Upload CSV"}
              </label>
              <button onClick={handleExportPDF} disabled={pdfLoading || filteredWarga.length === 0} className={`px-4 py-2.5 rounded-lg font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 ${pdfLoading ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
                {pdfLoading ? "Merakit PDF..." : "📄 Cetak PDF"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[700px] overflow-y-auto custom-scrollbar rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 text-xs">
                <tr>
                  <th className="p-4 border-b-2 border-slate-200 whitespace-nowrap min-w-[200px]">Data Utama KK</th>
                  <th className="p-4 border-b-2 border-slate-200 min-w-[200px]">Alamat Domisili</th>
                  <th className="p-4 border-b-2 border-slate-200 min-w-[350px]">Struktur Keluarga (Daftar Jiwa)</th>
                  <th className="p-4 border-b-2 border-slate-200 text-center min-w-[150px]">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarga.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold italic">Tidak ada data warga ditemukan.</td></tr>
                ) : (
                  filteredWarga.map((w) => {
                    const totalJiwaDalamKK = 1 + (w.anggota_keluarga ? w.anggota_keluarga.length : 0);
                    const namaKK = w.nama_lengkap || "Tanpa Nama";
                    
                    return (
                    <tr key={w.id} className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 align-top border-r border-slate-100">
                        <div className="font-black text-slate-800 text-base mb-2">{namaKK}</div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-sm ${w.status_aktif === false ? 'bg-slate-200 text-slate-600' : w.status_verifikasi === 'Disetujui' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {w.status_aktif === false ? 'ARSIP PEMILU' : w.status_verifikasi === 'Disetujui' ? 'SAH' : 'DIBLOKIR'}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 px-2 py-1 rounded shadow-sm">
                              {w.status_tinggal || 'Tidak diisi'}
                            </span>
                          </div>
                          
                          {adaWhatsApp(w.no_whatsapp) ? (
                            <a href={`https://wa.me/${formatWA(w.no_whatsapp)}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md transition-colors inline-flex items-center gap-1 border border-emerald-200 w-fit">
                              💬 {w.no_whatsapp}
                            </a>
                          ) : (
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200 w-fit">WA: Kosong</span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5 pt-3 border-t border-slate-100">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Dokumen Verifikasi</span>
                          {FITUR_KTP_AKTIF && (
                            !nilaiKosong(w.ktp_path) ? (
                              <a href={`/api/admin/dokumen?path=${w.ktp_path}`} target="_blank" className="text-[10px] bg-slate-800 text-white px-3 py-1.5 rounded font-bold hover:bg-slate-700 transition-colors shadow-sm text-center">📄 Cek KTP</a>
                            ) : (
                              <span className="text-[10px] bg-rose-50 text-rose-500 px-3 py-1.5 rounded font-bold border border-rose-100 text-center">KTP Kosong</span>
                            )
                          )}
                          {!nilaiKosong(w.kk_path) ? (
                            <a href={`/api/admin/dokumen?path=${w.kk_path}`} target="_blank" className="text-[10px] bg-slate-800 text-white px-3 py-1.5 rounded font-bold hover:bg-slate-700 transition-colors shadow-sm text-center">📄 Cek Kartu Keluarga</a>
                          ) : (
                            <span className="text-[10px] bg-rose-50 text-rose-500 px-3 py-1.5 rounded font-bold border border-rose-100 text-center">KK Kosong</span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 align-top border-r border-slate-100">
                        <div className="text-xs text-slate-600 leading-relaxed">{w.detail_alamat || <span className="italic text-slate-400">Alamat tidak rinci</span>}</div>
                      </td>

                      <td className="p-4 align-top border-r border-slate-100 bg-white">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-200 pb-1">Daftar Individu</span>
                          <span className="text-[10px] bg-slate-800 text-white font-black px-2 py-0.5 rounded shadow-sm">{totalJiwaDalamKK} Jiwa</span>
                        </div>

                        <div className="flex flex-col gap-2 relative z-0">
                          <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg shadow-sm relative z-10">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-black text-blue-900 text-xs">{namaKK}</span>
                              <span className="text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shadow-sm">Kepala Keluarga</span>
                            </div>
                            <div className="font-mono text-[10px] text-blue-700 font-bold bg-white px-1.5 py-0.5 rounded border border-blue-100 w-fit">
                              NIK: {w.nik ? `${String(w.nik).slice(0, 4)}********${String(w.nik).slice(-4)}` : '-'}
                            </div>
                          </div>

                          {w.anggota_keluarga && w.anggota_keluarga.length > 0 ? (
                            w.anggota_keluarga.map((ak: any, idx: number) => {
                              const isLast = idx === w.anggota_keluarga.length - 1;
                              return (
                                <div key={ak.id || idx} className="relative ml-5 z-10">
                                  <div className={`absolute -left-3 border-l-2 border-slate-300 ${isLast ? 'h-[18px] top-0' : 'h-full top-0'}`}></div>
                                  <div className="absolute -left-3 top-[16px] w-3 border-t-2 border-slate-300"></div>
                                  
                                  <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg shadow-sm hover:border-blue-300 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                      <span className="font-bold text-slate-800 text-xs">{ak.nama_lengkap || 'Tanpa Nama'}</span>
                                      <span className="text-[8px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{ak.hubungan_keluarga || '-'}</span>
                                    </div>
                                    <div className="font-mono text-[10px] text-slate-500 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 w-fit">
                                      NIK: {ak.nik ? `${String(ak.nik).slice(0, 4)}********${String(ak.nik).slice(-4)}` : <span className="text-rose-400 italic">Belum diisi</span>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-[10px] italic text-slate-400 font-bold mt-2 ml-1">Tidak ada tanggungan tambahan.</div>
                          )}
                        </div>
                      </td>

                      <td className="p-4 align-top text-center bg-slate-50/50">
                        <Link href={`/admin/warga/${w.id}`} className="bg-white hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-600 text-[10px] font-black px-4 py-2.5 rounded-lg transition-all shadow-sm uppercase tracking-wider w-full mb-2 inline-flex justify-center items-center gap-1 active:scale-95"><span>🔍</span> Buka Profil</Link>
                        
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <button onClick={() => handleResetPin(w.id, namaKK)} disabled={loadingId === w.id} className="bg-slate-800 hover:bg-slate-700 text-white text-[9px] font-black px-2 py-2.5 rounded-lg transition-all shadow-sm disabled:opacity-50 uppercase tracking-wider flex items-center justify-center gap-1 active:scale-95"><span>🔑</span> Reset PIN</button>
                          {w.status_verifikasi === 'Disetujui' ? (
                            <button onClick={() => handleUbahStatus(w.id, namaKK, 'Menunggu')} disabled={loadingId === w.id} className="bg-amber-100 hover:bg-amber-500 text-amber-700 hover:text-white border border-amber-200 text-[9px] font-black px-2 py-2.5 rounded-lg transition-all shadow-sm disabled:opacity-50 uppercase tracking-wider flex items-center justify-center active:scale-95">Cabut Sah</button>
                          ) : (
                            <button onClick={() => handleUbahStatus(w.id, namaKK, 'Disetujui')} disabled={loadingId === w.id} className="bg-emerald-100 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 text-[9px] font-black px-2 py-2.5 rounded-lg transition-all shadow-sm disabled:opacity-50 uppercase tracking-wider flex items-center justify-center active:scale-95">Setujui</button>
                          )}
                        </div>

                        <button onClick={() => handleHapus(w.id, namaKK)} disabled={loadingId === w.id || w.status_aktif === false} className="bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 text-[9px] font-black px-4 py-2.5 rounded-lg transition-all shadow-sm disabled:opacity-50 uppercase tracking-wider w-full flex items-center justify-center gap-1 active:scale-95"><span>🗑️</span> {w.status_aktif === false ? "Sudah Diarsipkan" : loadingId === w.id ? "Memproses..." : "Hapus / Nonaktifkan"}</button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
