import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import LapakClient from "./LapakClient";
import { v4 as uuidv4 } from "uuid"; // Modul pembuat ID Acak

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// SECURITY FIX: Hapus fallback string.
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// INJEKSI MUTLAK: Mesin Gembok Zero-Trust Anti-IDOR
async function pastikanOtentikasiWarga() {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;
  if (!token) throw new Error("Akses Ditolak: Sesi Anda tidak valid.");
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload; 
  } catch (error) { throw new Error("Akses Ditolak: Token dimanipulasi."); }
}

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

  // OPTIMASI: Batasi katalog agar tidak OOM jika lapak mencapai ribuan
  const { data: katalogRes } = await supabaseAdmin
    .from("lapak_warga")
    .select("*, warga(nama_lengkap)")
    .eq("status", "Aktif")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: lapakKuRes } = await supabaseAdmin
    .from("lapak_warga")
    .select("*")
    .eq("warga_id", wargaAktif.id)
    .order("created_at", { ascending: false });

  // REFACTOR: Endpoint Bikin Lapak & Penghancur Base64
  async function buatLapak(namaUsaha: string, kategori: string, deskripsi: string, wa: string, fotoBase64: string) {
    "use server";
    const sesi = await pastikanOtentikasiWarga(); // BARRIER AKTIF

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    let finalFotoUrl = fotoBase64; // Fallback jika kosong
    
    // -------------------------------------------------------------------
    // EKSEKUSI PEMBERSIHAN DATA: Ekstrak Base64 ke Supabase Storage Public
    // -------------------------------------------------------------------
    if (fotoBase64 && fotoBase64.startsWith('data:image')) {
      const matches = fotoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `${uuidv4()}.${contentType.split('/')[1]}`;
        
        // Tembak ke bucket 'lapak_warga' (Pastikan bucket ini PUBLIC di Supabase)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('lapak_warga')
          .upload(fileName, buffer, {
            contentType: contentType,
            upsert: false
          });
          
        if (uploadError) throw new Error("Gagal mengunggah foto brosur ke Storage: " + uploadError.message);
        
        // Ambil URL Publiknya untuk disimpan di tabel database
        const { data: publicUrlData } = supabase.storage.from('lapak_warga').getPublicUrl(fileName);
        finalFotoUrl = publicUrlData.publicUrl;
      }
    }

    const { error } = await supabase.from("lapak_warga").insert([{
      warga_id: sesi.id, // ID Asli dari JWT
      nama_usaha: namaUsaha,
      kategori: kategori,
      deskripsi: deskripsi,
      nomor_wa: wa,
      foto_url: finalFotoUrl, // DATABASE SEKARANG BERSIH! (Hanya menyimpan URL)
      rt_id: sesi.rt_id 
    }]);

    if (error) throw new Error(error.message);
  }

  // REFACTOR: Validasi Endpoint Hapus Lapak 
  async function hapusLapakKu(idLapak: string) {
    "use server";
    const sesi = await pastikanOtentikasiWarga(); // BARRIER AKTIF

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Pastikan lapak yang dihapus BENAR-BENAR milik ID warga yang terotorisasi
    const { error } = await supabase.from("lapak_warga").delete().eq("id", idLapak).eq("warga_id", sesi.id);
    if (error) throw new Error(error.message);
  }

  return <LapakClient wargaAktif={wargaAktif} katalog={katalogRes || []} lapakKu={lapakKuRes || []} aksiBuat={buatLapak} aksiHapus={hapusLapakKu} />;
}