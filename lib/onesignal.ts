export const ONESIGNAL_APP_ID =
  process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim()
  || "c512e2f1-6340-46b0-9678-0154ce2df051";

export const ONESIGNAL_SW_PATH = "push/onesignal/OneSignalSDKWorker.js";
export const ONESIGNAL_SW_SCOPE = "/push/onesignal/";
export const ONESIGNAL_SDK_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

export type PeranOneSignal = "warga" | "pengurus";

export type SesiOneSignal = {
  peran: PeranOneSignal;
  id: string;
  rtId: string;
};

export function idEksternalOneSignal(peran: PeranOneSignal, id: string) {
  return `${peran}:${id}`;
}

export function idEksternalWarga(id: string) {
  return idEksternalOneSignal("warga", id);
}

export function idEksternalPengurus(id: string) {
  return idEksternalOneSignal("pengurus", id);
}
