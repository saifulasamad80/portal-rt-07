import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SignJWT, jwtVerify } from "jose";

// Menggunakan service role key atau anon key di sisi server Next.js secara aman
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Gunakan service role untuk memanggil RPC keamanan bypass RLS SELECT
const supabase = createClient(supabaseUrl, supabaseServiceRole);

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "kunci-rahasia-portal-warga-rt07-super-ketat"
);

/**
 * POST /api/portal/login
 * Menangani otentikasi warga mandiri menggunakan NIK dan Password
 */
export async function POST(request: NextRequest) {
  try {
    const { nik, password } = await request.json();

    if (!nik || !password) {
      return NextResponse.json(
        { error: "NIK dan Password wajib diisi!" },
        { status: 400 }
      );
    }

    // Panggil RPC aman di server-side PostgreSQL
    const { data, error } = await supabase.rpc("verifikasi_login_warga", {
      p_nik: nik.trim(),
      p_password: password
    });

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: "Sistem mengalami kegagalan otentikasi database." },
        { status: 500 }
      );
    }

    const hasilLogin = data[0];

    // Jika verifikasi bcrypt gagal
    if (!hasilLogin.login_valid) {
      return NextResponse.json(
        { error: "NIK atau Password warga salah!" },
        { status: 401 }
      );
    }

    // Jika akun warga belum disetujui pengurus RT
    if (hasilLogin.status_verifikasi !== "Disetujui") {
      return NextResponse.json(
        { error: `Akun Anda belum disetujui oleh Pengurus RT! Status saat ini: ${hasilLogin.status_verifikasi}` },
        { status: 403 }
      );
    }

    // Buat JWT Token aman untuk Warga
    const token = await new SignJWT({
      id: hasilLogin.id,
      nama: hasilLogin.nama_lengkap,
      no_whatsapp: hasilLogin.no_whatsapp,
      alamat: hasilLogin.detail_alamat,
      role: "warga"
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h") // Masa berlaku sesi 24 Jam
      .sign(JWT_SECRET);

    const response = NextResponse.json({
      success: true,
      warga: {
        id: hasilLogin.id,
        nama: hasilLogin.nama_lengkap,
        alamat: hasilLogin.detail_alamat,
        status_tinggal: hasilLogin.status_tinggal
      }
    });

    // Simpan ke HttpOnly Cookie agar kebal dari pencurian XSS
    response.cookies.set("warga_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 1 Hari
      path: "/"
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: "Terjadi kesalahan internal: " + err.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/portal/login
 * Memverifikasi apakah warga masih memiliki sesi HttpOnly JWT yang valid
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("warga_session")?.value;

  if (!token) {
    return NextResponse.json({ error: "Sesi warga tidak aktif" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return NextResponse.json({ authenticated: true, warga: payload });
  } catch (err) {
    return NextResponse.json({ error: "Sesi kedaluwarsa atau tidak valid" }, { status: 401 });
  }
}

/**
 * DELETE /api/portal/login
 * Menghapus sesi HttpOnly cookie (Logout Warga)
 */
export async function DELETE(response: NextResponse) {
  const res = NextResponse.json({ success: true, message: "Berhasil keluar sesi portal warga" });
  res.cookies.set("warga_session", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/"
  });
  return res;
}
