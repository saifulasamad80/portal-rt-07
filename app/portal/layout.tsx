import { redirect } from "next/navigation";
import { otentikasiWargaAktif } from "@/lib/session-security";

// Jangan pasang loading.tsx skeleton penuh di sini: Next.js mengganti dasbor
// jadi kartu kosong saat klik modul, padahal IndikatorPendingNavigasi sudah ada.

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");

  return children;
}
