import type { Metadata } from "next";
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

// ANTI-TEMPLATE: Metadata resmi RT 07
export const metadata: Metadata = {
  title: "Portal Digital RT 07",
  description: "Sistem Informasi Terpadu dan Layanan Mandiri Warga RT 07",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id" // Ubah ke bahasa Indonesia untuk SEO/Accessibility
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* ANTI-LANDMARK ERROR: Bungkus children dengan tag <main> */}
        <main className="flex-1 flex flex-col w-full">{children}</main>
      </body>
    </html>
  );
}