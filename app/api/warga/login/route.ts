import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import {
  ambilKunciSesi,
  otentikasiWargaAktif,
  SESSION_AUDIENCE_WARGA,
  SESSION_ISSUER,
  sessionVersionTidakTersedia,
  statusAktifTidakTersedia,
} from "@/lib/session-security";
import { alasanTolakMasukPortal } from "@/lib/akses-portal-warga";
import { KLAIM_VERSI_SESI, angkaVersiSesi } from "@/lib/versi-sesi";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type WargaLogin = {
  id: string;
  nik: string;
  nama_lengkap: string;
  rt_id: string;
  pin: string;
  status_verifikasi: string | null;
  status_aktif?: boolean | null;
  percobaan_gagal: number | null;
  terkunci_sampai: string | null;
  session_version?: number | null;
};

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, message: "Format permintaan login tidak valid." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const nik = String(input.nik ?? "").replace(/\D/g, "");
    const pin = String(input.pin ?? "");
    const newPin = input.newPin == null ? "" : String(input.newPin);
    if (nik.length !== 16 || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ success: false, message: "NIK atau PIN tidak valid." }, { status: 400 });
    }
    if (newPin && !/^\d{6}$/.test(newPin)) {
      return NextResponse.json({ success: false, message: "PIN baru harus tepat 6 angka." }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let statusAktifTersedia = true;
    let versiSesiTersedia = true;
    const hasilAwal = await supabase
      .from("warga")
      .select("id, nik, nama_lengkap, rt_id, pin, status_verifikasi, status_aktif, percobaan_gagal, terkunci_sampai, session_version")
      .eq("nik", nik)
      .single();
    let warga = hasilAwal.data as WargaLogin | null;
    let error = hasilAwal.error;

    if (sessionVersionTidakTersedia(error) || statusAktifTidakTersedia(error)) {
      versiSesiTersedia = !sessionVersionTidakTersedia(error);
      statusAktifTersedia = !statusAktifTidakTersedia(error);
      const ulang = await supabase
        .from("warga")
        .select(
          [
            "id",
            "nik",
            "nama_lengkap",
            "rt_id",
            "pin",
            "status_verifikasi",
            "percobaan_gagal",
            "terkunci_sampai",
            statusAktifTersedia ? "status_aktif" : null,
            versiSesiTersedia ? "session_version" : null,
          ]
            .filter((kolom): kolom is string => Boolean(kolom))
            .join(", ")
        )
        .eq("nik", nik)
        .single();
      warga = ulang.data as WargaLogin | null;
      error = ulang.error;
    }

    if (sessionVersionTidakTersedia(error)) {
      versiSesiTersedia = false;
      const ulang = await supabase
        .from("warga")
        .select(
          [
            "id",
            "nik",
            "nama_lengkap",
            "rt_id",
            "pin",
            "status_verifikasi",
            "percobaan_gagal",
            "terkunci_sampai",
            statusAktifTersedia ? "status_aktif" : null,
          ]
            .filter((kolom): kolom is string => Boolean(kolom))
            .join(", ")
        )
        .eq("nik", nik)
        .single();
      warga = ulang.data as WargaLogin | null;
      error = ulang.error;
    }

    const PESAN_KREDENSIAL = "NIK atau PIN tidak sesuai.";
    const HASH_UMPAN = "$2b$10$C6UzMDM.H6dfI/f/IKcEeOAj7raF5GW0lQzP3nEiuVqah/S9.O/1y";

    if (error || !warga) {
      await bcrypt.compare(pin, HASH_UMPAN);
      return NextResponse.json({ success: false, message: PESAN_KREDENSIAL }, { status: 401 });
    }

    if (warga.terkunci_sampai && new Date(warga.terkunci_sampai) > new Date()) {
      return NextResponse.json({ success: false, message: "Akun dikunci sementara. Coba lagi nanti." }, { status: 429 });
    }

    let isMatch = false;
    let isLegacyPlaintext = false;

    if (warga.pin.startsWith("$2a$") || warga.pin.startsWith("$2b$")) {
      isMatch = await bcrypt.compare(pin, warga.pin);
    } else {
      isMatch = warga.pin === pin;
      isLegacyPlaintext = isMatch;
      await bcrypt.compare(pin, HASH_UMPAN);
    }

    if (!isMatch) {
      const gagalSekarang = (warga.percobaan_gagal || 0) + 1;
      const updateData: Record<string, unknown> = { percobaan_gagal: gagalSekarang };
      if (gagalSekarang >= 5) {
        updateData.terkunci_sampai = new Date(Date.now() + 15 * 60000).toISOString();
      }
      await supabase.from("warga").update(updateData).eq("id", warga.id);
      if (gagalSekarang >= 5) {
        return NextResponse.json({ success: false, message: "Akun dikunci sementara. Coba lagi nanti." }, { status: 429 });
      }
      return NextResponse.json({ success: false, message: PESAN_KREDENSIAL }, { status: 401 });
    }

    const alasanStatus = alasanTolakMasukPortal({
      status_verifikasi: warga.status_verifikasi,
      nama_lengkap: warga.nama_lengkap,
      nik: warga.nik,
    });
    if (alasanStatus) {
      return NextResponse.json({ success: false, message: alasanStatus }, { status: 403 });
    }

    const pinLemah = ["123456", "111111", "000000", "654321", "121212", "123123"];
    if (pinLemah.includes(pin) && !newPin) {
      return NextResponse.json({ success: false, requirePinChange: true, message: "SISTEM KEAMANAN: Wajib membuat PIN Baru sebelum mengakses portal." });
    }
    if (newPin && pinLemah.includes(newPin)) {
      return NextResponse.json({ success: false, requirePinChange: true, message: "PIN baru terlalu mudah ditebak." }, { status: 400 });
    }

    // ----------------------------------------------------------------------
    // INJEKSI MUTLAK: OPTIMASI KINERJA (BYPASS DATABASE WRITE JIKA TIDAK PERLU)
    // ----------------------------------------------------------------------
    const butuhUpdate = Boolean(newPin || isLegacyPlaintext || (warga.percobaan_gagal || 0) > 0 || warga.terkunci_sampai);
    let versiSesi = angkaVersiSesi(warga.session_version);

    if (butuhUpdate) {
      const updatePayload: Record<string, unknown> = { percobaan_gagal: 0, terkunci_sampai: null };
      if (newPin) updatePayload.pin = await bcrypt.hash(newPin, 10);
      else if (isLegacyPlaintext) updatePayload.pin = await bcrypt.hash(pin, 10);

      const kolomKembali = versiSesiTersedia ? "session_version" : "id";
      const hasilUpdate = await supabase.from("warga").update(updatePayload).eq("id", warga.id).select(kolomKembali).maybeSingle();
      if (hasilUpdate.error) {
        console.error("Pembaruan sesi login warga gagal:", hasilUpdate.error.message);
        return NextResponse.json({ success: false, message: "Server tidak dapat memproses login saat ini." }, { status: 500 });
      }
      if (versiSesiTersedia && hasilUpdate.data && "session_version" in hasilUpdate.data) {
        const versiBaru = angkaVersiSesi(
          (hasilUpdate.data as { session_version?: number | null }).session_version
        );
        if (versiBaru == null) {
          return NextResponse.json({ success: false, message: "Server tidak dapat memproses login saat ini." }, { status: 500 });
        }
        versiSesi = versiBaru;
      }
    }

    if (versiSesi == null) {
      return NextResponse.json({ success: false, message: "Server tidak dapat memproses login saat ini." }, { status: 500 });
    }

    const token = await new SignJWT({
      id: warga.id,
      nik: warga.nik,
      nama: warga.nama_lengkap,
      rt_id: warga.rt_id,
      token_use: "warga",
      [KLAIM_VERSI_SESI]: versiSesi,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(warga.id))
      .setIssuer(SESSION_ISSUER)
      .setAudience(SESSION_AUDIENCE_WARGA)
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(ambilKunciSesi("warga"));

    const response = NextResponse.json({ success: true, message: "Login berhasil!" });
    response.cookies.set("warga_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error: unknown) {
    console.error("Login warga gagal:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, message: "Server tidak dapat memproses login saat ini." }, { status: 500 });
  }
}

export async function GET() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) {
    return NextResponse.json({ error: otentikasi.message }, { status: 401 });
  }
  return NextResponse.json({
    warga: {
      id: otentikasi.sesi.id,
      nama: otentikasi.sesi.nama,
      nik: otentikasi.sesi.nik,
      role: "warga",
      rt_id: otentikasi.sesi.rtId,
    },
  });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Berhasil keluar sesi." });
  response.cookies.set("warga_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
