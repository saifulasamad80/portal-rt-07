"use client";

import type { ReactNode } from "react";
import { susunPesanWhatsAppPengumuman, tautanPengumumanPublik } from "@/lib/pesan-whatsapp-pengumuman";

export function sebarPengumumanKeWhatsApp(input: {
  id?: string | null;
  judul: string;
  deskripsi: string;
  namaRt: string;
}) {
  const tautan = input.id
    ? tautanPengumumanPublik(window.location.origin, input.id)
    : `${window.location.origin}/#pengumuman`;
  const pesan = susunPesanWhatsAppPengumuman({
    judul: input.judul,
    deskripsi: input.deskripsi,
    tautan,
    namaRt: input.namaRt,
  });
  window.open(`https://wa.me/?text=${encodeURIComponent(pesan)}`, "_blank", "noopener,noreferrer");
}

export default function TombolShareWhatsAppPengumuman({
  id,
  judul,
  deskripsi,
  namaRt,
  className,
  children,
}: {
  id?: string | null;
  judul: string;
  deskripsi: string;
  namaRt: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => sebarPengumumanKeWhatsApp({ id, judul, deskripsi, namaRt })}
      className={className}
    >
      {children || "📲 Share WA"}
    </button>
  );
}
