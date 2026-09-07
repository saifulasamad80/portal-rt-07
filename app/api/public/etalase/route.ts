import { NextResponse } from "next/server";
import { ambilEtalasePublik } from "@/lib/etalase-publik";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { uuidTenantSah } from "@/lib/uuid-tenant";

export const revalidate = 60;

export async function GET() {
  const tenant = uuidTenantSah(process.env.PUBLIC_RT_ID);
  if (!tenant) {
    return NextResponse.json(
      { error: "Tenant publik belum dikonfigurasi" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const hasil = await ambilEtalasePublik(getSupabaseAdminClient(), tenant);
    if (hasil.error) {
      console.error("API etalase publik gagal memuat data:", hasil.error);
      return NextResponse.json(
        { error: "Etalase publik sementara tidak tersedia" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { galeri: hasil.galeri, dokumen: hasil.dokumen, kontak: hasil.kontak },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
    );
  } catch (error) {
    console.error("API etalase publik mengalami error:", error);
    return NextResponse.json(
      { error: "Etalase publik sementara tidak tersedia" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
