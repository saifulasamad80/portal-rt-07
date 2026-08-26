export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("warga_session")?.value;
    if (!token) return NextResponse.json({ error: "Tidak ada sesi aktif" }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET); 
    return NextResponse.json({ success: true, warga: payload });
  } catch (error) {
    return NextResponse.json({ error: "Sesi tidak valid atau kedaluwarsa" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nik, password } = body;

    // 1. Tarik data warga secara langsung (Bypass RPC)
    const { data: warga, error: errWarga } = await supabaseAdmin
      .from("warga")
      .select("id, nama_lengkap, nik, pin, rt_id, percobaan_gagal, terkunci_sampai")
      .eq("nik", nik)
      .maybeSingle();

    if (errWarga || !warga) {
      return NextResponse.json({ success: false, error: "Akses Ditolak! NIK tidak terdaftar." }, { status: 401 });
    }

    // 2. CEK TAMENG BRUTE FORCE (Apakah sedang dikunci?)
    if (warga.terkunci_sampai && new Date(warga.terkunci_sampai) > new Date()) {
      return NextResponse.json({ success: false, error: "🚨 AKUN TERKUNCI: Anda telah gagal 5x. Silakan coba lagi dalam 15 menit untuk mencegah peretasan." }, { status: 429 });
    }

    // 3. VALIDASI PIN
    if (warga.pin !== password) {
      const gagalSekarang = (warga.percobaan_gagal || 0) + 1;
      let updateData: any = { percobaan_gagal: gagalSekarang };
      let pesanError = `PIN salah! (Percobaan ${gagalSekarang}/5)`;
      
      // Jika nyampe 5x, cor pintunya 15 Menit ke depan
      if (gagalSekarang >= 5) {
        updateData.terkunci_sampai = new Date(Date.now() + 15 * 60000).toISOString();
        pesanError = "🚨 SYSTEM LOCKDOWN: Anda gagal 5x berturut-turut. Akun dikunci otomatis selama 15 menit.";
      }
      
      await supabaseAdmin.from("warga").update(updateData).eq("id", warga.id);
      return NextResponse.json({ success: false, error: pesanError }, { status: 401 });
    }

    // 4. JIKA LOGIN SUKSES - Hancurkan jejak kegagalan & gembok
    await supabaseAdmin.from("warga").update({ percobaan_gagal: 0, terkunci_sampai: null }).eq("id", warga.id);

    if (!warga.rt_id) {
      return NextResponse.json({ success: false, error: "Konfigurasi Akun Gagal: RT ID tidak ditemukan." }, { status: 403 });
    }

    // 5. Cetak Tiket JWT
    const token = await new SignJWT({ id: warga.id, nama: warga.nama_lengkap, nik: warga.nik, role: "warga", rt_id: warga.rt_id })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    const response = NextResponse.json({ success: true, warga: warga });
    response.cookies.set("warga_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24, path: "/" });
    return response;

  } catch (err: any) {
    return NextResponse.json({ success: false, error: "Kesalahan internal server." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set("warga_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/" });
  return response;
}