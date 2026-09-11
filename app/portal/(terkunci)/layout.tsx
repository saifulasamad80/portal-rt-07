import { redirect } from "next/navigation";
import { otentikasiWargaAktif } from "@/lib/session-security";

/**
 * Layanan umum portal hanya membutuhkan sesi warga yang aktif. Enforcement
 * status Carik dilakukan khusus di /portal/sensus dan di action mutasinya,
 * bukan pada layout seluruh layanan administrasi.
 */
export default async function LayoutLayananTerkunci({ children }: { children: React.ReactNode }) {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");

  return children;
}
