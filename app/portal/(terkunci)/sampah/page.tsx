import { redirect } from "next/navigation";
import SampahClient from "./SampahClient"; // Kita pisah Client Component-nya
import { otentikasiWargaAktif, wajibOtentikasiWarga, wargaUntukKlien } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";


export default async function PortalSampahPage() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");
  const wargaAktif = otentikasi.sesi;

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);

  // 1. Tarik Data Sampah Kiloan (Tabungan Tradisional)
  const { data: kiloanRes } = await supabaseAdmin
    .from("transaksi_sampah")
    .select("berat_kg, jenis_transaksi, nominal_warga, tanggal_transaksi, keterangan")
    .eq("warga_id", wargaAktif.id)
    .eq("rt_id", wargaAktif.rtId)
    .order("tanggal_transaksi", { ascending: false })
    .limit(1000);

  const riwayatKiloan = kiloanRes || [];
  const totalSetorWarga = riwayatKiloan.filter(t => t.jenis_transaksi === "Setor").reduce((sum, t) => sum + t.nominal_warga, 0);
  const totalTarikWarga = riwayatKiloan.filter(t => t.jenis_transaksi === "Tarik").reduce((sum, t) => sum + t.nominal_warga, 0);
  const saldoKiloan = totalSetorWarga - totalTarikWarga;
  const totalBeratKiloan = riwayatKiloan.filter(t => t.jenis_transaksi === "Setor").reduce((sum, t) => sum + (t.berat_kg || 0), 0);

  // 2. Tarik Data Limbah Ekonomis (Rak Bin)
  // Perhatikan: Kita join ke tabel lapak_warga untuk narik nama Teknisi (Jika sudah di-assign RT)
  const { data: rakBinRes } = await supabaseAdmin
    .from("limbah_ekonomis")
    .select("id, nama_barang, kategori, opsi_tujuan, status, lapak_warga(nama_usaha, nomor_wa)")
    .eq("warga_id", wargaAktif.id)
    .eq("rt_id", wargaAktif.rtId)
    .order("created_at", { ascending: false });

  const riwayatRakBin = rakBinRes || [];

  // FAKTA: Server Action untuk melempar barang ke Rak Bin
  async function laporLimbahEkonomis(payload: unknown) {
    "use server";
    const sesi = await wajibOtentikasiWarga();

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Data barang tidak valid.");
    }
    const input = payload as Record<string, unknown>;
    const namaBarang = String(input.nama_barang || "").trim().slice(0, 200);
    const kategori = String(input.kategori || "").trim();
    const opsiTujuan = String(input.opsi_tujuan || "").trim();
    const deskripsi = String(input.deskripsi || "").trim().slice(0, 2000);
    const kategoriDiizinkan = ["Elektronik", "Furnitur", "Otomotif/Sepeda", "Pakaian/Kain"];
    const tujuanDiizinkan = ["Hibah ke RT", "Jual via RT (Konsinyasi)", "Reparasi (Via UMKM Warga)"];
    if (!namaBarang || !deskripsi || !kategoriDiizinkan.includes(kategori) || !tujuanDiizinkan.includes(opsiTujuan)) {
      throw new Error("Data barang tidak valid.");
    }

    const supabase = await buatKlienTerautentikasi(sesi);
    
    const { error } = await supabase.from("limbah_ekonomis").insert([{
      warga_id: sesi.id,
      rt_id: sesi.rtId,
      nama_barang: namaBarang,
      kategori,
      opsi_tujuan: opsiTujuan,
      deskripsi,
      status: "Menunggu Verifikasi"
    }]);

    if (error) throw new Error("Laporan barang gagal disimpan.");
  }

  return (
    <SampahClient 
      wargaAktif={wargaUntukKlien(wargaAktif)}
      saldo={saldoKiloan}
      totalKg={totalBeratKiloan}
      riwayatKiloan={riwayatKiloan}
      riwayatRakBin={riwayatRakBin}
      aksiLaporLimbah={laporLimbahEkonomis}
    />
  );
}
