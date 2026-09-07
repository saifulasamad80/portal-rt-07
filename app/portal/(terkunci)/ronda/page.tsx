import { redirect } from "next/navigation";
import RondaClient from "./RondaClient";
import { otentikasiWargaAktif, wajibOtentikasiWarga } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";
import { POLA_UUID } from "@/lib/uuid-tenant";

export default async function RondaPage() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");
  const wargaAktif = otentikasi.sesi;

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);
  
  // Tarik Jadwal Ronda milik Warga yang login
  const { data: jadwalRes } = await supabaseAdmin
    .from("jadwal_ronda")
    .select("*")
    .eq("warga_id", wargaAktif.id)
    .eq("rt_id", wargaAktif.rtId)
    .order("tanggal_tugas", { ascending: true });

  // FAKTA: Server Action untuk Mengkonfirmasi Kehadiran secara Aman (Bypass RLS)
  async function konfirmasiKehadiran(idJadwal: string, aksi: string, alasan: string) {
    "use server";
    const sesi = await wajibOtentikasiWarga();
    const idBersih = String(idJadwal || "").trim();
    const aksiBersih = String(aksi || "").trim();
    const alasanBersih = String(alasan || "").trim().slice(0, 1000);
    if (!POLA_UUID.test(idBersih) || !["Siap Hadir", "Izin Berhalangan"].includes(aksiBersih)) {
      return { success: false, message: "Konfirmasi jadwal tidak valid." };
    }
    const supabaseAdmin = await buatKlienTerautentikasi(sesi);
    
    const { data: diperbarui, error } = await supabaseAdmin
      .from("jadwal_ronda")
      .update({ status: aksiBersih, alasan_izin: alasanBersih || null })
      .eq("id", idBersih)
      .eq("warga_id", sesi.id)
      .eq("rt_id", sesi.rtId)
      .select("id")
      .maybeSingle();

    if (error || !diperbarui) return { success: false, message: "Jadwal berubah atau tidak ditemukan." };
    return { success: true, message: "Konfirmasi jadwal tersimpan." };
  }

  // INJEKSI MUTLAK: generateTest dihapus total dari properti pemanggilan
  return <RondaClient jadwal={jadwalRes || []} konfirmasiKehadiran={konfirmasiKehadiran} />;
}
