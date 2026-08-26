import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// INJEKSI MUTLAK: Deklarasi PWA Manifest
export const metadata: Metadata = {
  title: "Portal Digital RT 07",
  description: "Sistem Informasi Terpadu dan Layanan Mandiri Warga RT 07",
  manifest: "/manifest.json", 
};

// INJEKSI MUTLAK: Viewport wajib untuk aplikasi Mobile
export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
        {/* MESIN PWA: Pendaftaran Service Worker */}
        <script
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
      </body>
    </html>
  );
}