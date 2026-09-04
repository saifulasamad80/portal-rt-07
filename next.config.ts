import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["web-push"],
  images: {
    qualities: [70, 75, 80],
  },
};

export default nextConfig;
