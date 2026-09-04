import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { kirimNotifikasiKeWarga } from "@/lib/notifikasi-push";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production"
);

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("warga_session")?.value;
    if (!token) return NextResponse.json({ error: "Sesi warga tidak valid." }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const wargaId = String(payload.id || "");
    if (!wargaId) return NextResponse.json({ error: "Sesi tidak berisi identitas warga." }, { status: 401 });

    const hasil = await kirimNotifikasiKeWarga(wargaId, {
      title: "Notifikasi portal RT 07 aktif",
      body: "Perangkat ini siap menerima pengumuman, jadwal siskamling, dan ucapan ulang tahun.",
      url: "/portal",
      tag: "tes-push",
    });

    if (!hasil.terkirim) {
      return NextResponse.json({
        success: false,
        message: hasil.pesan || "Langganan tersimpan, tetapi tes kirim belum sampai. Izinkan notifikasi di peramban lalu coba lagi.",
      });
    }

    return NextResponse.json({ success: true, terkirim: hasil.terkirim });
  } catch (err: unknown) {
    const pesan = err instanceof Error ? err.message : "Gagal mengirim notifikasi tes.";
    return NextResponse.json({ error: pesan }, { status: 500 });
  }
}
