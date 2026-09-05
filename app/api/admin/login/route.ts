import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import {
  ambilKunciSesi,
  otentikasiAdminAktif,
  SESSION_AUDIENCE_ADMIN,
  SESSION_ISSUER,
  sessionVersionTidakTersedia,
} from "@/lib/session-security";
import { KLAIM_VERSI_SESI, angkaVersiSesi } from "@/lib/versi-sesi";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Format permintaan login tidak valid." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const username = String(input.username ?? "").trim().slice(0, 254);
    const password = String(input.password ?? "");

    if (!username || !password || password.length > 512) {
      return NextResponse.json({ error: "Username dan Password wajib diisi!" }, { status: 400 });
    }

    // Hindari interpolasi input ke sintaks filter PostgREST `.or(...)`.
    const kolomAdmin = "id, nama_lengkap, jabatan, password, rt_id, percobaan_gagal, terkunci_sampai, level, session_version";
    let hasilAdmin = await supabaseAdmin
      .from("pengurus_rt")
      .select(kolomAdmin)
      .eq("username", username)
      .maybeSingle();

    if (sessionVersionTidakTersedia(hasilAdmin.error)) {
      const kolomLama = "id, nama_lengkap, jabatan, password, rt_id, percobaan_gagal, terkunci_sampai, level";
      hasilAdmin = await supabaseAdmin
        .from("pengurus_rt")
        .select(kolomLama)
        .eq("username", username)
        .maybeSingle();
      if (!hasilAdmin.data && !hasilAdmin.error) {
        hasilAdmin = await supabaseAdmin
          .from("pengurus_rt")
          .select(kolomLama)
          .eq("email", username)
          .maybeSingle();
      }
    } else if (!hasilAdmin.data && !hasilAdmin.error) {
      hasilAdmin = await supabaseAdmin
        .from("pengurus_rt")
        .select(kolomAdmin)
        .eq("email", username)
        .maybeSingle();
    }

    const { data: admin, error: errAdmin } = hasilAdmin;

    const PESAN_KREDENSIAL = "Username atau sandi tidak sesuai.";
    const HASH_UMPAN = "$2b$10$C6UzMDM.H6dfI/f/IKcEeOAj7raF5GW0lQzP3nEiuVqah/S9.O/1y";

    if (errAdmin) {
      return NextResponse.json({ error: "Server tidak dapat memproses login saat ini." }, { status: 500 });
    }

    if (admin?.terkunci_sampai && new Date(admin.terkunci_sampai) > new Date()) {
      return NextResponse.json({ error: "Akun dikunci sementara. Coba lagi nanti." }, { status: 429 });
    }

    let isMatch = false;
    let isLegacyPlaintext = false;
    const hashPembanding =
      typeof admin?.password === "string" && (admin.password.startsWith("$2a$") || admin.password.startsWith("$2b$"))
        ? admin.password
        : HASH_UMPAN;

    if (typeof admin?.password === "string" && !admin.password.startsWith("$2a$") && !admin.password.startsWith("$2b$")) {
      isMatch = admin.password === password;
      isLegacyPlaintext = isMatch;
      await bcrypt.compare(password, HASH_UMPAN);
    } else {
      isMatch = Boolean(admin) && (await bcrypt.compare(password, hashPembanding));
    }

    if (!admin || !isMatch) {
      if (admin) {
        const gagalSekarang = (admin.percobaan_gagal || 0) + 1;
        const updateData: Record<string, unknown> = { percobaan_gagal: gagalSekarang };
        if (gagalSekarang >= 5) {
          updateData.terkunci_sampai = new Date(Date.now() + 15 * 60000).toISOString();
        }
        await supabaseAdmin.from("pengurus_rt").update(updateData).eq("id", admin.id);
        if (gagalSekarang >= 5) {
          return NextResponse.json({ error: "Akun dikunci sementara. Coba lagi nanti." }, { status: 429 });
        }
      }
      return NextResponse.json({ error: PESAN_KREDENSIAL }, { status: 401 });
    }

    const updatePayload: Record<string, unknown> = { percobaan_gagal: 0, terkunci_sampai: null };
    if (isLegacyPlaintext) updatePayload.password = await bcrypt.hash(password, 10);

    const versiKolomAda = !sessionVersionTidakTersedia(errAdmin) && "session_version" in (admin as object);
    const hasilUpdate = await supabaseAdmin
      .from("pengurus_rt")
      .update(updatePayload)
      .eq("id", admin.id)
      .select(versiKolomAda ? "session_version" : "id")
      .maybeSingle();
    if (hasilUpdate.error) {
      console.error("Pembaruan sesi login pengurus gagal:", hasilUpdate.error.message);
      return NextResponse.json({ error: "Server tidak dapat memproses login saat ini." }, { status: 500 });
    }

    const versiSesi = angkaVersiSesi(
      versiKolomAda
        ? (hasilUpdate.data as { session_version?: number | null } | null)?.session_version ??
          (admin as { session_version?: number | null }).session_version
        : 1
    );
    if (versiSesi == null) {
      return NextResponse.json({ error: "Server tidak dapat memproses login saat ini." }, { status: 500 });
    }

    if (!admin.rt_id) {
      return NextResponse.json({ error: "Konfigurasi Akun Gagal: RT ID tidak ditemukan." }, { status: 403 });
    }

    // EFEK DOMINO: 'role' di JWT sekarang mengambil dari kasta di database (webmaster atau rt)
    const kastaAdmin = admin.level === "webmaster" ? "webmaster" : "rt";
    const jwtPayload = {
      nama: admin.nama_lengkap,
      jabatan: admin.jabatan,
      role: kastaAdmin,
      rt_id: admin.rt_id,
      token_use: "admin",
      [KLAIM_VERSI_SESI]: versiSesi,
    };

    const token = await new SignJWT(jwtPayload)
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(admin.id))
      .setIssuer(SESSION_ISSUER)
      .setAudience(SESSION_AUDIENCE_ADMIN)
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(ambilKunciSesi("admin"));

    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 60 * 60 * 2, path: "/" } as const;
    const response = NextResponse.json({ success: true, user: { id: admin.id, nama: admin.nama_lengkap, jabatan: admin.jabatan, rt_id: admin.rt_id, role: kastaAdmin } });
    response.cookies.set("admin_session", token, cookieOptions);
    return response;

  } catch (err: unknown) {
    console.error("Login pengurus gagal:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Server tidak dapat memproses login saat ini." }, { status: 500 });
  }
}

export async function GET() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) {
    return NextResponse.json({ error: otentikasi.message }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: otentikasi.sesi.id,
      nama: otentikasi.sesi.nama,
      jabatan: otentikasi.sesi.role,
      rt_id: otentikasi.sesi.rtId,
      role: otentikasi.sesi.role,
    },
  });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Berhasil keluar sesi." });
  response.cookies.set("admin_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 0, path: "/" });
  return response;
}
