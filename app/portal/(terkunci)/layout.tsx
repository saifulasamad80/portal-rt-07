import { redirect } from "next/navigation";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";
import { otentikasiWargaAktif } from "@/lib/session-security";

/**
 * Layanan portal selain /portal/sensus hanya dibuka setelah data carik
 * warisan dikonfirmasi. Route group ini tidak membungkus halaman sensus.
 */
export default async function LayoutLayananTerkunci({ children }: { children: React.ReactNode }) {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");

  const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
  const { data: carik, error } = await supabase
    .from("sensus_kesejahteraan")
    .select("id, status_validasi")
    .eq("warga_id", otentikasi.sesi.id)
    .eq("rt_id", otentikasi.sesi.rtId)
    .eq("status_validasi", "Disetujui")
    .maybeSingle();

  if (error || !carik) redirect("/portal/sensus");

  return children;
}
