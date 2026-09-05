import { redirect } from "next/navigation";
import { otentikasiWargaAktif } from "@/lib/session-security";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");

  return children;
}
