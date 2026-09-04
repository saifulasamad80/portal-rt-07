import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import LapakClient from "./LapakClient";
import { v4 as uuidv4 } from "uuid"; 

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

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

  const { data: profilWarga } = await supabaseAdmin.from("warga").select("no_whatsapp").eq("id", wargaAktif.id).single();

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

  // INJEKSI MUTLAK: Menarik Work Order Rak Bin Khusus untuk Lapak Jasa
  const lapakIds = lapakKuRes?.map(l => l.id) || [];
  let orderanJasaRes: any[] = [];
  
  if (lapakIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("limbah_ekonomis")
      .select("*, warga(nama_lengkap, no_whatsapp)")
      .in("teknisi_id", lapakIds)
      .order("created_at", { ascending: false });
    orderanJasaRes = data || [];
  }

  async function buatLapak(payloadLapak: any) {
    "use server";
    const sesi = await pastikanOtentikasiWarga(); 
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    let finalFotoUrl = payloadLapak.fotoBase64; 
    
    if (payloadLapak.fotoBase64 && payloadLapak.fotoBase64.startsWith('data:image')) {
      const matches = payloadLapak.fotoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `${uuidv4()}.${contentType.split('/')[1]}`;
        
        const { error: uploadError } = await supabase.storage.from('lapak_warga').upload(fileName, buffer, { contentType, upsert: false });
        if (uploadError) throw new Error("Gagal unggah foto: " + uploadError.message);
        
        const { data: publicUrlData } = supabase.storage.from('lapak_warga').getPublicUrl(fileName);
        finalFotoUrl = publicUrlData.publicUrl;
      }
    }

    const { error } = await supabase.from("lapak_warga").insert([{
      warga_id: sesi.id, nama_usaha: payloadLapak.namaUsaha, kategori: payloadLapak.kategori,
      deskripsi: payloadLapak.deskripsi, nomor_wa: payloadLapak.wa, foto_url: finalFotoUrl, rt_id: sesi.rt_id 
    }]);
    if (error) throw new Error(error.message);
  }

  async function hapusLapakKu(idLapak: string) {
    "use server";
    const sesi = await pastikanOtentikasiWarga(); 
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabase.from("lapak_warga").delete().eq("id", idLapak).eq("warga_id", sesi.id);
    if (error) throw new Error(error.message);
  }

  // SERVER ACTION: Teknisi Menyelesaikan Pekerjaan & Input Tagihan
  async function selesaikanReparasi(idBarang: string, biaya: number, isGagal: boolean) {
    "use server";
    const sesi = await pastikanOtentikasiWarga(); // BARRIER AKTIF
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Potongan Fee RT ditetapkan 10% jika berhasil
    const feeRt = isGagal ? 0 : Math.floor(biaya * 0.1); 
    const statusBaru = isGagal ? "Tersedia di Rak Bin" : "Selesai Direparasi"; // Jika gagal, kembalikan ke gudang

    const { error } = await supabase.from("limbah_ekonomis").update({
      status: statusBaru,
      biaya_reparasi: isGagal ? 0 : biaya,
      fee_rt: feeRt
    }).eq("id", idBarang);

    if (error) throw new Error(error.message);
  }

  return (
    <LapakClient 
      wargaAktif={wargaAktif} 
      nomorWaDefault={profilWarga?.no_whatsapp || ""} 
      katalog={katalogRes || []} 
      lapakKu={lapakKuRes || []} 
      orderanJasa={orderanJasaRes}
      aksiBuat={buatLapak} 
      aksiHapus={hapusLapakKu} 
      aksiSelesaikanOrder={selesaikanReparasi}
    />
  );
}