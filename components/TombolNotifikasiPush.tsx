"use client";

import { useEffect, useState } from "react";
import { daftarkanLanggananOneSignal } from "@/lib/onesignal-klien";
import { adalahPerangkatIos, pushPerambanDidukung, sudahModeAplikasi } from "@/lib/pasang-pwa";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

type SasaranNotifikasi = "warga" | "pengurus";
type StatusTombol = "idle" | "aktif" | "menunggu" | "tidak-didukung" | "perlu-pasang";

export default function TombolNotifikasiPush({
  sasaran = "warga",
}: {
  sasaran?: SasaranNotifikasi;
}) {
  const [status, setStatus] = useState<StatusTombol>("idle");
  const [pesan, setPesan] = useState("");
  const urlLangganan = sasaran === "pengurus" ? "/api/admin/push/subscribe" : "/api/push/subscribe";
  const urlTes = sasaran === "pengurus" ? "/api/admin/push/tes" : "/api/push/tes";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pushPerambanDidukung()) {
      setStatus(adalahPerangkatIos() && !sudahModeAplikasi() ? "perlu-pasang" : "tidak-didukung");
      return;
    }
    let batal = false;
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (batal) return;
      if (existing) {
        const simpan = await fetch(urlLangganan, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(existing.toJSON()),
        }).catch(() => null);
        if (batal) return;
        setStatus(simpan?.ok ? "aktif" : "idle");
      }
      // Izin yang diberikan sebelum OneSignal tetap dipakai; jangan minta ketuk ulang.
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        void daftarkanLanggananOneSignal(sasaran);
      }
    }).catch(() => undefined);
    return () => {
      batal = true;
    };
  }, [sasaran, urlLangganan]);

  const jelaskanPasang = () => {
    setPesan(
      adalahPerangkatIos()
        ? "Pasang dulu ke Layar Utama (Bagikan → Tambah ke Layar Utama), buka dari ikon itu, lalu ketuk tombol ini lagi."
        : "Pasang Portal Warga dari menu peramban, lalu izinkan notifikasi dari dalam aplikasi."
    );
  };

  const aktifkan = async () => {
    if (status === "perlu-pasang" || status === "tidak-didukung") {
      jelaskanPasang();
      return;
    }
    setStatus("menunggu");
    setPesan("");
    try {
      if (!confirm("Notifikasi memakai OneSignal di Amerika Serikat. Alias akun dan token perangkat dikirim ke sana, bukan NIK. Izinkan?")) {
        setStatus("idle");
        return;
      }
      if (typeof Notification === "undefined") {
        setStatus("tidak-didukung");
        setPesan("Peramban ini tidak menyediakan izin notifikasi.");
        return;
      }
      const izin = await Notification.requestPermission();
      if (izin !== "granted") {
        setStatus("idle");
        setPesan("Izin notifikasi ditolak. Buka pengaturan peramban, izinkan notifikasi untuk situs ini, lalu coba lagi.");
        return;
      }
      const onesignalOk = await daftarkanLanggananOneSignal(sasaran);
      let vapidOk = false;
      // Satu worker hanya boleh satu applicationServerKey. Jangan subscribe VAPID
      // jika OneSignal sudah berhasil; kunci Vercel tetap dipakai sebagai cadangan.
      if (!onesignalOk) {
        const kunciRes = await fetch("/api/push/subscribe", { cache: "no-store" });
        const kunciData = await kunciRes.json().catch(() => ({}));
        const vapidPublicKey = String(kunciData.vapidPublicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
        if (vapidPublicKey) {
          await navigator.serviceWorker.register("/sw.js");
          const reg = await navigator.serviceWorker.ready;
          const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
          const simpan = await fetch(urlLangganan, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subscription.toJSON()),
          });
          if (!simpan.ok) {
            const err = await simpan.json().catch(() => ({}));
            throw new Error(err.error || "Gagal mendaftarkan perangkat.");
          }
          vapidOk = true;
        }
      }
      if (!onesignalOk && !vapidOk) {
        throw new Error("Gagal mendaftarkan perangkat ke layanan notifikasi.");
      }
      const tes = await fetch(urlTes, { method: "POST" });
      const tesData = await tes.json().catch(() => ({}));
      setStatus("aktif");
      setPesan(tesData.success ? "Notifikasi aktif. Cek apakah tes muncul di perangkat ini." : "Langganan tersimpan. Izinkan notifikasi sistem agar pemberitahuan masuk.");
    } catch (err: unknown) {
      setStatus("idle");
      const teks = err instanceof Error ? err.message : "";
      setPesan(
        /applicationServerKey|gcm_sender_id/i.test(teks)
          ? "Langganan notifikasi lama masih menempel. Ketuk tombol sekali lagi."
          : teks || "Gagal mengaktifkan notifikasi."
      );
    }
  };

  const label = status === "aktif"
    ? "Notifikasi aktif"
    : status === "menunggu"
      ? "Mengaktifkan..."
      : status === "perlu-pasang"
        ? "Pasang dulu, lalu notifikasi"
        : status === "tidak-didukung"
          ? "Notifikasi tidak didukung"
          : "Aktifkan notifikasi HP";

  return (
    <div className="relative flex flex-col items-stretch md:items-end">
      <button
        type="button"
        onClick={aktifkan}
        disabled={status === "menunggu"}
        className={`text-xs font-bold px-4 py-2.5 rounded-lg transition-all active:scale-95 ${
          status === "aktif"
            ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
            : status === "tidak-didukung" || status === "perlu-pasang"
              ? "bg-white/10 text-white border border-white/20"
              : "bg-white text-slate-900 hover:bg-blue-50"
        }`}
      >
        {label}
      </button>

      {pesan ? (
        <div
          role="status"
          className="absolute top-full right-0 mt-2 z-50 w-max max-w-[240px] bg-slate-800 text-white text-[10px] font-medium leading-relaxed px-3 py-1.5 rounded-md shadow-lg ring-1 ring-white/10"
        >
          <span className="absolute -top-1 right-5 w-2 h-2 rotate-45 bg-slate-800"></span>
          <span className="relative">{pesan}</span>
        </div>
      ) : null}
    </div>
  );
}
