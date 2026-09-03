import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { arsipkanWargaKarenaPemilu, prosesHapusAtauArsipWarga, terkaitConstraintPemilu } from "@/lib/arsip-warga";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function otentikasiAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload) return null;
    return payload as { nama?: string; role?: string };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const sesi = await otentikasiAdmin();
    if (!sesi) {
      return NextResponse.json({ error: "Akses Ditolak: Sesi tidak valid atau kedaluwarsa" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("warga")
      .select("id, nik, nama_lengkap, no_whatsapp, status_tinggal, created_at")
      .eq("status_verifikasi", "Menunggu")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Kesalahan tidak diketahui";
    return NextResponse.json({ error: "Terjadi kesalahan internal server: " + message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const sesi = await otentikasiAdmin();
    if (!sesi) {
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

    // Alur utama: coba hapus permanen, dan jika data warga terikat constraint
    // IMMUTABLE tabel partisipasi_pemilihan, fungsi ini otomatis melakukan
    // fallback soft-delete (nonaktifkan akun + lepas data personal, tanpa
    // menyentuh baris indeks pemilih demi integritas surat suara).
    try {
      const hasil = await prosesHapusAtauArsipWarga(supabaseAdmin, wargaId, sesi.nama);
      const status = hasil.success ? 200 : 400;
      return NextResponse.json(hasil, { status });
    } catch (err: unknown) {
      // Jaring pengaman terakhir: hanya tersentuh bila constraint pemilu
      // gagal ditangani secara internal (mis. error tak terduga saat proses
      // pembersihan relasi). Langsung arsipkan tanpa mengulang seluruh alur.
      if (terkaitConstraintPemilu(err as { message?: string; code?: string })) {
        try {
          const cadangan = await arsipkanWargaKarenaPemilu(supabaseAdmin, wargaId, undefined);
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
