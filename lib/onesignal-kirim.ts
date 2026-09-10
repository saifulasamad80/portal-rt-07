import { ONESIGNAL_APP_ID, idEksternalPengurus, idEksternalWarga } from "@/lib/onesignal";
import type { HasilKirimNotifikasi, PayloadNotifikasi } from "@/lib/notifikasi-push";

const URL_API_ONESIGNAL = "https://api.onesignal.com/notifications";
const BATAS_ALIAS = 20000;
const IKON_PUSH = "https://wargaku-six.vercel.app/icon-192.png";

export function onesignalPengirimanSiap() {
  return Boolean(process.env.ONESIGNAL_REST_API_KEY?.trim() && ONESIGNAL_APP_ID);
}

function kunciApiOneSignal() {
  return process.env.ONESIGNAL_REST_API_KEY?.trim() || "";
}

function asalSitus() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://wargaku-six.vercel.app").replace(/\/$/, "");
}

function urlLuncurAman(path?: string) {
  const dasar = asalSitus();
  const cadangan = `${dasar}/portal`;
  if (!path || typeof path !== "string") return cadangan;
  const nilai = path.trim();
  if (nilai.startsWith("https://") || nilai.startsWith("http://")) {
    try {
      const url = new URL(nilai);
      if (url.origin !== new URL(dasar).origin) return cadangan;
      return url.toString();
    } catch {
      return cadangan;
    }
  }
  if (!nilai.startsWith("/") || nilai.startsWith("//") || nilai.includes("\\")) return cadangan;
  return `${dasar}${nilai}`;
}

async function kirimPesanOneSignal(
  sasaran: Record<string, unknown>,
  payload: PayloadNotifikasi
): Promise<HasilKirimNotifikasi> {
  const kunci = kunciApiOneSignal();
  if (!kunci) return { terkirim: 0, pesan: "Kunci REST OneSignal belum diatur." };

  const res = await fetch(URL_API_ONESIGNAL, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: `Key ${kunci}`,
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      target_channel: "push",
      name: payload.tag || payload.title,
      headings: { en: payload.title, id: payload.title },
      contents: { en: payload.body, id: payload.body },
      url: urlLuncurAman(payload.url),
      chrome_web_icon: IKON_PUSH,
      firefox_icon: IKON_PUSH,
      collapse_id: payload.tag,
      ...sasaran,
    }),
  });

  const data = await res.json().catch(() => null) as
    | { id?: string; recipients?: number; errors?: unknown }
    | null;
  if (!res.ok) {
    console.error("OneSignal menolak kiriman push:", res.status, data);
    return { terkirim: 0, pesan: "OneSignal menolak kiriman notifikasi." };
  }
  const terkirim = typeof data?.recipients === "number"
    ? data.recipients
    : data?.id
      ? 1
      : 0;
  return { terkirim };
}

export async function kirimOneSignalKeAlias(idEksternal: string[], payload: PayloadNotifikasi): Promise<HasilKirimNotifikasi> {
  const unik = [...new Set(idEksternal.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!unik.length) return { terkirim: 0 };
  let terkirim = 0;
  for (let i = 0; i < unik.length; i += BATAS_ALIAS) {
    const potongan = unik.slice(i, i + BATAS_ALIAS);
    const hasil = await kirimPesanOneSignal(
      { include_aliases: { external_id: potongan } },
      payload
    );
    if (hasil.pesan && !hasil.terkirim) return hasil;
    terkirim += hasil.terkirim;
  }
  return { terkirim };
}

export async function kirimOneSignalKeWarga(wargaId: string, payload: PayloadNotifikasi): Promise<HasilKirimNotifikasi> {
  return kirimOneSignalKeAlias([idEksternalWarga(wargaId)], payload);
}

export async function kirimOneSignalKePengurus(pengurusId: string[], payload: PayloadNotifikasi): Promise<HasilKirimNotifikasi> {
  return kirimOneSignalKeAlias(pengurusId.map(idEksternalPengurus), payload);
}
