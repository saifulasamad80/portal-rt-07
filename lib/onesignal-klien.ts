import {
  ONESIGNAL_APP_ID,
  ONESIGNAL_ASAL_SITUS,
  ONESIGNAL_SW_PATH,
  ONESIGNAL_SW_SCOPE,
  idEksternalOneSignal,
  type PeranOneSignal,
  type SesiOneSignal,
} from "@/lib/onesignal";

export type OneSignalSDK = {
  init: (opsi: Record<string, unknown>) => Promise<void>;
  login: (idEksternal: string) => Promise<void>;
  logout: () => Promise<void>;
  User: {
    addTags: (tag: Record<string, string>) => void;
    PushSubscription: {
      optIn: () => Promise<void>;
      optedIn?: boolean;
    };
  };
  Notifications: {
    requestPermission: () => Promise<boolean>;
    permission: boolean;
    isPushSupported: () => boolean;
  };
};

type AntrianOneSignal = Array<(sdk: OneSignalSDK) => void | Promise<void>>;

declare global {
  interface Window {
    OneSignalDeferred?: AntrianOneSignal;
    __wargakuOneSignalInit?: boolean;
    __wargakuOneSignalAntri?: boolean;
  }
}

function kunciPushBentrok(err: unknown) {
  const teks = err instanceof Error ? err.message : String(err);
  return /applicationServerKey|gcm_sender_id/i.test(teks);
}

export async function lepasLanggananPushYangAda() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const daftar = await navigator.serviceWorker.getRegistrations();
  for (const reg of daftar) {
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  }
}

async function optInOneSignalAman(OneSignal: OneSignalSDK) {
  if (OneSignal.User.PushSubscription.optedIn) return;
  try {
    await OneSignal.User.PushSubscription.optIn();
  } catch (err) {
    if (!kunciPushBentrok(err)) throw err;
    // Chrome hanya izinkan satu applicationServerKey per worker.
    // Langganan VAPID lama harus dilepas sebelum OneSignal bisa subscribe.
    await lepasLanggananPushYangAda();
    await OneSignal.User.PushSubscription.optIn();
  }
}

function antrianOneSignal(): AntrianOneSignal {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  return window.OneSignalDeferred;
}

export function asalOneSignalSah() {
  if (typeof window === "undefined") return false;
  try {
    const sekarang = window.location.origin.replace(/\/$/, "");
    return sekarang === ONESIGNAL_ASAL_SITUS;
  } catch {
    return false;
  }
}

function pesanKesalahan(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function initOneSignalSudahJalan(err: unknown) {
  return /already initialized/i.test(pesanKesalahan(err));
}

function initOneSignalDitolakAsal(err: unknown) {
  return /can only be used on/i.test(pesanKesalahan(err));
}

export function jalankanSetelahOneSignalSiap(
  kerja: (sdk: OneSignalSDK) => void | Promise<void>
) {
  if (typeof window === "undefined") return;
  antrianOneSignal().push(kerja);
}

export async function inisialisasiOneSignalSdk() {
  if (typeof window === "undefined") return;
  // Dashboard OneSignal mengunci Site URL ke origin produksi. Init di
  // localhost/preview hanya memunculkan overlay Next.js, bukan push yang jalan.
  if (!asalOneSignalSah()) return;
  if (window.__wargakuOneSignalAntri) return;
  window.__wargakuOneSignalAntri = true;

  jalankanSetelahOneSignalSiap(async (OneSignal) => {
    if (window.__wargakuOneSignalInit) {
      try {
        await tautkanSesiOneSignal(OneSignal);
      } catch {
        return;
      }
      return;
    }
    window.__wargakuOneSignalInit = true;
    const localhost = window.location.hostname === "localhost"
      || window.location.hostname === "127.0.0.1";
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: localhost,
        autoResubscribe: true,
        persistNotification: false,
        serviceWorkerPath: ONESIGNAL_SW_PATH,
        serviceWorkerParam: { scope: ONESIGNAL_SW_SCOPE },
        notifyButton: { enable: false },
        welcomeNotification: { disable: true },
        promptOptions: {
          slidedown: {
            prompts: [{
              type: "push",
              autoPrompt: false,
              text: {
                actionMessage: "Izinkan notifikasi agar pengumuman RT sampai ke HP Anda.",
                acceptButton: "Izinkan",
                cancelButton: "Nanti",
              },
            }],
          },
        },
      });
    } catch (err) {
      if (initOneSignalSudahJalan(err)) {
        // Strict Mode / antrian dobel: SDK sudah hidup, lanjut tautkan sesi.
      } else if (initOneSignalDitolakAsal(err)) {
        return;
      } else {
        window.__wargakuOneSignalInit = false;
        window.__wargakuOneSignalAntri = false;
        console.error("OneSignal gagal diinisialisasi:", err);
        return;
      }
    }
    try {
      await tautkanSesiOneSignal(OneSignal);
    } catch {
      return;
    }
  });
}

function permukaanDariPath(path: string): "warga" | "pengurus" | "auto" {
  if (path.startsWith("/admin")) return "pengurus";
  if (path.startsWith("/portal")) return "warga";
  return "auto";
}

async function bacaSesiOneSignal(): Promise<SesiOneSignal | null | undefined> {
  const permukaan = permukaanDariPath(window.location.pathname);
  const res = await fetch(`/api/onesignal/sesi?p=${encodeURIComponent(permukaan)}`, {
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return undefined;
  const data = await res.json().catch(() => null);
  const sesi = data && typeof data === "object" ? (data as { sesi?: SesiOneSignal | null }).sesi : null;
  if (!sesi || (sesi.peran !== "warga" && sesi.peran !== "pengurus")) return null;
  if (!sesi.id || !sesi.rtId) return null;
  return sesi;
}

async function tautkanSesiOneSignal(OneSignal: OneSignalSDK) {
  const sesi = await bacaSesiOneSignal();
  if (sesi === undefined) return;
  if (!sesi) {
    await OneSignal.logout();
    return;
  }
  await OneSignal.login(idEksternalOneSignal(sesi.peran, sesi.id));
  OneSignal.User.addTags({
    peran: sesi.peran,
    rt_id: sesi.rtId,
  });
  if (OneSignal.Notifications.permission) {
    await optInOneSignalAman(OneSignal);
  }
}

export function daftarkanLanggananOneSignal(peran: PeranOneSignal) {
  return new Promise<boolean>((selesai) => {
    if (typeof window === "undefined" || !asalOneSignalSah()) {
      selesai(false);
      return;
    }
    void inisialisasiOneSignalSdk();
    let tuntas = false;
    const batas = window.setTimeout(() => {
      if (tuntas) return;
      tuntas = true;
      selesai(false);
    }, 15000);

    jalankanSetelahOneSignalSiap(async (OneSignal) => {
      if (tuntas) return;
      try {
        const sesi = await bacaSesiOneSignal();
        if (sesi && sesi.peran === peran) {
          await OneSignal.login(idEksternalOneSignal(sesi.peran, sesi.id));
          OneSignal.User.addTags({ peran: sesi.peran, rt_id: sesi.rtId });
        }
        await OneSignal.Notifications.requestPermission();
        await optInOneSignalAman(OneSignal);
        tuntas = true;
        window.clearTimeout(batas);
        selesai(Boolean(OneSignal.Notifications.permission || OneSignal.User.PushSubscription.optedIn));
      } catch {
        tuntas = true;
        window.clearTimeout(batas);
        selesai(false);
      }
    });
  });
}
