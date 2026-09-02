import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import WargaDetailClient from "./WargaDetailClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function AdminWargaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const idWarga = resolvedParams.id;

  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) redirect("/admin");
  let adminAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    adminAktif = payload;
  } catch (error) { redirect("/admin"); }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: wargaRes } = await supabaseAdmin
    .from("warga")
    .select("*, anggota_keluarga(*)")
    .eq("id", idWarga)
    .single();

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

  // OPERASI MUTLAK: Fungsi pembaruan data tanpa merusak kunci NIK
  async function editWarga(wargaId: string, dataBaru: any) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // FAKTA: Hapus NIK dari payload untuk mencegah perubahan Kunci Utama (Primary Key)
    const { nik, ...dataAman } = dataBaru;

    const { error } = await supabase.from("warga").update(dataAman).eq("id", wargaId);
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert([{
      aktor: adminAktif.nama,
      aksi: `Edit Data Warga`,
      tabel_target: "warga",
      detail: `Memperbarui biodata NIK ${wargaRes?.nik} (${dataAman.nama_lengkap})`
    }]);
  }

  return <WargaDetailClient warga={wargaRes} aksiVerifikasi={verifikasiWarga} aksiEdit={editWarga} />;
}