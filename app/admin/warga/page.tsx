import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import WargaAdminClient from "./WargaAdminClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

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

  async function hapusWarga(id: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: target } = await supabase.from("warga").select("nama_lengkap").eq("id", id).single();
    if (target) {
      await supabase.from("audit_log").insert([{
        aktor: adminAktif.nama,
        aksi: "Hapus Warga Secara Paksa",
        tabel_target: "warga",
        detail: `Menghapus seluruh data warga: ${target.nama_lengkap}`
      }]);
    }
    
    const { error } = await supabase.from("warga").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  // INJEKSI MUTLAK: Mesin Pencabut Akses (Kill Switch)
  async function ubahStatusWarga(id: string, status: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { data: target } = await supabase.from("warga").select("nama_lengkap").eq("id", id).single();
    
    const { error } = await supabase.from("warga").update({ status_verifikasi: status }).eq("id", id);
    if (error) throw new Error(error.message);

    if (target) {
       await supabase.from("audit_log").insert([{
        aktor: adminAktif.nama,
        aksi: `Mengubah Status Verifikasi: ${status}`,
        tabel_target: "warga",
        detail: `Warga: ${target.nama_lengkap} diubah menjadi ${status}`
      }]);
    }
  }

  return <WargaAdminClient wargaList={wargaRes || []} aksiHapus={hapusWarga} aksiUbahStatus={ubahStatusWarga} />;
}