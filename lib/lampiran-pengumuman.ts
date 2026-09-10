export function adalahUrlDrive(url: string | null | undefined) {
  return Boolean(url && url.includes("drive.google.com"));
}

export function adalahUrlGambar(url: string | null | undefined) {
  return Boolean(url && /\.(jpe?g|png|webp)(\?|#|$)/i.test(url));
}

export function adalahUrlPdf(url: string | null | undefined) {
  return Boolean(url && /\.pdf(\?|#|$)/i.test(url));
}

export function urlThumbnailPdf(urlPdf: string) {
  return urlPdf.replace(/\.pdf(?=$|[?#])/i, ".thumb.jpg");
}

export function urlApiThumbnailPdf(urlPdf: string) {
  return `/api/thumbnail-pdf?u=${encodeURIComponent(urlPdf)}`;
}

export function labelAksiLampiran(url: string | null | undefined) {
  if (!url) return "Buka lampiran";
  if (adalahUrlDrive(url)) return "Buka tautan lama";
  if (adalahUrlPdf(url)) return "Unduh PDF";
  if (adalahUrlGambar(url)) return "Lihat foto";
  return "Buka lampiran";
}
