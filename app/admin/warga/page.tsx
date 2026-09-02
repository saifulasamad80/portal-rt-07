import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import WargaAdminClient from "./WargaAdminClient";
import bcrypt from "bcryptjs"; 

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

async function pastikanOtentikasiAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) throw new Error("Akses Ilegal: Sesi tidak valid atau telah berakhir.");
  
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload; 
  } catch (error) {
    throw new Error("Akses Ilegal: Manipulasi Token Terdeteksi.");
  }
}

export default async function WargaAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) redirect("/admin");

  let adminAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    adminAktif = payload;
  } catch (error) {
    redirect("/admin");
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: wargaRes } = await supabaseAdmin
    .from("warga")
    .select("*, anggota_keluarga(*)")
    .order("created_at", { ascending: false });

  // REFACTOR MUTLAK: Transformasi ke Result Object untuk bunuh Error #441
  async function hapusWarga(id: string) {
    "use server";
    try {
      const sesi = await pastikanOtentikasiAdmin(); 
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      
      const { data: target } = await supabase.from("warga").select("nama_lengkap").eq("id", id).single();
      
      // PERINGATAN: Modul Cascade Delete ditahan sampai komandan memberikan nama tabel relasi.
      const { error } = await supabase.from("warga").delete().eq("id", id);
      if (error) return { success: false, message: error.message };

      if (target) {
        await supabase.from("audit_log").insert([{
          aktor: sesi.nama,
          aksi: "Hapus Warga Secara Paksa",
          tabel_target: "warga",
          detail: `Menghapus seluruh data warga: ${target.nama_lengkap}`
        }]);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || "Kegagalan internal server saat menghapus." };
    }
  }

  async function ubahStatusWarga(id: string, status: string) {
    "use server";
    try {
      const sesi = await pastikanOtentikasiAdmin(); 
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      
      const { data: target } = await supabase.from("warga").select("nama_lengkap").eq("id", id).single();
      
      const { error } = await supabase.from("warga").update({ status_verifikasi: status }).eq("id", id);
      if (error) return { success: false, message: error.message };

      if (target) {
         await supabase.from("audit_log").insert([{
          aktor: sesi.nama,
          aksi: `Mengubah Status Verifikasi: ${status}`,
          tabel_target: "warga",
          detail: `Warga: ${target.nama_lengkap} diubah menjadi ${status}`
        }]);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async function importWargaMassal(dataWarga: any[]) {
    "use server";
    try {
      const sesi = await pastikanOtentikasiAdmin(); 
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      
      const rtId = sesi.rt_id; 
      if (!rtId) return { success: false, message: "Akses Ditolak: Gagal mengidentifikasi ID RT Anda." };

      const defaultPinHash = await bcrypt.hash("123456", 10);
      let berhasil = 0;
      let gagal = 0;

      for (const w of dataWarga) {
        if (!w.nik || !w.nama_lengkap) { gagal++; continue; }
        const payload = {
          nik: String(w.nik).trim(),
          nama_lengkap: String(w.nama_lengkap).trim(),
          no_whatsapp: String(w.no_whatsapp || "").trim(),
          status_tinggal: String(w.status_tinggal || "Warga Tetap").trim(),
          detail_alamat: String(w.detail_alamat || "").trim(),
          tanggal_lahir: w.tanggal_lahir ? String(w.tanggal_lahir).trim() : null,
          tempat_lahir: String(w.tempat_lahir || "").trim(),
          jenis_kelamin: String(w.jenis_kelamin || "Laki-laki").trim(),
          pekerjaan: String(w.pekerjaan || "").trim(),
          status_verifikasi: "Disetujui", 
          pin: defaultPinHash,
          rt_id: rtId
        };

        const { error } = await supabase.from("warga").insert([payload]);
        if (error) { gagal++; } else { berhasil++; }
      }

      await supabase.from("audit_log").insert([{
        aktor: sesi.nama,
        aksi: "Import Bulk CSV Warga",
        tabel_target: "warga",
        detail: `Sukses: ${berhasil} KK. Gagal/Duplikat: ${gagal} baris.`
      }]);

      return { success: true, hasil: { berhasil, gagal } };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async function resetPinWarga(idTarget: string, pinBaru: string) {
    "use server";
    try {
      const sesi = await pastikanOtentikasiAdmin(); 
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const hashedPin = await bcrypt.hash(pinBaru, 10);

      const { data: target } = await supabase.from("warga").select("nama_lengkap").eq("id", idTarget).single();

      const { error } = await supabase.from("warga").update({ 
        pin: hashedPin,
        percobaan_gagal: 0,
        terkunci_sampai: null 
      }).eq("id", idTarget);
      
      if (error) return { success: false, message: error.message };

      await supabase.from("audit_log").insert([{
        aktor: sesi.nama,
        aksi: "Reset PIN & Cabut Lockdown Warga",
        tabel_target: "warga",
        detail: `Mereset paksa PIN & membuka kunci akses milik: ${target?.nama_lengkap}`
      }]);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  return <WargaAdminClient 
            wargaList={wargaRes || []} 
            aksiHapus={hapusWarga} 
            aksiUbahStatus={ubahStatusWarga} 
            aksiImportMassal={importWargaMassal} 
            aksiResetPin={resetPinWarga} 
         />;
}