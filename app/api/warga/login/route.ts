import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export async function POST(req: Request) {
  try {
    const { nik, pin } = await req.json();
    
    // Gunakan Jalur Dewa untuk bypass RLS saat login
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Cari warga berdasarkan NIK
    const { data: warga, error } = await supabase
      .from("warga")
      .select("*")
      .eq("nik", nik)
      .single();

    if (error || !warga) {
      return NextResponse.json({ success: false, message: "NIK tidak terdaftar di sistem kami." }, { status: 401 });
    }

    // -------------------------------------------------------------
    // INJEKSI MUTLAK: GEMBOK STATUS VALIDASI RT (HASIL UAT)
    // -------------------------------------------------------------
    if (warga.status_verifikasi === "Menunggu") {
      return NextResponse.json({ 
        success: false, 
        message: "AKSES DITOLAK: Pendaftaran Anda masih dalam antrean. Silakan tunggu Pengurus RT memvalidasi data Anda." 
      }, { status: 403 });
    }

    if (warga.status_verifikasi === "Ditolak") {
      return NextResponse.json({ 
        success: false, 
        message: "AKSES DITOLAK: Pendaftaran Anda ditolak oleh Pengurus RT. Silakan hubungi Ketua RT." 
      }, { status: 403 });
    }
    // -------------------------------------------------------------

    // Verifikasi PIN
    if (warga.pin !== pin) {
      return NextResponse.json({ success: false, message: "PIN yang Anda masukkan salah!" }, { status: 401 });
    }

    // Jika status "Disetujui" dan PIN benar, cetak Kartu Akses (JWT)
    const token = await new SignJWT({ 
      id: warga.id, 
      nik: warga.nik, 
      nama: warga.nama_lengkap, 
      rt_id: warga.rt_id 
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d") // Sesi aktif 7 hari
      .sign(JWT_SECRET);

    const response = NextResponse.json({ success: true, message: "Login berhasil!" });
    
    // Tanam token di Cookies HP/Laptop warga
    response.cookies.set("warga_session", token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production", 
      path: "/",
      maxAge: 60 * 60 * 24 * 7 // 7 Hari
    });
    
    return response;
    
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Terjadi kesalahan server: " + error.message }, { status: 500 });
  }
}