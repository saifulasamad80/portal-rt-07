import { redirect } from "next/navigation";
import { otentikasiWargaAktif } from "@/lib/session-security";
import { ambilCapCarikRumahTangga } from "@/lib/rumah-tangga-warga";

/**
 * Layanan portal selain /portal/sensus hanya dibuka setelah data carik
 * rumah tangga dikonfirmasi. Tanggungan memakai carik kepala keluarga,
 * bukan baris akun jiwa yang disembunyikan dari buku induk.
 */
export default async function LayoutLayananTerkunci({ children }: { children: React.ReactNode }) {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");

  const carik = await ambilCapCarikRumahTangga(otentikasi.sesi);
  if (carik.error || !carik.capDisetujui) redirect("/portal/sensus");

  return children;
}
