import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import LapakAdminClient from "./LapakAdminClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function AdminLapakPage() {
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

  const { data: lapakRes } = await supabaseAdmin
    .from("lapak_warga")
    .select("*, warga(nama_lengkap)")
    .order("created_at", { ascending: false });

  async function validasiLapak(idLapak: string, statusBaru: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabase.from("lapak_warga").update({ status: statusBaru }).eq("id", idLapak);
    if (error) throw new Error(error.message);

    const { data: targetLapak } = await supabase.from("lapak_warga").select("nama_usaha").eq("id", idLapak).single();
    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: `Validasi UMKM: ${statusBaru}`,
      tabel_target: "lapak_warga",
      detail: `Lapak: ${targetLapak?.nama_usaha}`
    }]);
  }

  return <LapakAdminClient adminAktif={adminAktif} daftarLapak={lapakRes || []} aksiValidasi={validasiLapak} />;
}