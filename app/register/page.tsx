import { createClient } from "@supabase/supabase-js";
import RegisterClient from "./RegisterClient";
import bcrypt from "bcryptjs";

export default function LaporDiriPage() {
  
  async function registerWargaServer(kepala: any, anggotaPayload: any[]) {
    "use server";
    
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Validasi NIK Ganda
    const { data: cekNik } = await supabaseAdmin.from("warga").select("id").eq("nik", kepala.nik).maybeSingle();
    if (cekNik) throw new Error(`DITOLAK: NIK ${kepala.nik} sudah terdaftar di sistem kami.`);

    // INJEKSI MUTLAK (JALUR DEWA): Fungsi pengubah Base64 menjadi File Biner dan Upload Paksa via Admin
    const uploadBase64ToSupabase = async (base64Data: string | null, prefix: string, nik: string) => {
      if (!base64Data || base64Data === "MENYUSUL") return "MENYUSUL";

      try {
        // Memisahkan header "data:image/jpeg;base64," dari isi datanya
        const base64Content = base64Data.split(",")[1];
        // Merakit kembali teks menjadi file biner di dalam Server Node.js
        const buffer = Buffer.from(base64Content, "base64");
        const fileName = `${nik}_${prefix}_${Date.now()}.jpg`;

        // Upload langsung dari Server ke Storage (Bypass semua RLS & CORS)
        const { error } = await supabaseAdmin.storage.from("dokumen_warga").upload(fileName, buffer, {
          contentType: "image/jpeg",
          upsert: false
        });

        if (error) throw error;
        return fileName;
      } catch (e: any) {
        throw new Error(`Gagal menyimpan ${prefix} ke brankas: ` + e.message);
      }
    };

    // 1. Upload KTP dan KK Kepala Keluarga (Server-Side)
    const finalKtpKK = await uploadBase64ToSupabase(kepala.ktp_path, 'KTP_KK', kepala.nik);
    const finalKkKK = await uploadBase64ToSupabase(kepala.kk_path, 'KK_FILE', kepala.nik);

    // 2. Upload KTP Anggota Keluarga (Server-Side)
    const anggotaFinal = await Promise.all(anggotaPayload.map(async (a) => {
       const finalKtpAnggota = await uploadBase64ToSupabase(a.ktp_path, `KTP_ANGGOTA_${a.nama_lengkap.replace(/\s+/g, '_')}`, a.nik);
       return { ...a, ktp_path: finalKtpAnggota };
    }));

    // 3. Hashing PIN Warga Baru (C1 Fix)
    const hashedPin = await bcrypt.hash(kepala.pin, 10);
    
    // 4. Susun Payload Akhir
    const payloadAman = { 
      ...kepala, 
      pin: hashedPin,
      ktp_path: finalKtpKK,
      kk_path: finalKkKK
    };

    // 5. Eksekusi Tembak ke Database
    const { error: errorRpc } = await supabaseAdmin.rpc('register_warga_baru', {
      p_kepala_keluarga: payloadAman,
      p_anggota_keluarga: anggotaFinal
    });

    if (errorRpc) throw new Error("Database menolak transaksi: " + errorRpc.message);
  }

  return <RegisterClient aksiRegister={registerWargaServer} />;
}