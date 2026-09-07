import { redirect } from "next/navigation";
import VotingClient from "./VotingClient";
import { wargaUntukKlien, otentikasiWargaAktif, wajibOtentikasiWarga } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";
import { POLA_UUID } from "@/lib/uuid-tenant";

export default async function PortalVotingPage() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");
  const wargaAktif = otentikasi.sesi;

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);

  const { data: votingAktifList } = await supabaseAdmin
    .from("voting_rt")
    .select("*")
    .eq("status", "Aktif")
    .eq("rt_id", wargaAktif.rtId)
    .order("created_at", { ascending: false })
    .limit(1);

  const votingAktif = votingAktifList && votingAktifList.length > 0 ? votingAktifList[0] : null;

  let suaraKu = null;
  if (votingAktif) {
    const { data: cekSuara } = await supabaseAdmin
      .from("suara_voting")
      .select("*")
      .eq("voting_id", votingAktif.id)
      .eq("warga_id", wargaAktif.id)
      .eq("rt_id", wargaAktif.rtId);
      
    suaraKu = cekSuara && cekSuara.length > 0 ? cekSuara[0] : null;
  }

  // REFACTOR: Eksekusi Validasi Lapis Baja (Super Kritis untuk Mencegah Pemilu Curang)
  async function kirimSuara(votingId: string, pilihanTeks: string) {
    "use server";
    const sesi = await wajibOtentikasiWarga();
    const idBersih = String(votingId || "").trim();
    const pilihanBersih = String(pilihanTeks || "").trim();
    if (!POLA_UUID.test(idBersih)) return { success: false, message: "Topik voting tidak valid." };

    const supabase = await buatKlienTerautentikasi(sesi);
    const { data: topik, error: errTopik } = await supabase
      .from("voting_rt")
      .select("id, opsi_1, opsi_2")
      .eq("id", idBersih)
      .eq("rt_id", sesi.rtId)
      .eq("status", "Aktif")
      .maybeSingle();
    if (errTopik || !topik || ![topik.opsi_1, topik.opsi_2].includes(pilihanBersih)) return { success: false, message: "Pilihan voting tidak valid atau sesi sudah ditutup." };

    const { data: validasi } = await supabase.from("suara_voting").select("id").eq("voting_id", idBersih).eq("warga_id", sesi.id).maybeSingle();
    if (validasi) return { success: false, message: "Suara Anda sudah terekam sebelumnya." };

    const { error } = await supabase.from("suara_voting").insert([{
      voting_id: idBersih,
      warga_id: sesi.id, // Gunakan ID asli
      pilihan: pilihanBersih,
      rt_id: sesi.rtId,
    }]);

    if (error) return { success: false, message: error.code === "23505" ? "Suara Anda sudah terekam sebelumnya." : "Suara gagal disimpan." };
    return { success: true, message: "Suara berhasil disimpan." };
  }

  return <VotingClient wargaAktif={wargaUntukKlien(wargaAktif)} votingAktif={votingAktif} suaraKu={suaraKu} aksiPilih={kirimSuara} />;
}
