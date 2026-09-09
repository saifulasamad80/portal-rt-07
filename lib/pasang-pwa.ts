export function sudahModeAplikasi() {
  if (typeof window === "undefined") return false;
  const tampilan = window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: minimal-ui)").matches;
  const iosStandalone = "standalone" in window.navigator
    && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return tampilan || iosStandalone;
}

export function adalahPerangkatIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const ipadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || ipadOs;
}

export function pushPerambanDidukung() {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && typeof Notification !== "undefined";
}
