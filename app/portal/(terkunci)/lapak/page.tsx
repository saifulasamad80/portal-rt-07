import { redirect } from "next/navigation";
import LapakClient from "./LapakClient";
import { v4 as uuidv4 } from "uuid";
import { otentikasiWargaAktif, wajibOtentikasiWarga, wargaUntukKlien } from "@/lib/session-security";
import { buatKlienTerautentikasi, getSupabaseAdminClientDariSesi } from "@/lib/supabase-server";
import { POLA_UUID } from "@/lib/uuid-tenant";
const KATEGORI_LAPAK = ["Makanan & Minuman", "Jasa & Servis", "Pakaian & Fashion", "Lainnya"] as const;
const MIME_FOTO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAKS_FOTO_BASE64 = 700_000;
const MAKS_BIAYA_REPARASI = 100_000_000;

export default async function PortalLapakPage() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");
  const wargaAktif = otentikasi.sesi;

  const supabaseAdmin = await buatKlienTerautentikasi(wargaAktif);

  const { data: profilWarga } = await supabaseAdmin
    .from("warga")
    .select("no_whatsapp")
    .eq("id", wargaAktif.id)
    .eq("rt_id", wargaAktif.rtId)
    .maybeSingle();

  const { data: katalogRes } = await supabaseAdmin
    .from("lapak_warga")
    .select("id, nama_usaha, kategori, deskripsi, nomor_wa, foto_url, warga(nama_lengkap)")
    .eq("status", "Aktif")
    .eq("rt_id", wargaAktif.rtId)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: lapakKuRes } = await supabaseAdmin
    .from("lapak_warga")
    .select("id, nama_usaha, kategori, status, foto_url, rt_id")
    .eq("warga_id", wargaAktif.id)
    .eq("rt_id", wargaAktif.rtId)
    .order("created_at", { ascending: false });

  // INJEKSI MUTLAK: Menarik Work Order Rak Bin Khusus untuk Lapak Jasa
  const lapakIds = (lapakKuRes || [])
    .filter((lapak) => lapak.kategori === "Jasa & Servis" && lapak.status === "Aktif")
    .map((lapak) => String(lapak.id))
    .filter((id) => POLA_UUID.test(id));
  let orderanJasaRes: Array<Record<string, unknown>> = [];
  
  if (lapakIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("limbah_ekonomis")
      .select("id, nama_barang, kategori, deskripsi, status, biaya_reparasi, fee_rt, warga(nama_lengkap, no_whatsapp)")
      .in("teknisi_id", lapakIds)
      .eq("rt_id", wargaAktif.rtId)
      .order("created_at", { ascending: false });
    orderanJasaRes = (data || []) as Array<Record<string, unknown>>;
  }

  async function buatLapak(payloadLapak: unknown) {
    "use server";
    const sesi = await wajibOtentikasiWarga();
    if (!payloadLapak || typeof payloadLapak !== "object" || Array.isArray(payloadLapak)) {
      throw new Error("Data lapak tidak valid.");
    }
    const input = payloadLapak as Record<string, unknown>;
    const namaUsaha = String(input.namaUsaha || "").trim().slice(0, 120);
    const kategori = String(input.kategori || "").trim();
    const deskripsi = String(input.deskripsi || "").trim().slice(0, 2000);
    const nomorWa = String(input.wa || "").replace(/\D/g, "").slice(0, 16);
    const fotoBase64 = String(input.fotoBase64 || "");
    if (!namaUsaha || !deskripsi || !KATEGORI_LAPAK.includes(kategori as (typeof KATEGORI_LAPAK)[number]) || nomorWa.length < 8 || !fotoBase64) {
      throw new Error("Data lapak tidak valid.");
    }

    // Kuota harus ditegakkan di server; pemeriksaan Client Component dapat dipalsukan.
    const supabase = await buatKlienTerautentikasi(sesi);
    const penyimpanan = getSupabaseAdminClientDariSesi(sesi);
    const { count: jumlahLapak, error: errKuota } = await supabase
      .from("lapak_warga")
      .select("id", { count: "exact", head: true })
      .eq("warga_id", sesi.id)
      .eq("rt_id", sesi.rtId);
    if (errKuota) throw new Error("Kuota lapak belum dapat diverifikasi.");
    if ((jumlahLapak || 0) >= 2) throw new Error("Batas maksimal kepemilikan lapak telah tercapai.");

    const matches = fotoBase64.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!matches || fotoBase64.length > MAKS_FOTO_BASE64) throw new Error("Format atau ukuran foto tidak valid.");
    const contentType = matches[1];
    const encoded = matches[2];
    if (encoded.length % 4 !== 0) throw new Error("Format foto tidak valid.");
    const buffer = Buffer.from(encoded, "base64");
    if (!buffer.length || buffer.length > 524_288) throw new Error("Ukuran foto terlalu besar.");

    const extension = MIME_FOTO[contentType];
    const fileName = `${uuidv4()}.${extension}`;
    const { error: uploadError } = await penyimpanan.storage
      .from("lapak_warga")
      .upload(fileName, buffer, { contentType, upsert: false });
    if (uploadError) throw new Error("Gagal unggah foto.");

    const { data: inserted, error } = await supabase.from("lapak_warga").insert([{
      warga_id: sesi.id,
      nama_usaha: namaUsaha,
      kategori,
      deskripsi,
      nomor_wa: nomorWa,
      foto_url: penyimpanan.storage.from("lapak_warga").getPublicUrl(fileName).data.publicUrl,
      rt_id: sesi.rtId,
    }]).select("id").maybeSingle();
    if (error || !inserted) {
      await penyimpanan.storage.from("lapak_warga").remove([fileName]);
      throw new Error("Lapak gagal disimpan.");
    }
  }

  async function hapusLapakKu(idLapak: string) {
    "use server";
    const sesi = await wajibOtentikasiWarga();
    const idBersih = String(idLapak || "").trim();
    if (!POLA_UUID.test(idBersih)) throw new Error("ID lapak tidak valid.");
    const supabase = await buatKlienTerautentikasi(sesi);
    const { data: terhapus, error } = await supabase
      .from("lapak_warga")
      .delete()
      .eq("id", idBersih)
      .eq("warga_id", sesi.id)
      .eq("rt_id", sesi.rtId)
      .select("id")
      .maybeSingle();
    if (error || !terhapus) throw new Error("Lapak tidak ditemukan atau bukan milik Anda.");
  }

  // SERVER ACTION: Teknisi Menyelesaikan Pekerjaan & Input Tagihan
  async function selesaikanReparasi(idBarang: string, biaya: number, isGagal: boolean) {
    "use server";
    const sesi = await wajibOtentikasiWarga();
    const idBersih = String(idBarang || "").trim();
    if (!POLA_UUID.test(idBersih) || typeof isGagal !== "boolean") {
      throw new Error("Order reparasi tidak valid.");
    }
    const biayaBersih = Number(biaya);
    if (!isGagal && (!Number.isSafeInteger(biayaBersih) || biayaBersih < 1000 || biayaBersih > MAKS_BIAYA_REPARASI)) {
      throw new Error("Biaya reparasi tidak valid.");
    }
    const supabase = await buatKlienTerautentikasi(sesi);

    // ID teknisi di limbah_ekonomis adalah ID lapak, bukan ID warga. Pastikan
    // lapak tersebut aktif, berkategori jasa, dan berada pada RT sesi ini.
    const { data: lapakTeknisi, error: errTeknisi } = await supabase
      .from("lapak_warga")
      .select("id")
      .eq("warga_id", sesi.id)
      .eq("rt_id", sesi.rtId)
      .eq("kategori", "Jasa & Servis")
      .eq("status", "Aktif")
      .limit(20);
    const teknisiIds = (lapakTeknisi || []).map((row) => String(row.id)).filter((id) => POLA_UUID.test(id));
    if (errTeknisi || teknisiIds.length === 0) throw new Error("Anda tidak memiliki lapak teknisi aktif.");

    // Potongan Fee RT ditetapkan 10% jika berhasil
    const feeRt = isGagal ? 0 : Math.floor(biayaBersih * 0.1);
    const statusBaru = isGagal ? "Tersedia di Rak Bin" : "Selesai Direparasi"; // Jika gagal, kembalikan ke gudang

    const { data: diperbarui, error } = await supabase
      .from("limbah_ekonomis")
      .update({
        status: statusBaru,
        biaya_reparasi: isGagal ? 0 : biayaBersih,
        fee_rt: feeRt,
      })
      .eq("id", idBersih)
      .eq("rt_id", sesi.rtId)
      .in("teknisi_id", teknisiIds)
      .eq("status", "Sedang Direparasi")
      .select("id")
      .maybeSingle();

    if (error || !diperbarui) throw new Error("Order tidak ditemukan, sudah diproses, atau bukan tugas Anda.");
  }

  return (
    <LapakClient 
      wargaAktif={wargaUntukKlien(wargaAktif)}
      nomorWaDefault={profilWarga?.no_whatsapp || ""} 
      katalog={katalogRes || []} 
      lapakKu={lapakKuRes || []} 
      orderanJasa={orderanJasaRes}
      aksiBuat={buatLapak} 
      aksiHapus={hapusLapakKu} 
      aksiSelesaikanOrder={selesaikanReparasi}
    />
  );
}
