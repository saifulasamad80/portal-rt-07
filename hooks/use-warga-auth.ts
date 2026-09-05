"use client";

import { useState, useEffect, useCallback } from "react";

export interface WargaSession {
  id: string;
  nama: string;
  nik?: string; 
  role: "warga";
  [key: string]: any; 
}

export function useWargaAuth() {
  const [wargaAktif, setWargaAktif] = useState<WargaSession | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const timestamp = new Date().getTime();
      // FAKTA: Cache Buster brutal dengan kredensial inklusif
      const response = await fetch(`/api/warga/login?t=${timestamp}`, { 
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setWargaAktif(data.warga);
      } else {
        // FAKTA: Fungsi tendangan otomatis GUA HAPUS. Kalau gagal baca cookie, 
        // lu hanya akan mentok di layar "Akses Ilegal", BUKAN terlempar balik ke /login.
        setWargaAktif(null);
      }
    } catch (error) {
      console.error("Gagal melakukan pengecekan sesi:", error);
      setWargaAktif(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (nik: string, password_plain: string) => {
    try {
      const response = await fetch("/api/warga/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ nik, pin: password_plain }),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Otentikasi Gagal" };
      }

      setWargaAktif(result.warga);
      window.location.href = "/portal"; 
      return { success: true };
    } catch (error) {
      return { success: false, error: "Gagal terhubung ke server" };
    }
  };

  const logout = async () => {
    try {
      const response = await fetch("/api/warga/login", {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        setWargaAktif(null);
        window.location.href = "/login";
      } else {
        alert("Gagal menghapus sesi!");
      }
    } catch (error) {
      console.error("Logout gagal:", error);
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