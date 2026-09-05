import { redirect } from "next/navigation";
import LaporClient from "./LaporClient";
import { otentikasiWargaAktif, wajibOtentikasiWarga } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";

export default async function LaporRTPage() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");
  const wargaAktif = otentikasi.sesi;

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);
  
  const [wargaRes, laporanRes] = await Promise.all([
    supabaseAdmin.from("warga").select("id, nik, nama_lengkap, no_whatsapp, rt_id").eq("id", wargaAktif.id).eq("nik", wargaAktif.nik).eq("rt_id", wargaAktif.rtId).single(),
    supabaseAdmin.from("laporan_warga").select("id, judul_laporan, deskripsi, status, tanggapan_rt, created_at").eq("warga_id", wargaAktif.id).eq("rt_id", wargaAktif.rtId).order("created_at", { ascending: false }).limit(100)
  ]);

  if (!wargaRes.data) redirect("/login");

  // REFACTOR: Eksekusi Validasi Lapis Baja
  async function kirimLaporan(judul: string, deskripsi: string) {
    "use server";
    const sesi = await wajibOtentikasiWarga();
    const judulBersih = String(judul || "").trim().slice(0, 200);
    const deskripsiBersih = String(deskripsi || "").trim().slice(0, 5000);
    if (!judulBersih || !deskripsiBersih) return { success: false, message: "Judul dan isi laporan wajib diisi." };
    
    const supabaseAdmin = await buatKlienTerautentikasi(sesi);
    
    const { error } = await supabaseAdmin.from("laporan_warga").insert([{
      warga_id: sesi.id, // Gunakan ID asli dari token (Anti-Spoofing)
      rt_id: sesi.rtId,
      judul_laporan: judulBersih,
      deskripsi: deskripsiBersih,
      status: "Menunggu"
    }]);

    if (error) return { success: false, message: "Laporan gagal dikirim." };
    return { success: true, message: "Laporan berhasil dikirim." };
  }

  return <LaporClient warga={wargaRes.data} initialLaporan={laporanRes.data || []} kirimLaporan={kirimLaporan} />;
}
