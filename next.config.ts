import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["web-push", "pdfjs-dist", "@napi-rs/canvas"],
  images: {
    qualities: [70, 75, 80],
  },
  experimental: {
    // PDF ~1,5 MB dikirim sebagai data URL (base64 ≈ 2 MB) dari form pengumuman.
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
