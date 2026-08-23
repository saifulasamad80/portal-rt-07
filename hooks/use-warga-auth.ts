"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface WargaSession {
  id: string;
  nama: string;
  no_whatsapp: string;
  alamat: string;
  role: "warga";
}

export function useWargaAuth() {
  const [wargaAktif, setWargaAktif] = useState<WargaSession | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Sinkronisasi status sesi dengan server HttpOnly cookie secara berkala/on mount
  const checkSession = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/login");
      if (response.ok) {
        const data = await response.json();
        setWargaAktif(data.warga);
      } else {
        setWargaAktif(null);
        // Proteksi Halaman Dalam Portal Warga (Contoh rute sub-modul warga: /portal/*)
        if (pathname.startsWith("/portal") && pathname !== "/login") {
          router.push("/login"); // Mengalihkan warga ke halaman login umum warga jika tidak terotentikasi
        }
      }
    } catch (error) {
      console.error("Gagal melakukan pengecekan sesi warga:", error);
      setWargaAktif(null);
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  /**
   * Mengirimkan request login terenkripsi ke sisi server
   */
  const login = async (nik: string, password_plain: string) => {
    try {
      const response = await fetch("/api/portal/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nik, password: password_plain }),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Otentikasi Gagal" };
      }

      setWargaAktif(result.warga);
      router.push("/portal"); // Alihkan ke beranda warga mandiri jika berhasil
      return { success: true };
    } catch (error) {
      return { success: false, error: "Gagal terhubung dengan server" };
    }
  };

  /**
   * Menghapus sesi HttpOnly warga di server dan redirect ke halaman depan
   */
  const logout = async () => {
    try {
      const response = await fetch("/api/portal/login", {
        method: "DELETE",
      });

      if (response.ok) {
        setWargaAktif(null);
        router.push("/login");
      } else {
        alert("Gagal menghapus sesi!");
      }
    } catch (error) {
      console.error("Gagal melakukan proses keluar sesi:", error);
    }
  };

  return {
    wargaAktif,
    loading,
    login,
    logout,
    checkSession,
  };
}