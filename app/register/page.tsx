import RegisterClient from "./RegisterClient";
import { createClient } from "@supabase/supabase-js";

export default function RegisterPage() {
  
  // INJEKSI MUTLAK: Mesin Server Action Anti-Error 441
  async function aksiRegister(payloadKepala: any, anggotaPayload: any[]) {
    "use server"; // Mantra wajib, tidak boleh hilang!
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!, 
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // 1. Eksekusi Data Kepala Keluarga
      const { data: wargaBaru, error: errWarga } = await supabase
        .from("warga")
        .insert([{
           nik: payloadKepala.nik,
           nama_lengkap: payloadKepala.nama_lengkap,
           no_whatsapp: payloadKepala.no_whatsapp,
           pin: payloadKepala.pin,
           status_tinggal: payloadKepala.status_tinggal,
           detail_alamat: payloadKepala.detail_alamat,
           tanggal_lahir: payloadKepala.tanggal_lahir,
           tempat_lahir: payloadKepala.tempat_lahir,
           jenis_kelamin: payloadKepala.jenis_kelamin,
           pekerjaan: payloadKepala.pekerjaan,
           pendapatan_bulanan: payloadKepala.pendapatan_bulanan,
           daya_listrik: payloadKepala.daya_listrik,
           ktp_path: payloadKepala.ktp_path,
           kk_path: payloadKepala.kk_path,
           status_verifikasi: "Menunggu"
        }])
        .select("id")
        .single();

      if (errWarga) {
        // Logika Mutlak: Deteksi NIK Ganda (Kode 23505 PostgreSQL)
        if (errWarga.code === '23505') {
           throw new Error("Pendaftaran Gagal: NIK ini sudah terdaftar di sistem kami! Silakan hubungi Pak RT.");
        }
        throw new Error("Gagal menyimpan data Kepala Keluarga: " + errWarga.message);
      }

      // 2. Eksekusi Data Anggota Keluarga (Jika form diisi)
      if (anggotaPayload && anggotaPayload.length > 0) {
        const anggotaToInsert = anggotaPayload.map((a: any) => ({
          warga_id: wargaBaru.id,
          nama_lengkap: a.nama_lengkap,
          nik: a.nik,
          hubungan_keluarga: a.hubungan_keluarga,
          hubungan_detail: a.hubungan_detail,
          tanggal_lahir: a.tanggal_lahir,
          tempat_lahir: a.tempat_lahir,
          jenis_kelamin: a.jenis_kelamin,
          pekerjaan: a.pekerjaan,
          ktp_path: a.ktp_path
        }));
        
        const { error: errAnggota } = await supabase
          .from("anggota_keluarga")
          .insert(anggotaToInsert);
          
        if (errAnggota) {
           throw new Error("Gagal menyimpan data anggota keluarga: " + errAnggota.message);
        }
      }

      // Mengembalikan string sederhana agar lolos sensor Serialisasi React (Anti Error 441)
      return "SUKSES"; 
      
    } catch (error: any) {
      // WAJIB throw new Error murni agar bisa ditangkap oleh alert di RegisterClient.tsx
      throw new Error(error.message || "Terjadi kesalahan internal pada server pendaftaran.");
    }
  }

  return <RegisterClient aksiRegister={aksiRegister} />;
}