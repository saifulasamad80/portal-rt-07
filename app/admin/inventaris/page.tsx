import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import InventarisClient from "./InventarisClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function AdminInventarisPage() {
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

  const { data: masterData } = await supabaseAdmin.from("master_inventaris").select("*").order("nama_barang", { ascending: true });
  const { data: pinjamData } = await supabaseAdmin.from("peminjaman_inventaris").select("*, warga(nama_lengkap)").order("tanggal_pinjam", { ascending: false });

  async function tambahBarang(nama: string, deskripsi: string, total: number) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabase.from("master_inventaris").insert([{ nama_barang: nama, deskripsi, total_unit: total }]);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert([{ aktor: adminAktif.nama, aksi: "Tambah Master Inventaris", tabel_target: "master_inventaris", detail: `${total} Unit ${nama}` }]);
  }

  async function updateStatus(id: string, statusBaru: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabase.from("peminjaman_inventaris").update({ status: statusBaru }).eq("id", id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert([{ aktor: adminAktif.nama, aksi: `Update Status Pinjam: ${statusBaru}`, tabel_target: "peminjaman_inventaris", detail: `ID Peminjaman: ${id}` }]);
  }

  return <InventarisClient masterList={masterData || []} pinjamList={pinjamData || []} aksiTambah={tambahBarang} aksiStatus={updateStatus} />;
}