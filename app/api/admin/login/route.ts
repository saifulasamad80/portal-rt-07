import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "Username dan Password wajib diisi!" }, { status: 400 });
    }

    const { data: admin, error: errAdmin } = await supabaseAdmin
      .from("pengurus_rt")
      .select("id, nama_lengkap, jabatan, password, rt_id, percobaan_gagal, terkunci_sampai")
      .or(`username.eq.${username},email.eq.${username}`)
      .maybeSingle();

    if (errAdmin || !admin) {
      return NextResponse.json({ error: "Akses Ditolak! Username atau Email tidak terdaftar." }, { status: 401 });
    }

    if (admin.terkunci_sampai && new Date(admin.terkunci_sampai) > new Date()) {
      return NextResponse.json({ error: "🚨 SYSTEM LOCKDOWN: Akun dikunci karena aktivitas mencurigakan. Coba lagi 15 menit ke depan." }, { status: 429 });
    }

    // INJEKSI MUTLAK: Sistem Validasi & Seamless Upgrade (C1 Fix)
    let isMatch = false;
    let isLegacyPlaintext = false;

    if (admin.password.startsWith("$2a$") || admin.password.startsWith("$2b$")) {
      isMatch = await bcrypt.compare(password, admin.password);
    } else {
      if (admin.password === password) {
        isMatch = true;
        isLegacyPlaintext = true;
      }
    }

    if (!isMatch) {
      const gagalSekarang = (admin.percobaan_gagal || 0) + 1;
      let updateData: any = { percobaan_gagal: gagalSekarang };
      let pesanError = `Password salah! (Percobaan ${gagalSekarang}/5)`;
      
      if (gagalSekarang >= 5) {
        updateData.terkunci_sampai = new Date(Date.now() + 15 * 60000).toISOString();
        pesanError = "🚨 SYSTEM LOCKDOWN: Anda gagal 5x berturut-turut. Akun dikunci otomatis selama 15 menit.";
      }
      
      await supabaseAdmin.from("pengurus_rt").update(updateData).eq("id", admin.id);
      return NextResponse.json({ error: pesanError }, { status: 401 });
    }

    // Buka gembok & Upgrade Password diam-diam jika masih plaintext
    const updatePayload: any = { percobaan_gagal: 0, terkunci_sampai: null };
    if (isLegacyPlaintext) updatePayload.password = await bcrypt.hash(password, 10);
    await supabaseAdmin.from("pengurus_rt").update(updatePayload).eq("id", admin.id);

    if (!admin.rt_id) {
      return NextResponse.json({ error: "Konfigurasi Akun Gagal: RT ID tidak ditemukan." }, { status: 403 });
    }

    const jwtPayload = { sub: admin.id, nama: admin.nama_lengkap, jabatan: admin.jabatan, role: "admin", rt_id: admin.rt_id };
    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT(jwtPayload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h").sign(secretKey);

    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 60 * 60 * 2, path: "/" } as const;
    const response = NextResponse.json({ success: true, user: { id: admin.id, nama: admin.nama_lengkap, jabatan: admin.jabatan, rt_id: admin.rt_id } });
    response.cookies.set("admin_session", token, cookieOptions);
    return response;

  } catch (err: any) {
    return NextResponse.json({ error: "Server Error: " + err.message }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Berhasil keluar sesi." });
  response.cookies.set("admin_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 0, path: "/" });
  return response;
}