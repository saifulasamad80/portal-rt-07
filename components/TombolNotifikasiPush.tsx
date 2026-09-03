"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function TombolNotifikasiPush() {
  const [status, setStatus] = useState<"idle" | "aktif" | "menunggu" | "tidak-didukung">("idle");
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("tidak-didukung");
      return;
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (existing) setStatus("aktif");
    }).catch(() => undefined);
  }, []);

  const aktifkan = async () => {
    setStatus("menunggu");
    setPesan("");
    try {
      const izin = await Notification.requestPermission();
      if (izin !== "granted") {
        setStatus("idle");
        setPesan("Izin notifikasi belum diberikan di peramban.");
        return;
      }
      const kunciRes = await fetch("/api/push/subscribe");
      const kunciData = await kunciRes.json();
      if (!kunciData.vapidPublicKey) {
        setStatus("idle");
        setPesan("Kunci notifikasi belum diatur di server.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(kunciData.vapidPublicKey),
      });
      const simpan = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!simpan.ok) {
        const err = await simpan.json().catch(() => ({}));
        throw new Error(err.error || "Gagal mendaftarkan perangkat.");
      }
      setStatus("aktif");
      setPesan("Perangkat ini siap menerima pengumuman RT.");
    } catch (err: any) {
      setStatus("idle");
      setPesan(err.message || "Gagal mengaktifkan notifikasi.");
    }
  };

  if (status === "tidak-didukung") return null;

  return (
    <div className="flex flex-col items-stretch md:items-end gap-1">
      <button
        type="button"
        onClick={aktifkan}
        disabled={status === "menunggu" || status === "aktif"}
        className={`text-xs font-bold px-4 py-2.5 rounded-lg transition-all active:scale-95 ${
          status === "aktif"
            ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
            : "bg-white text-slate-900 hover:bg-blue-50"
        }`}
      >
        {status === "aktif" ? "Notifikasi aktif" : status === "menunggu" ? "Mengaktifkan..." : "Aktifkan notifikasi HP"}
      </button>
      {pesan ? <p className="text-[10px] text-slate-300 text-right max-w-xs">{pesan}</p> : null}
    </div>
  );
}
