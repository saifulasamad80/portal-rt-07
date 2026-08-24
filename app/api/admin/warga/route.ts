import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";

// Ambil kunci rahasia dari environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

// Inisialisasi Supabase Admin (Bypass RLS khusus untuk API internal yang sudah divalidasi)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function GET(request: Request) {
  try {
    // 1. Pengecekan Keamanan: Pastikan yang mengakses API ini memiliki Cookie JWT Admin yang valid
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Akses Ditolak: Sesi tidak valid atau kedaluwarsa" }, { status: 401 });
    }

    // 2. Dekripsi dan Validasi JWT
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "admin") {
      return NextResponse.json({ error: "Akses Ditolak: Anda bukan pengurus RT" }, { status: 403 });
    }

    // 3. Tarik data pendaftar warga dari Supabase secara aman (Server-Side)
    const { data, error } = await supabaseAdmin
      .from("warga")
      .select("id, nik, nama_lengkap, no_whatsapp, status_tinggal, created_at")
      .eq("status_verifikasi", "Menunggu")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: "Terjadi kesalahan internal server: " + err.message }, { status: 500 });
  }
}