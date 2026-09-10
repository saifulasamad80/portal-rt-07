import { NextResponse } from "next/server";
import { BATAS_BYTE_PDF, BUCKET_LAMPIRAN_PENGUMUMAN } from "@/lib/batas-berkas-unggah";
import { jpegHalamanPertamaPdfServer } from "@/lib/thumbnail-pdf-server";

export const runtime = "nodejs";

function urlLampiranPdfSah(mentah: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(mentah);
  } catch {
    return null;
  }
  const asalProyek = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!asalProyek) return null;
  let asal: URL;
  try {
    asal = new URL(asalProyek);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.origin !== asal.origin) return null;
  if (parsed.username || parsed.password) return null;
  const prefix = `/storage/v1/object/public/${BUCKET_LAMPIRAN_PENGUMUMAN}/`;
  if (!parsed.pathname.startsWith(prefix)) return null;
  if (parsed.pathname.includes("..") || parsed.pathname.includes("//")) return null;
  if (!parsed.pathname.toLowerCase().endsWith(".pdf")) return null;
  return parsed;
}

export async function GET(request: Request) {
  const urlPdf = new URL(request.url).searchParams.get("u") || "";
  const sah = urlLampiranPdfSah(urlPdf);
  if (!sah) {
    return new NextResponse("Lampiran tidak sah.", { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const res = await fetch(sah, { redirect: "error", cache: "force-cache" });
    if (!res.ok) {
      return new NextResponse("PDF tidak ditemukan.", { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    const panjang = Number(res.headers.get("content-length") || "0");
    if (panjang > BATAS_BYTE_PDF) {
      return new NextResponse("PDF terlalu besar.", { status: 413, headers: { "Cache-Control": "no-store" } });
    }
    const pdf = Buffer.from(await res.arrayBuffer());
    if (pdf.length > BATAS_BYTE_PDF) {
      return new NextResponse("PDF terlalu besar.", { status: 413, headers: { "Cache-Control": "no-store" } });
    }
    const jpeg = await jpegHalamanPertamaPdfServer(pdf);
    if (!jpeg) {
      return new NextResponse("Thumbnail gagal dibuat.", { status: 422, headers: { "Cache-Control": "no-store" } });
    }
    return new NextResponse(Uint8Array.from(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("API thumbnail PDF gagal:", error);
    return new NextResponse("Thumbnail gagal dibuat.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
