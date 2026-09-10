import {
  ONESIGNAL_APP_ID,
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
  }
}

function antrianOneSignal(): AntrianOneSignal {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  return window.OneSignalDeferred;
}

export function jalankanSetelahOneSignalSiap(
  kerja: (sdk: OneSignalSDK) => void | Promise<void>
) {
  if (typeof window === "undefined") return;
  antrianOneSignal().push(kerja);
}

export async function inisialisasiOneSignalSdk() {
  if (typeof window === "undefined") return;
  const localhost = window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1";

  jalankanSetelahOneSignalSiap(async (OneSignal) => {
    if (window.__wargakuOneSignalInit) {
      await tautkanSesiOneSignal(OneSignal);
      return;
    }
    window.__wargakuOneSignalInit = true;
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
      window.__wargakuOneSignalInit = false;
      console.error("OneSignal gagal diinisialisasi:", err);
      return;
    }
    await tautkanSesiOneSignal(OneSignal);
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
    await OneSignal.User.PushSubscription.optIn();
  }
}

export function daftarkanLanggananOneSignal(peran: PeranOneSignal) {
  return new Promise<boolean>((selesai) => {
    if (typeof window === "undefined") {
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
        await OneSignal.User.PushSubscription.optIn();
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
