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

    if (!token) {
      return NextResponse.json({ error: "Tidak ada sesi aktif" }, { status: 401 });
    }

    // PERBAIKAN MUTLAK: Pemanggilan jwtVerify yang bersih, no hack.
    const { payload } = await jwtVerify(token, JWT_SECRET); 
    return NextResponse.json({ success: true, warga: payload });
  } catch (error) {
    console.error("JWT Error:", error);
    return NextResponse.json({ error: "Sesi tidak valid atau kedaluwarsa" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nik, password } = body;

    const { data, error } = await supabaseAdmin.rpc("verifikasi_login_warga", {
      p_nik: nik,
      p_password: password
    });

    if (error) throw error;

    if (!data || data.length === 0 || !data[0].login_valid) {
      return NextResponse.json({ success: false, error: "NIK atau Password salah!" }, { status: 401 });
    }

    const warga = data[0];

    // INJEKSI MULTI-TENANT: Ambil rt_id warga langsung dari tabel warga
    const { data: wargaData } = await supabaseAdmin
      .from("warga")
      .select("rt_id")
      .eq("id", warga.id)
      .single();

    if (!wargaData || !wargaData.rt_id) {
      return NextResponse.json({ success: false, error: "Konfigurasi Akun Gagal: RT ID tidak ditemukan." }, { status: 403 });
    }

    const token = await new SignJWT({
      id: warga.id,
      nama: warga.nama_lengkap,
      nik: warga.nik,
      role: "warga",
      rt_id: wargaData.rt_id // DNA TENANT MASUK KE TOKEN WARGA
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    const response = NextResponse.json({ success: true, warga: warga });

    response.cookies.set("warga_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", 
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;

  } catch (err: any) {
    return NextResponse.json({ success: false, error: "Kesalahan internal server." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set("warga_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}