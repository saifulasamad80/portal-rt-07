import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  
  if (!path) return new NextResponse("Akses Ditolak: Path dokumen tidak ditemukan", { status: 400 });

  // 1. Verifikasi Lapis Baja (Hanya Admin yang boleh lewat)
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) return new NextResponse("Akses Ilegal: Anda bukan Admin", { status: 401 });

  try {
    const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");
    await jwtVerify(token, JWT_SECRET);
  } catch (error) {
    return new NextResponse("Akses Ilegal: Sesi Admin kedaluwarsa atau tidak valid", { status: 401 });
  }

  // 2. Terbitkan Signed URL (Link yang hancur sendiri)
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  const { data, error } = await supabaseAdmin
    .storage
    .from('dokumen_warga')
    .createSignedUrl(path, 60); // Masa aktif cuma 60 DETIK!

  if (error || !data) {
    return new NextResponse("Dokumen tidak ditemukan di brankas", { status: 404 });
  }

  // 3. Alihkan browser Admin ke link rahasia tersebut
  return NextResponse.redirect(data.signedUrl);
}