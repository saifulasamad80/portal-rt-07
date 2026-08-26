import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import KasAdminClient from "./KasAdminClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function AdminKasPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) redirect("/admin");

  let adminAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    // INJEKSI MUTLAK: Sterilisasi objek untuk mencegah Error 441
    adminAktif = JSON.parse(JSON.stringify(payload));
  } catch (error) {
    redirect("/admin");
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: dataKas } = await supabaseAdmin
    .from("kas_rt")
    .select("*, warga(nama_lengkap)")
    .order("created_at", { ascending: false });

  const { data: dataWarga } = await supabaseAdmin
    .from("warga")
    .select("id, nama_lengkap")
    .eq("status_verifikasi", "Disetujui");

  // INJEKSI MUTLAK: Ubah sistem return, dilarang pakai 'throw error' di Vercel
  async function simpanTransaksi(tipe: string, wargaId: string, kategori: string, nominal: number, keterangan: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const payload: any = { tipe_transaksi: tipe, kategori, nominal, keterangan };
    if (wargaId) payload.warga_id = wargaId;

    const { error } = await supabase.from("kas_rt").insert([payload]);
    if (error) return { success: false, message: error.message };

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: `Input Kas: ${tipe}`,
      tabel_target: "kas_rt",
      detail: `${kategori} - Rp ${nominal}`
    }]);

    return { success: true };
  }

  return <KasAdminClient 
            adminAktif={adminAktif} 
            transaksiList={dataKas || []} 
            wargaList={dataWarga || []} 
            aksiSimpan={simpanTransaksi} 
         />;
}