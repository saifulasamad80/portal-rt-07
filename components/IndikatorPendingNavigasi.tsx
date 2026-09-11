"use client";

import { useLinkStatus } from "next/link";

/**
 * Umpan balik klik di dalam <Link>: overlay kartu + batang atas.
 * Hanya muncul bila navigasi benar-benar menunda, supaya klik cepat tidak kedip.
 */
export default function IndikatorPendingNavigasi({
  ringkas = false,
}: {
  ringkas?: boolean;
}) {
  const { pending } = useLinkStatus();

  return (
    <>
      {ringkas ? null : (
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 z-10 rounded-2xl bg-white/55 ${
            pending ? "kartu-modul-pending" : "opacity-0"
          }`}
        >
          <span className="absolute right-3 top-3 h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent" />
        </span>
      )}
      <span
        aria-hidden
        className={`pointer-events-none fixed inset-x-0 top-0 z-[120] h-0.5 overflow-hidden ${
          pending ? "batang-navigasi-aktif" : "opacity-0"
        }`}
      >
        <span className="batang-navigasi block h-full w-1/3 rounded-full bg-blue-500" />
      </span>
    </>
  );
}
