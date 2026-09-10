"use client";

import { useState } from "react";
import { urlApiThumbnailPdf, urlThumbnailPdf } from "@/lib/lampiran-pengumuman";

export default function ThumbnailPdf({ url, alt }: { url: string; alt: string }) {
  const simpanan = urlThumbnailPdf(url);
  const [tahap, setTahap] = useState<"simpanan" | "api" | "gagal">(
    simpanan === url ? "api" : "simpanan",
  );

  if (tahap === "gagal") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-3xl" aria-hidden>
        📄
      </div>
    );
  }

  const src = tahap === "simpanan" ? simpanan : urlApiThumbnailPdf(url);

  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover object-top"
      onError={() => setTahap((sekarang) => (sekarang === "simpanan" ? "api" : "gagal"))}
    />
  );
}
