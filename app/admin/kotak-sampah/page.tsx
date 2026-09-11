import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import KotakSampahClient from "./KotakSampahClient";
import { otentikasiAdminAktif } from "@/lib/session-security";
import { getSupabaseAdminClientDariSesi } from "@/lib/supabase-server";
import {
  daftarKotakSampah,
  hapusKotakSampahKedaluwarsa,
  kelompokkanBundel,
  pulihkanBundelKotakSampah,
  pulihkanItemKotakSampah,
} from "@/lib/kotak-sampah";
import { HARI_TTL_KOTAK_SAMPAH } from "@/lib/kebijakan-privasi";
import { POLA_UUID } from "@/lib/uuid-tenant";

export default async function HalamanKotakSampah() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) redirect("/admin");

  const privileged = getSupabaseAdminClientDariSesi(otentikasi.sesi);
  await hapusKotakSampahKedaluwarsa(
    privileged,
    otentikasi.sesi.rtId,
    otentikasi.sesi.nama,
    HARI_TTL_KOTAK_SAMPAH
  );
  const daftar = await daftarKotakSampah(privileged, otentikasi.sesi.rtId);
  const bundel = daftar.ok ? kelompokkanBundel(daftar.data) : [];

  async function pulihkanItem(id: string) {
    "use server";
    const sesi = await otentikasiAdminAktif();
    if (!sesi.ok) return { success: false, message: sesi.message };
    if (!POLA_UUID.test(id)) return { success: false, message: "ID item tidak valid." };
    const hasil = await pulihkanItemKotakSampah(
      getSupabaseAdminClientDariSesi(sesi.sesi),
      id,
      sesi.sesi.rtId,
      sesi.sesi.nama
    );
    if (hasil.success) revalidatePath("/admin/kotak-sampah");
    return hasil;
  }

  async function pulihkanBundel(idBundel: string) {
    "use server";
    const sesi = await otentikasiAdminAktif();
    if (!sesi.ok) return { success: false, message: sesi.message };
    if (!POLA_UUID.test(idBundel)) return { success: false, message: "ID bundel tidak valid." };
    const hasil = await pulihkanBundelKotakSampah(
      getSupabaseAdminClientDariSesi(sesi.sesi),
      idBundel,
      sesi.sesi.rtId,
      sesi.sesi.nama
    );
    if (hasil.success) revalidatePath("/admin/kotak-sampah");
    return hasil;
  }

  return (
    <KotakSampahClient
      bundel={bundel}
      pesanMuat={daftar.ok ? null : daftar.message}
      aksiPulihkanItem={pulihkanItem}
      aksiPulihkanBundel={pulihkanBundel}
    />
  );
}
