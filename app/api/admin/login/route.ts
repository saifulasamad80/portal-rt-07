import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { SignJWT } from "jose";

// Menggunakan variable lingkungan (env) yang aman di sisi server
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Menggunakan Service Role Key untuk operasi server-side yang aman
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables in server-side.");
}

// Inisialisasi Supabase Client sisi server dengan Service Role Key (Bypass RLS hanya untuk fungsi verifikasi internal)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // 1. Validasi input dasar
    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan Password wajib diisi!" },
        { status: 400 }
      );
    }

    // 2. Eksekusi RPC verifikasi_login_admin di database (Password diverifikasi secara kriptografis menggunakan bcrypt)
    const { data, error } = await supabaseAdmin.rpc("verifikasi_login_admin", {
      p_username: username,
      p_password: password,
    });

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: "Terjadi kesalahan internal pada server database." },
        { status: 500 }
      );
    }

    const hasilLogin = data[0];

    // Jika login_valid bernilai false, kembalikan respon akses ditolak
    if (!hasilLogin.login_valid) {
      return NextResponse.json(
        { error: "Akses Ditolak! Username atau Password salah." },
        { status: 401 }
      );
    }

    // 3. Buat Payload JWT Sesi Kustom
    const jwtPayload = {
      sub: hasilLogin.id,
      nama: hasilLogin.nama_lengkap,
      jabatan: hasilLogin.jabatan,
      role: "admin",
    };

    // Tanda tangani JWT menggunakan library 'jose' (Native di Next.js Edge runtime)
    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT(jwtPayload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h") // Sesi kadaluarsa dalam 2 jam
      .sign(secretKey);

    // 4. Konfigurasi HttpOnly Cookie untuk melindungi token dari serangan XSS (Cross-Site Scripting)
    const cookieOptions = {
      httpOnly: true, // Memblokir akses Javascript client-side (Mencegah pencurian token via XSS)
      secure: process.env.NODE_ENV === "production", // Wajib HTTPS di lingkungan produksi
      sameSite: "strict", // Memblokir pengiriman cookie lintas situs (Mencegah serangan CSRF)
      maxAge: 60 * 60 * 2, // 2 jam (Sesuai masa aktif token)
      path: "/", // Berlaku untuk seluruh rute aplikasi
    } as const;

    // 5. Susun respon sukses
    const response = NextResponse.json({
      success: true,
      user: {
        id: hasilLogin.id,
        nama: hasilLogin.nama_lengkap,
        jabatan: hasilLogin.jabatan,
      },
    });

    // Tempelkan cookie ke respon
    response.cookies.set("admin_session", token, cookieOptions);

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server Error: " + err.message },
      { status: 500 }
    );
  }
}

// Endpoint GET untuk membersihkan cookie saat logout
export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Berhasil keluar sesi." });
  
  // Hapus cookie admin_session dengan menyetel masa aktif ke 0
  response.cookies.set("admin_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0, // Segera hapus cookie
    path: "/",
  });
  return response;
}