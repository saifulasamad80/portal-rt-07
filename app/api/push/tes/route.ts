import { NextResponse } from "next/server";
import { kirimNotifikasiKeWarga } from "@/lib/notifikasi-push";
import { otentikasiWargaAktif } from "@/lib/session-security";

export async function POST() {
  try {
    const otentikasi = await otentikasiWargaAktif();
    if (!otentikasi.ok) return NextResponse.json({ error: otentikasi.message }, { status: 401 });
    const wargaId = otentikasi.sesi.id;

    const hasil = await kirimNotifikasiKeWarga(wargaId, {
      title: "Notifikasi portal RT 07 aktif",
      body: "Perangkat ini siap menerima pengumuman, jadwal siskamling, dan ucapan ulang tahun.",
      url: "/portal",
      tag: "tes-push",
    });

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
    const pesan = err instanceof Error ? err.message : "Gagal mengirim notifikasi tes.";
    return NextResponse.json({ error: pesan }, { status: 500 });
  }
}
