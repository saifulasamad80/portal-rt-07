import "server-only";

import { BATAS_BYTE_FOTO, BATAS_BYTE_PDF, BATAS_DATA_URL_FOTO, BATAS_DATA_URL_PDF } from "@/lib/batas-berkas-unggah";

export type BerkasGambar = {
  jenis: "gambar";
  buffer: Buffer;
  contentType: "image/jpeg";
  ekstensi: "jpg";
};

export type BerkasPdf = {
  jenis: "pdf";
  buffer: Buffer;
  contentType: "application/pdf";
  ekstensi: "pdf";
};

export type BerkasLampiran = BerkasGambar | BerkasPdf;

function magicJpeg(buffer: Buffer) {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function magicPdf(buffer: Buffer) {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function parseDataUrl(value: unknown, maksDataUrl: number): { mime: string; buffer: Buffer } | null {
  if (typeof value !== "string" || !value.startsWith("data:")) return null;
  if (value.length > maksDataUrl) return null;
  const match = value.match(/^data:(image\/jpeg|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match || match[2].length === 0 || match[2].length % 4 !== 0) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) return null;
  return { mime: match[1].toLowerCase(), buffer };
}

export function parseDataUrlGambar(value: unknown): BerkasGambar | { error: string } {
  const parsed = parseDataUrl(value, BATAS_DATA_URL_FOTO);
  if (!parsed) return { error: "Foto tidak valid atau masih terlalu besar setelah kompresi." };
  if (parsed.mime !== "image/jpeg" || parsed.buffer.length > BATAS_BYTE_FOTO || !magicJpeg(parsed.buffer)) {
    return { error: "Foto harus JPEG hasil kompresi dan tidak boleh melebihi 200 KB." };
  }
  return { jenis: "gambar", buffer: parsed.buffer, contentType: "image/jpeg", ekstensi: "jpg" };
}

export function parseDataUrlLampiran(value: unknown): BerkasLampiran | { error: string } {
  if (typeof value !== "string" || !value.startsWith("data:")) {
    return { error: "Lampiran tidak valid." };
  }
  if (value.startsWith("data:image/jpeg")) {
    return parseDataUrlGambar(value);
  }
  if (!value.startsWith("data:application/pdf")) {
    return { error: "Lampiran harus foto JPEG hasil kompresi atau PDF." };
  }
  const parsed = parseDataUrl(value, BATAS_DATA_URL_PDF);
  if (!parsed) return { error: "Lampiran PDF tidak valid atau melebihi 1,5 MB." };
  if (parsed.mime !== "application/pdf" || parsed.buffer.length > BATAS_BYTE_PDF || !magicPdf(parsed.buffer)) {
    return { error: "PDF tidak sah atau melebihi 1,5 MB. Foto surat akan dikompres otomatis." };
  }
  return { jenis: "pdf", buffer: parsed.buffer, contentType: "application/pdf", ekstensi: "pdf" };
}
