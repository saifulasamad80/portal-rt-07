import "server-only";

import { v4 as uuidv4 } from "uuid";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_GALERI, BUCKET_LAMPIRAN_PENGUMUMAN, BUCKET_LAPAK } from "@/lib/batas-berkas-unggah";
import { POLA_UUID } from "@/lib/uuid-tenant";

const BUCKET_SAH = new Set([BUCKET_GALERI, BUCKET_LAMPIRAN_PENGUMUMAN, BUCKET_LAPAK]);

export type HasilUnggahPublik = {
  path: string;
  urlPublik: string;
};

function pathDariUrlPublik(urlPublik: string, bucket: string): string | null {
  if (!urlPublik || !BUCKET_SAH.has(bucket)) return null;
  try {
    const parsed = new URL(urlPublik);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    const path = decodeURIComponent(parsed.pathname.slice(idx + marker.length));
    if (!path || path.includes("..") || path.startsWith("/") || path.includes("\\")) return null;
    return path;
  } catch {
    return null;
  }
}

export async function unggahBerkasPublik(
  admin: SupabaseClient,
  bucket: string,
  rtId: string,
  buffer: Buffer,
  contentType: string,
  ekstensi: string,
): Promise<HasilUnggahPublik | { error: string }> {
  if (!BUCKET_SAH.has(bucket) || !POLA_UUID.test(rtId)) {
    return { error: "Penyimpanan berkas tidak valid." };
  }
  const path = `${rtId}/${uuidv4()}.${ekstensi}`;
  const { error } = await admin.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) {
    return { error: "Gagal mengunggah berkas ke penyimpanan." };
  }
  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    await admin.storage.from(bucket).remove([path]);
    return { error: "URL berkas gagal diterbitkan." };
  }
  return { path, urlPublik: data.publicUrl };
}

export async function unggahBerkasPublikKePath(
  admin: SupabaseClient,
  bucket: string,
  path: string,
  buffer: Buffer,
  contentType: string,
  opsi?: { timpa?: boolean },
): Promise<HasilUnggahPublik | { error: string }> {
  if (!BUCKET_SAH.has(bucket) || !path || path.includes("..") || path.startsWith("/") || path.includes("\\")) {
    return { error: "Penyimpanan berkas tidak valid." };
  }
  const { error } = await admin.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: Boolean(opsi?.timpa),
  });
  if (error) return { error: "Gagal mengunggah berkas ke penyimpanan." };
  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    await admin.storage.from(bucket).remove([path]);
    return { error: "URL berkas gagal diterbitkan." };
  }
  return { path, urlPublik: data.publicUrl };
}

export async function hapusBerkasPublikDariUrl(
  admin: SupabaseClient,
  bucket: string,
  urlPublik: string | null | undefined,
  rtId: string,
): Promise<void> {
  if (!urlPublik || !BUCKET_SAH.has(bucket) || !POLA_UUID.test(rtId)) return;
  const path = pathDariUrlPublik(urlPublik, bucket);
  if (!path) return;
  const milikTenant = path.startsWith(`${rtId}/`) || !path.includes("/");
  if (!milikTenant) return;
  const daftarHapus = [path];
  if (/\.pdf$/i.test(path)) daftarHapus.push(path.replace(/\.pdf$/i, ".thumb.jpg"));
  const { error } = await admin.storage.from(bucket).remove(daftarHapus);
  if (error) console.error("Gagal menghapus berkas storage:", error.message);
}
