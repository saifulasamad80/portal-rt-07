import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import VotingAdminClient from "./VotingAdminClient";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";
import {
  otentikasiAdminAktif,
  wajibOtentikasiAdmin,
} from "@/lib/session-security";

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminVotingPage() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) redirect("/admin");

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);

  // FAKTA: Tarik semua topik sekaligus hitung suara dari tabel suara_voting
  let queryTopik = supabaseAdmin.from("voting_rt").select("*").order("created_at", { ascending: false }).limit(500);
  let querySuara = supabaseAdmin.from("suara_voting").select("voting_id, pilihan").limit(10000);
  if (otentikasi.sesi.role !== "webmaster") {
    queryTopik = queryTopik.eq("rt_id", otentikasi.sesi.rtId);
    querySuara = querySuara.eq("rt_id", otentikasi.sesi.rtId);
  }
  const [topikRes, suaraRes] = await Promise.all([queryTopik, querySuara]);

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
    const sesi = await wajibOtentikasiAdmin();
    const judulBersih = String(judul || "").trim().slice(0, 200);
    const deskripsiBersih = String(deskripsi || "").trim().slice(0, 5000);
    const opsi1Bersih = String(opsi1 || "").trim().slice(0, 100);
    const opsi2Bersih = String(opsi2 || "").trim().slice(0, 100);
    if (!judulBersih || !deskripsiBersih || !opsi1Bersih || !opsi2Bersih || opsi1Bersih === opsi2Bersih) return { success: false, message: "Topik dan pilihan voting tidak valid." };
    const supabase = await buatKlienTerautentikasi(sesi);
    const { error } = await supabase.from("voting_rt").insert([{ judul: judulBersih, deskripsi: deskripsiBersih, opsi_1: opsi1Bersih, opsi_2: opsi2Bersih, status: "Aktif", rt_id: sesi.rtId }]);
    if (error) return { success: false, message: "Topik voting gagal dibuat." };
    await supabase.from("audit_log").insert([{ aktor: sesi.nama, aksi: `Membuat Topik Voting`, tabel_target: "voting_rt", detail: `Judul: ${judulBersih}`, rt_id: sesi.rtId }]);
    revalidatePath("/");
    return { success: true };
  }

  async function aksiToggleStatus(id: string, statusBaru: string) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();
    const idBersih = String(id || "").trim();
    const statusBersih = String(statusBaru || "").trim();
    if (!POLA_UUID.test(idBersih) || !["Aktif", "Ditutup"].includes(statusBersih)) return { success: false, message: "ID atau status voting tidak valid." };
    const supabase = await buatKlienTerautentikasi(sesi);
    let query = supabase.from("voting_rt").update({ status: statusBersih }).eq("id", idBersih);
    if (sesi.role !== "webmaster") query = query.eq("rt_id", sesi.rtId);
    const { data: diperbarui, error } = await query.select("id").maybeSingle();
    if (error || !diperbarui) return { success: false, message: "Status voting gagal diperbarui." };
    await supabase.from("audit_log").insert([{ aktor: sesi.nama, aksi: `Mengubah Status Voting`, tabel_target: "voting_rt", detail: `ID: ${idBersih} menjadi ${statusBersih}`, rt_id: sesi.rtId }]);
    revalidatePath("/");
    return { success: true };
  }

  return <VotingAdminClient daftarVoting={topikTerkalkulasi} aksiBuatTopik={aksiBuatTopik} aksiToggleStatus={aksiToggleStatus} />;
}
