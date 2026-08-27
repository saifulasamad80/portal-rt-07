import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import KasAdminClient from "./KasAdminClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// SECURITY FIX: Hapus fallback rawan. Paksa server melempar error jika ENV tidak terkonfigurasi.
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// INJEKSI MUTLAK: Gembok Keamanan Zero-Trust untuk Endpoint Admin
async function pastikanOtentikasiAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) throw new Error("Akses Ilegal: Sesi tidak valid atau telah berakhir.");
  
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload; // Lolos verifikasi, kembalikan payload admin
  } catch (error) {
    throw new Error("Akses Ilegal: Token keamanan rusak atau dimanipulasi.");
  }
}

export default async function AdminKasPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) redirect("/admin");

  let adminAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    adminAktif = JSON.parse(JSON.stringify(payload));
  } catch (error) {
    redirect("/admin");
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // OPTIMASI LIMITASI: Batasi output maksimal 500 baris agar tidak terjadi OOM (Memory Leak)
  const { data: dataKas } = await supabaseAdmin
    .from("kas_rt")
    .select("*, warga(nama_lengkap)")
    .order("created_at", { ascending: false })
    .limit(500);

  const { data: dataWarga } = await supabaseAdmin
    .from("warga")
    .select("id, nama_lengkap")
    .eq("status_verifikasi", "Disetujui");

  // REFACTOR: Kunci Server Action dengan Barrier Otentikasi
  async function simpanTransaksi(tipe: string, wargaId: string, kategori: string, nominal: number, keterangan: string) {
    "use server";
    const sesi = await pastikanOtentikasiAdmin(); // BARRIER KEAMANAN AKTIF

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Ambil RT ID secara absolut dari token admin yang tervalidasi, bukan dari closure luar!
    const idRt = sesi.rt_id; 

    if (!idRt) {
      return { success: false, message: "Akses Ditolak: Sistem gagal memverifikasi ID RT Anda." };
    }

    const payload: any = { 
      tipe_transaksi: tipe, 
      kategori, 
      nominal, 
      keterangan,
      rt_id: idRt 
    };
    if (wargaId) payload.warga_id = wargaId;

    const { error: errorKas } = await supabase.from("kas_rt").insert([payload]);
    if (errorKas) return { success: false, message: errorKas.message };

    await supabase.from("audit_log").insert([{
      aktor: sesi.nama,
      aksi: `Input Kas: ${tipe}`,
      tabel_target: "kas_rt",
      detail: `${kategori} - Rp ${nominal}`,
      rt_id: idRt 
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