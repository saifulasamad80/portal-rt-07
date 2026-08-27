import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export async function POST(req: Request) {
  try {
    // INJEKSI MUTLAK: Terima parameter newPin jika dikirim oleh frontend
    const { nik, pin, newPin } = await req.json();
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { data: warga, error } = await supabase
      .from("warga")
      .select("*")
      .eq("nik", nik)
      .single();

    if (error || !warga) {
      return NextResponse.json({ success: false, message: "NIK tidak terdaftar di sistem kami." }, { status: 401 });
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

    if (!isMatch) {
      return NextResponse.json({ success: false, message: "PIN yang Anda masukkan salah!" }, { status: 401 });
    }

    // -------------------------------------------------------------
    // INJEKSI MUTLAK: PROTOKOL PEMAKSAAN GANTI PIN (FORCE CHANGE)
    // -------------------------------------------------------------
    const pinLemah = ["123456", "111111", "000000", "654321", "121212", "123123"];

    // 1. Jika PIN yang dipakai terdeteksi Lemah/Default, DAN warga BELUM masukin PIN Baru
    if (pinLemah.includes(pin) && !newPin) {
      return NextResponse.json({ 
        success: false, 
        requirePinChange: true, // FLAG PENJEBAK FRONTEND
        message: "SISTEM KEAMANAN: Anda sedang menggunakan PIN Default. Wajib membuat PIN Baru sebelum mengakses portal." 
      });
    }

    // 2. Jika warga mengirim PIN Baru
    if (newPin) {
      if (pinLemah.includes(newPin)) {
        return NextResponse.json({ success: false, message: "PIN Baru Anda terlalu mudah ditebak! Hindari angka berurutan/berulang." }, { status: 400 });
      }
      if (newPin.length !== 6) {
        return NextResponse.json({ success: false, message: "PIN Baru harus tepat 6 digit angka." }, { status: 400 });
      }

      // Hancurkan PIN Baru jadi Bcrypt dan simpan ke DB
      const hashedNewPin = await bcrypt.hash(newPin, 10);
      await supabase.from("warga").update({ pin: hashedNewPin }).eq("id", warga.id);
    } 
    // 3. Jika aman-aman saja tapi kebetulan DB masih nyimpen plaintext, upgrade diam-diam.
    else if (isLegacyPlaintext) {
      const hashedPin = await bcrypt.hash(pin, 10);
      await supabase.from("warga").update({ pin: hashedPin }).eq("id", warga.id);
    }
    // -------------------------------------------------------------

    // Tiket JWT baru diterbitkan jika berhasil melewati semua jebakan di atas
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