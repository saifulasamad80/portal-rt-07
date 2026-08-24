import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import VotingAdminClient from "./VotingAdminClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function AdminVotingPage() {
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

  // FAKTA: Tarik semua topik sekaligus hitung suara dari tabel suara_voting
  const [topikRes, suaraRes] = await Promise.all([
    supabaseAdmin.from("voting_rt").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("suara_voting").select("voting_id, pilihan")
  ]);

  const daftarTopik = topikRes.data || [];
  const semuaSuara = suaraRes.data || [];

  const topikTerkalkulasi = daftarTopik.map((topik) => {
    const suaraTopikIni = semuaSuara.filter((s) => s.voting_id === topik.id);
    const suaraOpsi1 = suaraTopikIni.filter((s) => s.pilihan === topik.opsi_1).length;
    const suaraOpsi2 = suaraTopikIni.filter((s) => s.pilihan === topik.opsi_2).length;
    const totalSemua = suaraOpsi1 + suaraOpsi2;

    return {
      ...topik,
      statistik: {
        opsi_1_count: suaraOpsi1,
        opsi_2_count: suaraOpsi2,
        opsi_1_pct: totalSemua === 0 ? 0 : Math.round((suaraOpsi1 / totalSemua) * 100),
        opsi_2_pct: totalSemua === 0 ? 0 : Math.round((suaraOpsi2 / totalSemua) * 100),
        total: totalSemua
      }
    };
  });

  async function aksiBuatTopik(judul: string, deskripsi: string, opsi1: string, opsi2: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabase.from("voting_rt").insert([{ judul, deskripsi, opsi_1: opsi1, opsi_2: opsi2, status: "Aktif" }]);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert([{ aktor: adminAktif.nama, aksi: `Membuat Topik Voting`, tabel_target: "voting_rt", detail: `Judul: ${judul}` }]);
  }

  async function aksiToggleStatus(id: string, statusBaru: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabase.from("voting_rt").update({ status: statusBaru }).eq("id", id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_log").insert([{ aktor: adminAktif.nama, aksi: `Mengubah Status Voting`, tabel_target: "voting_rt", detail: `ID: ${id} menjadi ${statusBaru}` }]);
  }

  return <VotingAdminClient daftarVoting={topikTerkalkulasi} aksiBuatTopik={aksiBuatTopik} aksiToggleStatus={aksiToggleStatus} />;
}