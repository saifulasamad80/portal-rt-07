"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminLaporRT() {
  const [laporan, setLaporan] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminAktif, setAdminAktif] = useState<any>(null);
  const router = useRouter();

  const fetchLaporan = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("laporan_warga")
      .select("*, warga(nama_lengkap, detail_alamat)")
      .order("created_at", { ascending: false });

    if (data) setLaporan(data);
    setLoading(false);
  };

  useEffect(() => {
    const cekSesi = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/admin");
        return;
      }
      
      const { data: profil } = await supabase
        .from("pengurus_rt")
        .select("*")
        .eq("email", session.user.email)
        .single();

      if (profil) {
        setAdminAktif({ id: profil.id, nama: profil.nama_lengkap });
        fetchLaporan();
      }
    };
    cekSesi();
  }, [router]);

  const prosesLaporan = async (id: string, statusBaru: string) => {
    const tanggapan = prompt(`Ubah status menjadi ${statusBaru}. Masukkan tanggapan Anda untuk warga (Opsional):`);
    if (tanggapan === null) return; 

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: `Proses Laporan: ${statusBaru}`,
      tabel_target: "laporan_warga",
      detail: `ID Laporan: ${id} | Tanggapan: ${tanggapan.trim() || 'Tanpa tanggapan'}`
    }]);

    const payload: any = { status: statusBaru };
    if (tanggapan.trim() !== "") payload.tanggapan_rt = tanggapan;

    const { error } = await supabase.from("laporan_warga").update(payload).eq("id", id);
    if (error) alert("Gagal update laporan: " + error.message);
    else fetchLaporan();
  };

  if (!adminAktif) return null;
  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Membuka meja pengaduan...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link href="/admin" className="text-rose-600 font-bold hover:underline mb-2 inline-block">
          &larr; Kembali ke Pusat Komando
        </Link>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-8 border-rose-600">
          <h1 className="text-3xl font-bold text-slate-800">Manajemen Laporan Warga</h1>
          <p className="text-slate-500">Tindak lanjut tiket keluhan infrastruktur & keamanan lingkungan.</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-3 border">Tanggal</th>
                  <th className="p-3 border">Pelapor</th>
                  <th className="p-3 border">Detail Laporan</th>
                  <th className="p-3 border">Status</th>
                  <th className="p-3 border text-center">Tindakan RT</th>
                </tr>
              </thead>
              <tbody>
                {laporan.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-slate-50">
                    <td className="p-3 border text-slate-600">{new Date(t.created_at).toLocaleDateString('id-ID')}</td>
                    <td className="p-3 border">
                      <div className="font-bold text-slate-800">{t.warga?.nama_lengkap}</div>
                      <div className="text-xs text-slate-500">{t.warga?.detail_alamat}</div>
                    </td>
                    <td className="p-3 border">
                      <div className="font-bold text-slate-800">{t.judul_laporan}</div>
                      <div className="text-slate-600 mt-1">{t.deskripsi}</div>
                      {t.tanggapan_rt && (
                        <div className="mt-2 text-xs bg-slate-100 p-2 rounded text-slate-700 italic border-l-2 border-slate-400">
                          Respon RT: {t.tanggapan_rt}
                        </div>
                      )}
                    </td>
                    <td className="p-3 border font-bold">
                      {t.status === 'Selesai' && <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Selesai</span>}
                      {t.status === 'Diproses' && <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded">Diproses</span>}
                      {t.status === 'Menunggu' && <span className="text-slate-500 bg-slate-100 px-2 py-1 rounded">Menunggu</span>}
                    </td>
                    <td className="p-3 border text-center space-y-2">
                      {t.status !== 'Selesai' && (
                        <>
                          <button onClick={() => prosesLaporan(t.id, 'Diproses')} className="block w-full bg-amber-500 text-white text-xs px-3 py-2 rounded shadow hover:bg-amber-600 font-bold transition-colors">Tandai Diproses</button>
                          <button onClick={() => prosesLaporan(t.id, 'Selesai')} className="block w-full bg-emerald-500 text-white text-xs px-3 py-2 rounded shadow hover:bg-emerald-600 font-bold transition-colors">Selesaikan</button>
                        </>
                      )}
                      {t.status === 'Selesai' && <span className="text-xs text-slate-400 font-bold">Case Closed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}