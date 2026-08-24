import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import KurbanClient from "./KurbanClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function AdminKurbanPage() {
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

  const { data: kurbanRes } = await supabaseAdmin.from("tabungan_kurban").select("*, warga(nama_lengkap)").order("tanggal_transaksi", { ascending: false });
  const { data: wargaRes } = await supabaseAdmin.from("warga").select("id, nama_lengkap").eq("status_verifikasi", "Disetujui").order("nama_lengkap", { ascending: true });

  async function simpanKurban(wargaId: string, jenis: string, sumberDana: string, nominal: number, keterangan: string, tanggal: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabase.from("tabungan_kurban").insert([{
      warga_id: wargaId, jenis_transaksi: jenis, sumber_dana: sumberDana, nominal, keterangan, tanggal_transaksi: tanggal
    }]);
    if (error) throw new Error(error.message);

    const { data: targetWarga } = await supabase.from("warga").select("nama_lengkap").eq("id", wargaId).single();
    await supabase.from("audit_log").insert([{ aktor: adminAktif.nama, aksi: `Input Tabungan Kurban: ${jenis}`, tabel_target: "tabungan_kurban", detail: `${targetWarga?.nama_lengkap} - Rp ${nominal}` }]);
  }

  return <KurbanClient kurbanList={kurbanRes || []} wargaList={wargaRes || []} aksiSimpan={simpanKurban} />;
}