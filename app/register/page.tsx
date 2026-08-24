import { createClient } from "@supabase/supabase-js";
import RegisterClient from "./RegisterClient";

export default function LaporDiriPage() {
  
  // FAKTA: Server Action menerima payload raksasa dan menembus RLS
  async function registerWargaServer(kepala: any, anggotaPayload: any[]) {
    "use server";
    
    // Gunakan Service Role agar bisa INSERT
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Validasi NIK Kepala Keluarga agar tidak duplikat
    const { data: cekNik } = await supabaseAdmin.from("warga").select("id").eq("nik", kepala.nik).maybeSingle();
    if (cekNik) throw new Error(`DITOLAK: NIK ${kepala.nik} sudah terdaftar di sistem kami.`);

    // Insert Data Kepala Keluarga (Termasuk Data Sensus & Desil Baru)
    const { data: dataWarga, error: errorWarga } = await supabaseAdmin
      .from("warga")
      .insert([{ 
        nik: kepala.nik, 
        nama_lengkap: kepala.nama, 
        no_whatsapp: kepala.wa, 
        pin: kepala.pin, 
        status_tinggal: kepala.statusTinggal, 
        detail_alamat: kepala.detailAlamat, 
        ktp_path: kepala.pathKtp, 
        kk_path: kepala.pathKk,
        tanggal_lahir: kepala.tglLahir,
        tempat_lahir: kepala.tempatLahir,
        jenis_kelamin: kepala.gender,
        pekerjaan: kepala.pekerjaan,
        pendapatan_bulanan: kepala.pendapatan,
        daya_listrik: kepala.listrik,
        status_verifikasi: "Menunggu" // Belum diapprove RT
      }])
      .select();

    if (errorWarga) throw new Error("Gagal menyimpan data Kepala Keluarga: " + errorWarga.message);

    // Insert Data Anggota Keluarga (Jika Ada)
    if (anggotaPayload.length > 0 && dataWarga) {
      // Tempelkan warga_id yang baru jadi ke setiap anggota
      const finalPayload = anggotaPayload.map(a => ({
        warga_id: dataWarga[0].id,
        ...a
      }));
      
      const { error: errorAnggota } = await supabaseAdmin.from("anggota_keluarga").insert(finalPayload);
      if (errorAnggota) {
        // Rollback manual darurat kalau anggota gagal masuk tapi bapaknya berhasil (Pencegahan data yatim)
        await supabaseAdmin.from("warga").delete().eq("id", dataWarga[0].id);
        throw new Error("Gagal menyimpan data Anggota Keluarga: " + errorAnggota.message);
      }
    }
  }

  return <RegisterClient aksiRegister={registerWargaServer} />;
}