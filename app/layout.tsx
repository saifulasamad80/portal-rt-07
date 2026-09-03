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

// INJEKSI MUTLAK: Deklarasi PWA Manifest & Open Graph (Preview WhatsApp) digabung!
export const metadata: Metadata = {
  metadataBase: new URL("https://wargaku-six.vercel.app"), // INJEKSI MUTLAK: Hilangkan Warning Build
  title: "Portal Warga",
  description: "Sistem Informasi Terpadu dan Layanan Mandiri Warga",
  manifest: "/manifest.json", // KUNCI MUTLAK PWA TETAP AMAN
  openGraph: {
    title: "Portal Warga",
    description: "Sistem Informasi Terpadu dan Layanan Mandiri Warga",
    url: "https://wargaku-six.vercel.app", 
    siteName: "Portal Warga",
    images: [
      {
        url: "/og-image.jpeg", // UBAH KE .png JIKA FORMAT GAMBAR LU PNG
        width: 1200,
        height: 630,
        alt: "Preview Portal Warga",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
};

// REFACTOR MUTLAK: Kunci Tema Terang (Anti-Dark Mode Inversion)
export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  colorScheme: "light", // MENCEGAH HP ME-REVERSE WARNA SECARA PAKSA!
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