"use client";

import { useEffect, useRef, useState } from "react";
import { adalahPerangkatIos, sudahModeAplikasi } from "@/lib/pasang-pwa";

const KUNCI_LEWATI = "wargaku-ajakan-pasang-v1";

type PeristiwaPasang = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function AjakanPasangAplikasi() {
  const [tampil, setTampil] = useState(false);
  const [ios, setIos] = useState(false);
  const [bisaPrompt, setBisaPrompt] = useState(false);
  const peristiwa = useRef<PeristiwaPasang | null>(null);

  useEffect(() => {
    if (sudahModeAplikasi()) return;
    if (window.localStorage.getItem(KUNCI_LEWATI) === "1") return;

    setIos(adalahPerangkatIos());
    setTampil(true);

    const tangkap = (ev: Event) => {
      ev.preventDefault();
      peristiwa.current = ev as PeristiwaPasang;
      setBisaPrompt(true);
      setTampil(true);
    };
    const terpasang = () => {
      peristiwa.current = null;
      setBisaPrompt(false);
      setTampil(false);
    };
    window.addEventListener("beforeinstallprompt", tangkap);
    window.addEventListener("appinstalled", terpasang);
    return () => {
      window.removeEventListener("beforeinstallprompt", tangkap);
      window.removeEventListener("appinstalled", terpasang);
    };
  }, []);

  const lewati = () => {
    window.localStorage.setItem(KUNCI_LEWATI, "1");
    setTampil(false);
  };

  const pasang = async () => {
    const cadangan = peristiwa.current;
    if (!cadangan) return;
    await cadangan.prompt();
    const pilihan = await cadangan.userChoice;
    if (pilihan.outcome === "accepted") {
      peristiwa.current = null;
      setBisaPrompt(false);
      setTampil(false);
    }
  };

  if (!tampil) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 md:p-4 pointer-events-none">
      <div className="pointer-events-auto max-w-xl mx-auto rounded-2xl border border-slate-200 bg-white shadow-lg p-4 flex flex-col gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Pasang di HP</p>
          <p className="text-sm font-semibold text-slate-900 mt-1 leading-snug">
            Jangan unduh berkas APK. Pasang Portal Warga dari peramban agar notifikasi bisa masuk.
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
            {ios
              ? "iPhone/iPad: tombol Bagikan, lalu Tambah ke Layar Utama. Buka dari ikon itu — bukan dari Safari — baru izinkan notifikasi."
              : bisaPrompt
                ? "Android/Chrome: ketuk Pasang aplikasi. Ikon akan muncul di layar utama, tanpa Play Store."
                : "Buka menu peramban (⋮), pilih Instal aplikasi atau Tambah ke layar utama, lalu izinkan notifikasi di dalam aplikasi."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {bisaPrompt ? (
            <button
              type="button"
              onClick={pasang}
              className="text-xs font-bold px-4 py-2.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:scale-95"
            >
              Pasang aplikasi
            </button>
          ) : null}
          <button
            type="button"
            onClick={lewati}
            className="text-xs font-semibold px-3 py-2.5 rounded-lg text-slate-500 hover:text-slate-800"
          >
            Nanti
          </button>
        </div>
      </div>
    </div>
  );
}
