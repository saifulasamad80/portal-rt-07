import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { SignJWT } from "jose";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables in server-side.");
}

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

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan Password wajib diisi!" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.rpc("verifikasi_login_admin", {
      p_username: username,
      p_password: password,
    });

    // ==========================================
    // MATA DEWA: CETAK ERROR ASLI KE TERMINAL!
    // ==========================================
    if (error) {
      console.error("\n[X] SUPABASE RPC ERROR BUNG:", error);
    }

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: "Terjadi kesalahan internal pada server database." },
        { status: 500 }
      );
    }

    const hasilLogin = data[0];

    if (!hasilLogin.login_valid) {
      return NextResponse.json(
        { error: "Akses Ditolak! Username atau Password salah." },
        { status: 401 }
      );
    }

    // INJEKSI MULTI-TENANT: Ambil rt_id pengurus langsung dari tabel pengurus_rt
    const { data: pengurusData, error: errPengurus } = await supabaseAdmin
      .from("pengurus_rt")
      .select("rt_id")
      .eq("id", hasilLogin.id)
      .single();

    if (errPengurus) {
      console.error("\n[X] ERROR GET PENGURUS RT:", errPengurus);
    }

    if (!pengurusData || !pengurusData.rt_id) {
      return NextResponse.json(
        { error: "Konfigurasi Akun Gagal: RT ID tidak ditemukan." },
        { status: 403 }
      );
    }

    // Buat Payload JWT Sesi Kustom dengan rt_id tersemat aman
    const jwtPayload = {
      sub: hasilLogin.id,
      nama: hasilLogin.nama_lengkap,
      jabatan: hasilLogin.jabatan,
      role: "admin",
      rt_id: pengurusData.rt_id, // DNA TENANT RESMI MASUK KE JWT
    };

    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT(jwtPayload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(secretKey);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 2,
      path: "/",
    } as const;

    const response = NextResponse.json({
      success: true,
      user: {
        id: hasilLogin.id,
        nama: hasilLogin.nama_lengkap,
        jabatan: hasilLogin.jabatan,
        rt_id: pengurusData.rt_id,
      },
    });

    response.cookies.set("admin_session", token, cookieOptions);

    return response;
  } catch (err: any) {
    console.error("\n[X] FATAL SERVER ERROR:", err);
    return NextResponse.json(
      { error: "Server Error: " + err.message },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Berhasil keluar sesi." });
  
  response.cookies.set("admin_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return response;
}