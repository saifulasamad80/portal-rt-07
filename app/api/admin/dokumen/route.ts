import { NextResponse } from "next/server";
import { otentikasiAdminAktif } from "@/lib/session-security";
import { buatKlienTerautentikasi, getSupabaseAdminClientDariSesi } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const POLA_UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const POLA_PATH_DOKUMEN_WARGA = new RegExp(
  `^(?:${[
    `registrasi/${POLA_UUID}/${POLA_UUID}/(?:KTP_KK|KK_UTAMA|KTP_ANGGOTA_[1-9][0-9]*)_${POLA_UUID}\\.(?:jpg|png|webp)`,
    `(?:KTP_KK|KK_UTAMA|KTP_ANGGOTA_[0-9]{16})_${POLA_UUID}\\.(?:jpeg|jpg|png|webp)`,
    `[0-9]{16}_(?:KTP_KK|KK_UTAMA|KTP_ANGGOTA)_[0-9]{10,17}\\.jpg`,
    `persetujuan/${POLA_UUID}/${POLA_UUID}/SURAT_${POLA_UUID}\\.(?:jpg|pdf)`,
  ].map((pola) => `(?:${pola})`).join("|")})$`,
  "i"
);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path")?.trim() || "";
  
  if (
    !path
    || path.length > 500
    || path.includes("..")
    || path.startsWith("/")
    || path.includes("\\")
    || /^https?:\/\//i.test(path)
    || !POLA_PATH_DOKUMEN_WARGA.test(path)
  ) {
    return new NextResponse("Akses Ditolak: Path dokumen tidak valid", { status: 400 });
  }

  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) return new NextResponse("Akses Ilegal: Sesi Admin kedaluwarsa atau tidak valid", { status: 401 });

  // Path saja bukan otorisasi. Ikat kembali ke baris warga yang memiliki
  // dokumen dan, untuk admin RT, ke tenant RT yang sedang dikelola.
  const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
  const queryKtp = supabase
    .from("warga")
    .select("id")
    .eq("ktp_path", path)
    .eq("rt_id", otentikasi.sesi.rtId);
  let { data: pemilik, error: errPemilik } = await queryKtp.maybeSingle();
  if (!pemilik && !errPemilik) {
    const queryKk = supabase
      .from("warga")
      .select("id")
      .eq("kk_path", path)
      .eq("rt_id", otentikasi.sesi.rtId);
    ({ data: pemilik, error: errPemilik } = await queryKk.maybeSingle());
  }
  if (errPemilik || !pemilik) {
    const querySurat = supabase
      .from("persetujuan_data_warga")
      .select("id")
      .eq("berkas_path", path)
      .eq("rt_id", otentikasi.sesi.rtId);
    ({ data: pemilik, error: errPemilik } = await querySurat.maybeSingle());
  }
  if (errPemilik || !pemilik) {
    return new NextResponse("Dokumen tidak ditemukan atau tidak berada dalam cakupan Anda", { status: 404 });
  }

  // Terbitkan Signed URL (masa hidup pendek) setelah ownership check.
  const { data, error } = await getSupabaseAdminClientDariSesi(otentikasi.sesi)
    .storage
    .from("dokumen_warga")
    .createSignedUrl(path, 60);

  if (error || !data) {
    return new NextResponse("Dokumen tidak ditemukan di brankas", { status: 404 });
  }

  // 3. Alihkan browser Admin ke link rahasia tersebut
  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
