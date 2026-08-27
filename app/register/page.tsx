import RegisterClient from "./RegisterClient";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs"; 
import { v4 as uuidv4 } from "uuid"; // Modul pembuat ID Unik untuk nama file gambar

export default function RegisterPage() {
  
  async function aksiRegister(payloadKepala: any, anggotaPayload: any[]) {
    "use server"; 
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!, 
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const hashedPin = await bcrypt.hash(payloadKepala.pin, 10);

      // -------------------------------------------------------------------
      // MESIN PENGHANCUR BASE64: Mengubah Teks menjadi File Gambar Asli
      // -------------------------------------------------------------------
      async function uploadBase64ToStorage(base64String: string, filePrefix: string) {
        // Jika warga tidak upload (Pilih "Menyusul") atau format salah, lewati
        if (!base64String || base64String === 'MENYUSUL' || !base64String.startsWith('data:image')) {
          return base64String;
        }
        
        // Memecah header "data:image/jpeg;base64," dari data aslinya
        const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return null;
        
        const contentType = matches[1]; // contoh: image/jpeg
        const buffer = Buffer.from(matches[2], 'base64'); // Konversi ke Buffer File
        const fileName = `${filePrefix}_${uuidv4()}.${contentType.split('/')[1]}`; // Buat nama file acak
        
        // Tembak file asli ke Supabase Storage (Bucket: 'dokumen_warga')
        const { data, error } = await supabase.storage
          .from('dokumen_warga')
          .upload(fileName, buffer, {
            contentType: contentType,
            upsert: false
          });
        
        if (error) throw new Error("Gagal mengunggah dokumen ke Brankas Supabase: " + error.message);
        
        // Hanya kembalikan nama file pendeknya saja ke Database Warga!
        return data.path; 
      }

      // Olah dokumen KTP dan KK Kepala Keluarga sebelum masuk tabel
      const safeKtpPath = await uploadBase64ToStorage(payloadKepala.ktp_path, 'KTP_KK');
      const safeKkPath = await uploadBase64ToStorage(payloadKepala.kk_path, 'KK_UTAMA');

      // 1. Eksekusi Data Kepala Keluarga (Database jadi super ringan!)
      const { data: wargaBaru, error: errWarga } = await supabase
        .from("warga")
        .insert([{
           nik: payloadKepala.nik,
           nama_lengkap: payloadKepala.nama_lengkap,
           no_whatsapp: payloadKepala.no_whatsapp,
           pin: hashedPin, 
           status_tinggal: payloadKepala.status_tinggal,
           detail_alamat: payloadKepala.detail_alamat,
           tanggal_lahir: payloadKepala.tanggal_lahir,
           tempat_lahir: payloadKepala.tempat_lahir,
           jenis_kelamin: payloadKepala.jenis_kelamin,
           pekerjaan: payloadKepala.pekerjaan,
           pendapatan_bulanan: payloadKepala.pendapatan_bulanan,
           daya_listrik: payloadKepala.daya_listrik,
           ktp_path: safeKtpPath, // Teks path aman
           kk_path: safeKkPath,   // Teks path aman
           status_verifikasi: "Menunggu"
        }])
        .select("id")
        .single();

      if (errWarga) {
        if (errWarga.code === '23505') {
           throw new Error("Pendaftaran Gagal: NIK ini sudah terdaftar di sistem kami! Silakan hubungi Pak RT.");
        }
        throw new Error("Gagal menyimpan data Kepala Keluarga: " + errWarga.message);
      }

      // 2. Eksekusi Data Anggota Keluarga (Jika form diisi)
      if (anggotaPayload && anggotaPayload.length > 0) {
        const anggotaToInsert = await Promise.all(anggotaPayload.map(async (a: any) => {
          // Olah dokumen KTP anggota jika ada
          const safeAnggotaKtpPath = await uploadBase64ToStorage(a.ktp_path, `KTP_ANGGOTA_${a.nik}`);
          
          return {
            warga_id: wargaBaru.id,
            nama_lengkap: a.nama_lengkap,
            nik: a.nik,
            hubungan_keluarga: a.hubungan_keluarga,
            hubungan_detail: a.hubungan_detail,
            tanggal_lahir: a.tanggal_lahir,
            tempat_lahir: a.tempat_lahir,
            jenis_kelamin: a.jenis_kelamin,
            pekerjaan: a.pekerjaan,
            ktp_path: safeAnggotaKtpPath // Teks path aman
          };
        }));
        
        const { error: errAnggota } = await supabase
          .from("anggota_keluarga")
          .insert(anggotaToInsert);
          
        if (errAnggota) {
           throw new Error("Gagal menyimpan data anggota keluarga: " + errAnggota.message);
        }
      }

      return "SUKSES"; 
      
    } catch (error: any) {
      throw new Error(error.message || "Terjadi kesalahan internal pada server pendaftaran.");
    }
  }

  return <RegisterClient aksiRegister={aksiRegister} />;
}