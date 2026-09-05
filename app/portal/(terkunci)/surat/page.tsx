import { redirect } from "next/navigation";
import SuratClient from "./SuratClient"; // Memanggil file form UI
import { otentikasiWargaAktif } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";

export default async function CetakSuratPage() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");
  const wargaAktif = otentikasi.sesi;

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);
  
  const { data: profilWarga } = await supabaseAdmin
    .from("warga")
    .select("id, nik, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir, pekerjaan, detail_alamat, rt_id")
    .eq("id", wargaAktif.id)
    .eq("nik", wargaAktif.nik)
    .eq("rt_id", wargaAktif.rtId)
    .single();

  if (!profilWarga) redirect("/login");

  // EFEK DOMINO RESOLVED: Lempar data utuh ke Client Component untuk di-render jadi kertas
  return <SuratClient warga={profilWarga} />;
}
