import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import WargaDetailClient from "./WargaDetailClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function AdminWargaDetailPage({ params }: { params: { id: string } }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) redirect("/admin");
  let adminAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    adminAktif = payload;
  } catch (error) { redirect("/admin"); }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // FAKTA: Tarik detail 1 warga beserta seluruh keluarganya
  const { data: wargaRes } = await supabaseAdmin
    .from("warga")
    .select("*, anggota_keluarga(*)")
    .eq("id", params.id)
    .single();

  // FAKTA: Server Action Verifikasi Lapor Diri
  async function verifikasiWarga(wargaId: string, statusBaru: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const { error } = await supabase.from("warga").update({ status_verifikasi: statusBaru }).eq("id", wargaId);
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: `Verifikasi Warga: ${statusBaru}`,
      tabel_target: "warga",
      detail: `Memverifikasi NIK ${wargaRes?.nik} (${wargaRes?.nama_lengkap}) menjadi ${statusBaru}`
    }]);
  }

  return <WargaDetailClient warga={wargaRes} aksiVerifikasi={verifikasiWarga} />;
}