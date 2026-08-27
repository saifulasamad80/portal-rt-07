import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// SECURITY FIX: Hapus string fallback!
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(req: Request) {
  try {
    const { nik, pin, newPin } = await req.json();
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // REFACTOR: Tarik juga kolom percobaan_gagal dan terkunci_sampai
    const { data: warga, error } = await supabase
      .from("warga")
      .select("id, nik, nama_lengkap, rt_id, pin, status_verifikasi, percobaan_gagal, terkunci_sampai")
      .eq("nik", nik)
      .single();

    if (error || !warga) {
      return NextResponse.json({ success: false, message: "NIK tidak terdaftar di sistem kami." }, { status: 401 });
    }

    // -------------------------------------------------------------
    // INJEKSI MUTLAK: SISTEM LOCKDOWN (ANTI BRUTE-FORCE)
    // -------------------------------------------------------------
    if (warga.terkunci_sampai && new Date(warga.terkunci_sampai) > new Date()) {
      return NextResponse.json({ success: false, message: "🚨 SYSTEM LOCKDOWN: Akun dikunci karena aktivitas mencurigakan. Coba lagi 15 menit ke depan." }, { status: 429 });
    }

    if (warga.status_verifikasi === "Menunggu") {
      return NextResponse.json({ success: false, message: "AKSES DITOLAK: Pendaftaran Anda masih dalam antrean validasi RT." }, { status: 403 });
    }

    if (warga.status_verifikasi === "Ditolak") {
      return NextResponse.json({ success: false, message: "AKSES DITOLAK: Pendaftaran Anda ditolak oleh Pengurus RT." }, { status: 403 });
    }

    let isMatch = false;
    let isLegacyPlaintext = false;

    if (warga.pin.startsWith("$2a$") || warga.pin.startsWith("$2b$")) {
      isMatch = await bcrypt.compare(pin, warga.pin);
    } else {
      if (warga.pin === pin) {
        isMatch = true;
        isLegacyPlaintext = true;
      }
    }

    // LOGIKA PENJEBAK: JIKA PIN SALAH
    if (!isMatch) {
      const gagalSekarang = (warga.percobaan_gagal || 0) + 1;
      let updateData: any = { percobaan_gagal: gagalSekarang };
      let pesanError = `PIN salah! (Percobaan ${gagalSekarang}/5)`;
      
      if (gagalSekarang >= 5) {
        // Kunci selama 15 Menit
        updateData.terkunci_sampai = new Date(Date.now() + 15 * 60000).toISOString();
        pesanError = "🚨 SYSTEM LOCKDOWN: Anda gagal 5x berturut-turut. Akun dikunci otomatis selama 15 menit.";
      }
      
      await supabase.from("warga").update(updateData).eq("id", warga.id);
      return NextResponse.json({ success: false, message: pesanError }, { status: 401 });
    }

    const pinLemah = ["123456", "111111", "000000", "654321", "121212", "123123"];

    if (pinLemah.includes(pin) && !newPin) {
      return NextResponse.json({ 
        success: false, 
        requirePinChange: true, 
        message: "SISTEM KEAMANAN: Anda sedang menggunakan PIN Default. Wajib membuat PIN Baru sebelum mengakses portal." 
      });
    }

    // LOGIKA PEMULIHAN: JIKA LOGIN SUKSES
    // Hancurkan status gagal sebelumnya & perbarui PIN jika ada
    const updatePayload: any = { percobaan_gagal: 0, terkunci_sampai: null };

    if (newPin) {
      if (pinLemah.includes(newPin)) {
        return NextResponse.json({ success: false, message: "PIN Baru Anda terlalu mudah ditebak! Hindari angka berurutan/berulang." }, { status: 400 });
      }
      if (newPin.length !== 6) {
        return NextResponse.json({ success: false, message: "PIN Baru harus tepat 6 digit angka." }, { status: 400 });
      }
      updatePayload.pin = await bcrypt.hash(newPin, 10);
    } else if (isLegacyPlaintext) {
      updatePayload.pin = await bcrypt.hash(pin, 10);
    }

    // Eksekusi Update ke Database Warga
    await supabase.from("warga").update(updatePayload).eq("id", warga.id);

    const token = await new SignJWT({ id: warga.id, nik: warga.nik, nama: warga.nama_lengkap, rt_id: warga.rt_id })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d") 
      .sign(JWT_SECRET);

    const response = NextResponse.json({ success: true, message: "Login berhasil!" });
    response.cookies.set("warga_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });
    
    return response;
    
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Terjadi kesalahan server: " + error.message }, { status: 500 });
  }
}