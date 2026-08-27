import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import LapakClient from "./LapakClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function PortalLapakPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;

  if (!token) redirect("/login");

  let wargaAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    wargaAktif = payload;
  } catch (error) {
    redirect("/login");
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Tarik semua lapak yang sudah divalidasi RT (Etalase)
  const { data: katalogRes } = await supabaseAdmin
    .from("lapak_warga")
    .select("*, warga(nama_lengkap)")
    .eq("status", "Aktif")
    .order("created_at", { ascending: false });

  // Tarik lapak milik warga ini sendiri
  const { data: lapakKuRes } = await supabaseAdmin
    .from("lapak_warga")
    .select("*")
    .eq("warga_id", wargaAktif.id)
    .order("created_at", { ascending: false });

  async function buatLapak(namaUsaha: string, kategori: string, deskripsi: string, wa: string, fotoBase64: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { error } = await supabase.from("lapak_warga").insert([{
      warga_id: wargaAktif.id,
      nama_usaha: namaUsaha,
      kategori: kategori,
      deskripsi: deskripsi,
      nomor_wa: wa,
      foto_url: fotoBase64, // Disimpan murni sebagai teks Base64
      rt_id: wargaAktif.rt_id
    }]);

    if (error) throw new Error(error.message);
  }

  async function hapusLapakKu(idLapak: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabase.from("lapak_warga").delete().eq("id", idLapak).eq("warga_id", wargaAktif.id);
    if (error) throw new Error(error.message);
  }

  return <LapakClient wargaAktif={wargaAktif} katalog={katalogRes || []} lapakKu={lapakKuRes || []} aksiBuat={buatLapak} aksiHapus={hapusLapakKu} />;
}