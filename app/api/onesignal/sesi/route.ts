import { NextResponse } from "next/server";
import { otentikasiAdminAktif, otentikasiWargaAktif } from "@/lib/session-security";

export async function GET(request: Request) {
  const permukaan = new URL(request.url).searchParams.get("p");
  const hanyaWarga = permukaan === "warga";
  const hanyaPengurus = permukaan === "pengurus";

  if (!hanyaPengurus) {
    const warga = await otentikasiWargaAktif();
    if (warga.ok) {
      return NextResponse.json({
        sesi: { peran: "warga", id: warga.sesi.id, rtId: warga.sesi.rtId },
      });
    }
    if (hanyaWarga) return NextResponse.json({ sesi: null });
  }

  if (!hanyaWarga) {
    const pengurus = await otentikasiAdminAktif();
    if (pengurus.ok) {
      return NextResponse.json({
        sesi: { peran: "pengurus", id: pengurus.sesi.id, rtId: pengurus.sesi.rtId },
      });
    }
  }

  return NextResponse.json({ sesi: null });
}
