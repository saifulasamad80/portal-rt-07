import { createClient } from "@supabase/supabase-js";
import RegisterClient from "./RegisterClient";

export default function LaporDiriPage() {
  
  async function registerWargaServer(kepala: any, anggotaPayload: any[]) {
    "use server";
    
    // Gunakan Service Role untuk registrasi awal (kondisi aman, belum ada JWT tenant)
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Validasi NIK Kepala Keluarga agar tidak duplikat
    const { data: cekNik } = await supabaseAdmin.from("warga").select("id").eq("nik", kepala.nik).maybeSingle();
    if (cekNik) throw new Error(`DITOLAK: NIK ${kepala.nik} sudah terdaftar di sistem kami.`);

    // INJEKSI MUTLAK: Eksekusi Transaksi Database Atomik (Anti Data Yatim) via RPC
    const { error: errorRpc } = await supabaseAdmin.rpc('register_warga_baru', {
      p_kepala_keluarga: kepala,
      p_anggota_keluarga: anggotaPayload
    });

    if (errorRpc) throw new Error("Database menolak transaksi: " + errorRpc.message);
  }

  return <RegisterClient aksiRegister={registerWargaServer} />;
}