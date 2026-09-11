"use client";

import type { ReactNode } from "react";

export default function TautanWhatsAppPdp({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => {
        if (!confirm("Nomor WhatsApp warga akan dibuka di WhatsApp/Meta. Lanjutkan?")) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </a>
  );
}
