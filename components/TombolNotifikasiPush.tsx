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

type SasaranNotifikasi = "warga" | "pengurus";

export default function TombolNotifikasiPush({
  sasaran = "warga",
}: {
  sasaran?: SasaranNotifikasi;
}) {
  const [status, setStatus] = useState<"idle" | "aktif" | "menunggu" | "tidak-didukung">("idle");
  const [pesan, setPesan] = useState("");
  const urlLangganan = sasaran === "pengurus" ? "/api/admin/push/subscribe" : "/api/push/subscribe";
  const urlTes = sasaran === "pengurus" ? "/api/admin/push/tes" : "/api/push/tes";

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("tidak-didukung");
      return;
    }
    let batal = false;
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (!existing || batal) return;
      // Langganan di peramban belum tentu ada di server (baris terhapus,
      // atau perangkat ini baru dipakai pengurus). Sinkron ulang diam-diam;
      // bila server menolak, tombol tetap bisa diklik.
      const simpan = await fetch(urlLangganan, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existing.toJSON()),
      }).catch(() => null);
      if (batal) return;
      setStatus(simpan?.ok ? "aktif" : "idle");
    }).catch(() => undefined);
    return () => {
      batal = true;
    };
  }, [urlLangganan]);

  const aktifkan = async () => {
    setStatus("menunggu");
    setPesan("");
    try {
      if (typeof Notification === "undefined") {
        setStatus("tidak-didukung");
        return;
      }
      const izin = await Notification.requestPermission();
      if (izin !== "granted") {
        setStatus("idle");
        setPesan("Izin notifikasi ditolak. Buka pengaturan peramban, izinkan notifikasi untuk situs ini, lalu coba lagi.");
        return;
      }
      const kunciRes = await fetch("/api/push/subscribe", { cache: "no-store" });
      const kunciData = await kunciRes.json().catch(() => ({}));
      const vapidPublicKey = String(kunciData.vapidPublicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
      if (!vapidPublicKey) {
        setStatus("idle");
        setPesan("Kunci notifikasi belum terbaca. Muat ulang halaman, lalu aktifkan lagi.");
        return;
      }
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
      const tes = await fetch(urlTes, { method: "POST" });
      const tesData = await tes.json().catch(() => ({}));
      setStatus("aktif");
      setPesan(tesData.success ? "Notifikasi aktif. Cek apakah tes muncul di perangkat ini." : "Langganan tersimpan. Izinkan notifikasi sistem agar pemberitahuan masuk.");
    } catch (err: unknown) {
      setStatus("idle");
      setPesan(err instanceof Error ? err.message : "Gagal mengaktifkan notifikasi.");
    }
  };

  if (status === "tidak-didukung") return null;

  return (
    <div className="relative flex flex-col items-stretch md:items-end">
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

      {/* Tooltip mengambang: dipasang absolute supaya munculnya pesan tidak
          menambah tinggi elemen dan ikut menggeser tata letak header. */}
      {pesan ? (
        <div
          role="status"
          className="absolute top-full right-0 mt-2 z-50 w-max max-w-[220px] bg-slate-800 text-white text-[10px] font-medium leading-relaxed px-3 py-1.5 rounded-md shadow-lg ring-1 ring-white/10"
        >
          <span className="absolute -top-1 right-5 w-2 h-2 rotate-45 bg-slate-800"></span>
          <span className="relative">{pesan}</span>
        </div>
      ) : null}
    </div>
  );
}
