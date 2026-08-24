import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import VotingClient from "./VotingClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function EVotingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;

  if (!token) redirect("/login");

  let wargaAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    wargaAktif = payload;
  } catch (error) {
    redirect("/login");
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Tarik data topik yang aktif
  const { data: topikData } = await supabaseAdmin
    .from("voting_rt")
    .select("*")
    .eq("status", "Aktif")
    .order("created_at", { ascending: false });

  let votingTerkalkulasi: any[] = [];

  if (topikData && topikData.length > 0) {
    // Tarik suara hanya untuk topik yang aktif untuk efisiensi
    const topikIds = topikData.map(t => t.id);
    const { data: semuaSuara } = await supabaseAdmin
      .from("suara_voting")
      .select("voting_id, pilihan, warga_id")
      .in("voting_id", topikIds);

    const dataSuara = semuaSuara || [];

    votingTerkalkulasi = topikData.map((topik) => {
      const suaraSaya = dataSuara.find((s) => s.voting_id === topik.id && s.warga_id === wargaAktif.id);
      const suaraTopikIni = dataSuara.filter((s) => s.voting_id === topik.id);
      
      const suaraOpsi1 = suaraTopikIni.filter(s => s.pilihan === topik.opsi_1).length;
      const suaraOpsi2 = suaraTopikIni.filter(s => s.pilihan === topik.opsi_2).length;
      const totalSemua = suaraOpsi1 + suaraOpsi2;

      return {
        ...topik,
        sudahMemilih: !!suaraSaya,
        pilihanSaya: suaraSaya ? suaraSaya.pilihan : null,
        statistik: {
          opsi_1: totalSemua === 0 ? 0 : Math.round((suaraOpsi1 / totalSemua) * 100),
          opsi_2: totalSemua === 0 ? 0 : Math.round((suaraOpsi2 / totalSemua) * 100),
          total: totalSemua
        }
      };
    });
  }

  // FAKTA: Server Action untuk memasukkan suara (Bypass RLS)
  async function coblosKandidat(votingId: string, pilihanWarga: string) {
    "use server";
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Cek ganda di sisi server agar warga tidak bisa mencoblos 2x lewat manipulasi API
    const { data: cekSuara } = await supabaseAdmin
      .from("suara_voting")
      .select("id")
      .eq("voting_id", votingId)
      .eq("warga_id", wargaAktif.id)
      .maybeSingle();

    if (cekSuara) throw new Error("DITOLAK: Anda sudah pernah memberikan suara pada topik ini!");

    const { error } = await supabaseAdmin.from("suara_voting").insert([{
      voting_id: votingId,
      warga_id: wargaAktif.id,
      pilihan: pilihanWarga
    }]);

    if (error) throw new Error(error.message);
  }

  return <VotingClient daftarVoting={votingTerkalkulasi} coblosKandidat={coblosKandidat} />;
}