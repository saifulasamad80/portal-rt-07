import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import AjakanPasangAplikasi from "@/components/AjakanPasangAplikasi";
import InisialisasiOneSignal from "@/components/InisialisasiOneSignal";
import PesanDialogProvider from "@/components/PesanDialogProvider";
import PemberitahuanCookie from "@/components/PemberitahuanCookie";
import { ONESIGNAL_SDK_URL } from "@/lib/onesignal";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://wargaku-six.vercel.app"),
  title: "Portal Warga",
  description: "Sistem Informasi Terpadu dan Layanan Mandiri Warga",
  applicationName: "Portal Warga",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Portal Warga",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Portal Warga",
    description: "Sistem Informasi Terpadu dan Layanan Mandiri Warga",
    url: "https://wargaku-six.vercel.app",
    siteName: "Portal Warga",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Portal Warga",
    description: "Sistem Informasi Terpadu dan Layanan Mandiri Warga",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {process.env.NODE_ENV === "production" ? (
          <>
            <Script
              id="onesignal-antrian"
              strategy="beforeInteractive"
              dangerouslySetInnerHTML={{
                __html: "window.OneSignalDeferred=window.OneSignalDeferred||[];",
              }}
            />
            <Script id="onesignal-sdk" src={ONESIGNAL_SDK_URL} strategy="afterInteractive" />
          </>
        ) : null}
        <Script
          id="pwa-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) { console.log('PWA Service Worker sukses terdaftar'); },
                    function(err) { console.log('PWA Service Worker gagal: ', err); }
                  );
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <main className="flex-1 flex flex-col w-full">{children}</main>
        <AjakanPasangAplikasi />
        <InisialisasiOneSignal />
        <PesanDialogProvider />
        <PemberitahuanCookie />
      </body>
    </html>
  );
}
