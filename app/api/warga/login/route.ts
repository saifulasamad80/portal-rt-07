import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(req: Request) {
  try {
    const { nik, pin, newPin } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    let { data: warga, error } = await supabase
      .from("warga")
      .select("id, nik, nama_lengkap, rt_id, pin, status_verifikasi, status_aktif, percobaan_gagal, terkunci_sampai")
      .eq("nik", nik)
      .single();

    if (error && (error.message || "").toLowerCase().includes("status_aktif")) {
      const ulang = await supabase
        .from("warga")
        .select("id, nik, nama_lengkap, rt_id, pin, status_verifikasi, percobaan_gagal, terkunci_sampai")
        .eq("nik", nik)
        .single();
      warga = ulang.data as any;
      error = ulang.error;
    }

    if (error || !warga) return NextResponse.json({ success: false, message: "NIK tidak terdaftar di sistem." }, { status: 401 });

    if (warga.terkunci_sampai && new Date(warga.terkunci_sampai) > new Date()) {
      return NextResponse.json({ success: false, message: "🚨 SYSTEM LOCKDOWN: Akun dikunci. Coba lagi 15 menit ke depan." }, { status: 429 });
    }

    if (warga.status_verifikasi === "Menunggu") return NextResponse.json({ success: false, message: "AKSES DITOLAK: Pendaftaran masih dalam antrean." }, { status: 403 });
    if (warga.status_verifikasi === "Ditolak") return NextResponse.json({ success: false, message: "AKSES DITOLAK: Pendaftaran ditolak RT." }, { status: 403 });
    if (warga.status_aktif === false) return NextResponse.json({ success: false, message: "AKSES DITOLAK: Akun ini sudah dinonaktifkan (arsip kependudukan)." }, { status: 403 });

    let isMatch = false;
    let isLegacyPlaintext = false;

    if (warga.pin.startsWith("$2a$") || warga.pin.startsWith("$2b$")) {
      isMatch = await bcrypt.compare(pin, warga.pin);
    } else {
      if (warga.pin === pin) { isMatch = true; isLegacyPlaintext = true; }
    }

    if (!isMatch) {
      const gagalSekarang = (warga.percobaan_gagal || 0) + 1;
      let updateData: any = { percobaan_gagal: gagalSekarang };
      let pesanError = `PIN salah! (Percobaan ${gagalSekarang}/5)`;
      
      if (gagalSekarang >= 5) {
        updateData.terkunci_sampai = new Date(Date.now() + 15 * 60000).toISOString();
        pesanError = "🚨 SYSTEM LOCKDOWN: Gagal 5x. Akun dikunci 15 menit.";
      }
      await supabase.from("warga").update(updateData).eq("id", warga.id);
      return NextResponse.json({ success: false, message: pesanError }, { status: 401 });
    }

    const pinLemah = ["123456", "111111", "000000", "654321", "121212", "123123"];
    if (pinLemah.includes(pin) && !newPin) {
      return NextResponse.json({ success: false, requirePinChange: true, message: "SISTEM KEAMANAN: Wajib membuat PIN Baru sebelum mengakses portal." });
    }

    // ----------------------------------------------------------------------
    // INJEKSI MUTLAK: OPTIMASI KINERJA (BYPASS DATABASE WRITE JIKA TIDAK PERLU)
    // ----------------------------------------------------------------------
    const butuhUpdate = newPin || isLegacyPlaintext || warga.percobaan_gagal > 0 || warga.terkunci_sampai;

    if (butuhUpdate) {
      const updatePayload: any = { percobaan_gagal: 0, terkunci_sampai: null };
      if (newPin) updatePayload.pin = await bcrypt.hash(newPin, 10);
      else if (isLegacyPlaintext) updatePayload.pin = await bcrypt.hash(pin, 10);
      
      await supabase.from("warga").update(updatePayload).eq("id", warga.id);
    }

    const token = await new SignJWT({ id: warga.id, nik: warga.nik, nama: warga.nama_lengkap, rt_id: warga.rt_id })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(JWT_SECRET);

    const response = NextResponse.json({ success: true, message: "Login berhasil!" });
    response.cookies.set("warga_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Server Error: " + error.message }, { status: 500 });
  }
}