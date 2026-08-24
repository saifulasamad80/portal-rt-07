import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import InventarisClient from "./InventarisClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function InventarisPage() {
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
  
  const [masterRes, riwayatRes] = await Promise.all([
    supabaseAdmin.from("master_inventaris").select("*").order("nama_barang", { ascending: true }),
    supabaseAdmin.from("peminjaman_inventaris").select("*").eq("warga_id", wargaAktif.id).order("tanggal_pinjam", { ascending: true })
  ]);

  async function ajukanBooking(namaBarang: string, tanggal: string, keterangan: string) {
    "use server";
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Mengeksekusi Insert sesuai dengan skema asli di database
    const { error } = await supabaseAdmin.from("peminjaman_inventaris").insert([{
      warga_id: wargaAktif.id,
      nama_barang: namaBarang,
      tanggal_pinjam: tanggal,
      keterangan: keterangan,
      status: "Menunggu"
    }]);

    if (error) throw new Error(error.message);
  }

  return <InventarisClient masterBarang={masterRes.data || []} riwayat={riwayatRes.data || []} ajukanBooking={ajukanBooking} />;
}