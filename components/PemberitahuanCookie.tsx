"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PATH_KEBIJAKAN_PRIVASI } from "@/lib/kebijakan-privasi";

const KUNCI = "aplikasi-rt:pemberitahuan-cookie-v1";

export default function PemberitahuanCookie() {
  const [siap, setSiap] = useState(false);
  const [tertutup, setTertutup] = useState(false);

  useEffect(() => {
    try {
      setTertutup(window.localStorage.getItem(KUNCI) === "1");
    } catch {
      setTertutup(false);
    }
    setSiap(true);
  }, []);

  if (!siap || tertutup) return null;

  const tutup = () => {
    try {
      window.localStorage.setItem(KUNCI, "1");
    } catch {
      // Mode privat: banner hilang hanya di sesi ini.
    }
    setTertutup(true);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-3 print:hidden">
      <div className="max-w-3xl mx-auto rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
        <p className="text-[12px] text-slate-600 leading-relaxed">
          Portal memakai cookie sesi HttpOnly agar Anda tetap masuk. Bukan untuk iklan.
          {" "}
          <Link href={PATH_KEBIJAKAN_PRIVASI} className="text-blue-700 font-semibold underline">Kebijakan Privasi</Link>
        </p>
        <button type="button" onClick={tutup} className="shrink-0 rounded-lg bg-slate-900 text-white text-xs font-bold px-4 py-2">
          Mengerti
        </button>
      </div>
    </div>
  );
}
