"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface AdminProfile {
  id: string;
  nama: string;
  jabatan: string;
}

/**
 * Custom React Hook useAdminAuth
 * Mengamankan state otentikasi pengurus RT di tingkat client-side, 
 * mensinkronisasikannya dengan sesi HttpOnly JWT di server, serta menangani redirect otomatis.
 */
export function useAdminAuth() {
  const [adminAktif, setAdminAktif] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Memeriksa status sesi aktif dari server secara berkala / saat mount
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/login", { 
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setAdminAktif(data.user);
      } else {
        setAdminAktif(null);
        // Proteksi rute dalam: Jika di /admin/* (kecuali /admin login utama), lempar ke halaman login
        if (pathname.startsWith("/admin") && pathname !== "/admin") {
          router.push("/admin");
        }
      }
    } catch (err) {
      console.error("[Auth] Gagal sinkronisasi sesi keamanan:", err);
      setAdminAktif(null);
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  // Eksekusi Login Admin via API Route Handlers
  const login = async (usernameInput: string, passwordInput: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Autentikasi gagal");
      }

      setAdminAktif(result.user);
      router.push("/admin");
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Eksekusi Hapus Sesi (Logout) secara Aman
  const logout = async () => {
    const konfirmasi = confirm("Tutup Pusat Komando dan keluar dari sesi?");
    if (!konfirmasi) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", { method: "DELETE" });
      if (res.ok) {
        setAdminAktif(null);
        router.push("/admin");
      } else {
        alert("Gagal menghapus sesi aktif di server.");
      }
    } catch (err) {
      console.error("[Auth] Kegagalan sistem saat logout:", err);
    } finally {
      setLoading(false);
    }
  };

  // Sinkronisasi Sesi saat komponen di-load
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return {
    adminAktif,
    loading,
    login,
    logout,
    refreshSession: checkSession,
  };
}