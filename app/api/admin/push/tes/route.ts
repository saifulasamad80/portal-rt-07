import { NextResponse } from "next/server";
import { kirimNotifikasiKePengurus } from "@/lib/notifikasi-push";
import { otentikasiAdminAktif } from "@/lib/session-security";

export async function POST() {
  try {
    const otentikasi = await otentikasiAdminAktif();
    if (!otentikasi.ok) return NextResponse.json({ error: otentikasi.message }, { status: 401 });
    const sesi = otentikasi.sesi;

    const hasil = await kirimNotifikasiKePengurus(
      {
        title: "Notifikasi pengurus Wargaku aktif",
        body: "Perangkat ini siap menerima antrean verifikasi pendaftaran baru.",
        url: "/admin/verifikasi",
        tag: "tes-push-pengurus",
      },
      { rtId: sesi.rtId, pengurusId: sesi.id }
    );

    if (!hasil.terkirim) {
      return NextResponse.json({
        success: false,
        message: hasil.pesan === "Kunci VAPID belum diatur."
          ? hasil.pesan
          : "Langganan tersimpan, tetapi tes kirim belum sampai. Izinkan notifikasi di peramban lalu coba lagi.",
      });
    }

    return NextResponse.json({ success: true, terkirim: hasil.terkirim });
  } catch (err: unknown) {
    const pesan = err instanceof Error ? err.message : "Gagal mengirim notifikasi tes pengurus.";
    return NextResponse.json({ error: pesan }, { status: 500 });
  }
}
