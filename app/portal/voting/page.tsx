import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import VotingClient from "./VotingClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function PortalVotingPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;

  if (!token) redirect("/login");
  let wargaAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    wargaAktif = payload;
  } catch (error) { redirect("/login"); }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // FAKTA: Cari voting yang sedang berstatus "Aktif"
  const { data: votingAktif } = await supabaseAdmin
    .from("voting_rt")
    .select("*")
    .eq("status", "Aktif")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // FAKTA: Cek apakah warga ini sudah memberikan suaranya pada voting tersebut
  let suaraKu = null;
  if (votingAktif) {
    const { data: cekSuara } = await supabaseAdmin
      .from("suara_voting")
      .select("*")
      .eq("voting_id", votingAktif.id)
      .eq("warga_id", wargaAktif.id)
      .maybeSingle();
    suaraKu = cekSuara;
  }

  // FAKTA: Server Action untuk memasukkan suara (Tembus RLS)
  async function kirimSuara(votingId: string, pilihanTeks: string) {
    "use server";
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Validasi Ganda di Server (Anti Cheat)
    const { data: validasi } = await supabase.from("suara_voting").select("id").eq("voting_id", votingId).eq("warga_id", wargaAktif.id).maybeSingle();
    if (validasi) throw new Error("Suara Anda sudah terekam sebelumnya. Dilarang memilih ganda!");

    const { error } = await supabase.from("suara_voting").insert([{
      voting_id: votingId,
      warga_id: wargaAktif.id,
      pilihan: pilihanTeks
    }]);

    if (error) throw new Error(error.message);
  }

  return <VotingClient wargaAktif={wargaAktif} votingAktif={votingAktif} suaraKu={suaraKu} aksiPilih={kirimSuara} />;
}