import { NextResponse } from "next/server";
import { arsipkanWargaKarenaPemilu, prosesHapusAtauArsipWarga, terkaitConstraintPemilu } from "@/lib/arsip-warga";
import {
  otentikasiAdminAktif,
  otorisasiWargaUntukAdmin,
} from "@/lib/session-security";
import { buatKlienTerautentikasi, getSupabaseAdminClientDariSesi } from "@/lib/supabase-server";

export async function GET() {
  try {
    const otentikasi = await otentikasiAdminAktif();
    if (!otentikasi.ok) {
      return NextResponse.json({ error: "Akses Ditolak: Sesi tidak valid atau kedaluwarsa" }, { status: 401 });
    }

    const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
    const query = supabase
      .from("warga")
      .select("id, nik, nama_lengkap, no_whatsapp, status_tinggal, created_at")
      .eq("status_validasi", "Menunggu")
      .eq("rt_id", otentikasi.sesi.rtId);
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Kesalahan tidak diketahui";
    return NextResponse.json({ error: "Terjadi kesalahan internal server: " + message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const otentikasi = await otentikasiAdminAktif();
    if (!otentikasi.ok) {
      return NextResponse.json({ success: false, message: "Akses ditolak: sesi pengurus tidak valid." }, { status: 401 });
    }

    const url = new URL(request.url);
    let wargaId = url.searchParams.get("id") || "";
    if (!wargaId) {
      const body = await request.json().catch(() => ({}));
      wargaId = String(body?.id || "");
    }
    if (!wargaId) {
      return NextResponse.json({ success: false, message: "ID warga wajib diisi." }, { status: 400 });
    }

    const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
    const target = await otorisasiWargaUntukAdmin(supabase, otentikasi.sesi, wargaId);
    if (!target.ok) {
      return NextResponse.json({ success: false, message: target.message }, { status: 403 });
    }

    const privileged = getSupabaseAdminClientDariSesi(otentikasi.sesi);

    try {
      const hasil = await prosesHapusAtauArsipWarga(privileged, target.sesi.id, otentikasi.sesi.nama);
      const status = hasil.success ? 200 : 400;
      return NextResponse.json(hasil, { status });
    } catch (err: unknown) {
      if (terkaitConstraintPemilu(err as { message?: string; code?: string })) {
        try {
          const cadangan = await arsipkanWargaKarenaPemilu(
            privileged,
            target.sesi.id,
            target.sesi.nama
          );
          return NextResponse.json(cadangan);
        } catch (fallbackErr: unknown) {
          const fallbackPesan = fallbackErr instanceof Error ? fallbackErr.message : "Gagal mengarsipkan warga setelah constraint pemilu.";
          return NextResponse.json({ success: false, message: fallbackPesan }, { status: 500 });
        }
      }
      const pesan = err instanceof Error ? err.message : "Kegagalan internal saat menghapus warga.";
      return NextResponse.json({ success: false, message: pesan }, { status: 500 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Kegagalan internal server saat menghapus.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
