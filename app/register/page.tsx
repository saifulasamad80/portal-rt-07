import { createClient } from "@supabase/supabase-js";
import RegisterClient from "./RegisterClient";
import bcrypt from "bcryptjs";

export default function LaporDiriPage() {
  
  async function registerWargaServer(kepala: any, anggotaPayload: any[]) {
    "use server";
    
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: cekNik } = await supabaseAdmin.from("warga").select("id").eq("nik", kepala.nik).maybeSingle();
    if (cekNik) throw new Error(`DITOLAK: NIK ${kepala.nik} sudah terdaftar di sistem kami.`);

    // INJEKSI MUTLAK: Hashing PIN Warga Baru (C1 Fix)
    const hashedPin = await bcrypt.hash(kepala.pin, 10);
    const payloadAman = { ...kepala, pin: hashedPin };

    const { error: errorRpc } = await supabaseAdmin.rpc('register_warga_baru', {
      p_kepala_keluarga: payloadAman,
      p_anggota_keluarga: anggotaPayload
    });

    if (errorRpc) throw new Error("Database menolak transaksi: " + errorRpc.message);
  }

  return <RegisterClient aksiRegister={registerWargaServer} />;
}