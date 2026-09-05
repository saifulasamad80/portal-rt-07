import { redirect } from "next/navigation";
import InventarisClient from "./InventarisClient";
import { otentikasiWargaAktif, wajibOtentikasiWarga } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export default async function InventarisPage() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");
  const wargaAktif = otentikasi.sesi;

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);
  
  const [masterRes, riwayatRes, semuaPinjamRes] = await Promise.all([
    supabaseAdmin.from("master_inventaris").select("*").eq("rt_id", wargaAktif.rtId).order("nama_barang", { ascending: true }).limit(500),
    supabaseAdmin.from("peminjaman_inventaris").select("*").eq("warga_id", wargaAktif.id).eq("rt_id", wargaAktif.rtId).order("tanggal_pinjam", { ascending: true }).limit(200),
    // FAKTA: Tarik jadwal barang yang sudah SUKSES DIPINJAM orang lain untuk dilempar ke kalender warga
    supabaseAdmin.from("peminjaman_inventaris").select("nama_barang, tanggal_pinjam").eq("status", "Disetujui").eq("rt_id", wargaAktif.rtId).limit(2000)
  ]);

  // REFACTOR MUTLAK: Eksekusi Validasi Lapis Baja Anti Double-Booking
  async function ajukanBooking(namaBarang: string, tanggal: string, keterangan: string) {
    "use server";
    const sesi = await wajibOtentikasiWarga();
    const namaBersih = String(namaBarang || "").trim().slice(0, 200);
    const tanggalBersih = String(tanggal || "").trim();
    const keteranganBersih = String(keterangan || "").trim().slice(0, 1000);
    if (!namaBersih || !POLA_TANGGAL.test(tanggalBersih)) return { success: false, message: "Barang atau tanggal peminjaman tidak valid." };
    
    const supabaseAdmin = await buatKlienTerautentikasi(sesi);
    
    const { data: barang } = await supabaseAdmin.from("master_inventaris").select("id, nama_barang").eq("nama_barang", namaBersih).eq("rt_id", sesi.rtId).maybeSingle();
    if (!barang) return { success: false, message: "Barang tidak tersedia di RT Anda." };

    // ----------------------------------------------------------------------------------
    // PENGECEKAN DOUBLE-BOOKING DI BACKEND (Menahan serangan brutal / glitch)
    // ----------------------------------------------------------------------------------
    const { data: cekBentrok } = await supabaseAdmin
      .from("peminjaman_inventaris")
      .select("id")
      .eq("nama_barang", namaBersih)
      .eq("tanggal_pinjam", tanggalBersih)
      .eq("rt_id", sesi.rtId)
      .eq("status", "Disetujui"); // Hanya mengecek yang sudah beneran di-ACC Pak RT

    if (cekBentrok && cekBentrok.length > 0) {
      return { success: false, message: "Fasilitas sudah dipesan untuk tanggal tersebut. Silakan pilih tanggal lain." };
    }
    // ----------------------------------------------------------------------------------

    const { error } = await supabaseAdmin.from("peminjaman_inventaris").insert([{
      warga_id: sesi.id, // Gunakan ID asli
      nama_barang: namaBersih,
      tanggal_pinjam: tanggalBersih,
      keterangan: keteranganBersih,
      rt_id: sesi.rtId,
      status: "Menunggu"
    }]);

    if (error) return { success: false, message: error.code === "23505" ? "Fasilitas sudah dipesan untuk tanggal tersebut." : "Peminjaman gagal disimpan." };
    return { success: true, message: "Pengajuan peminjaman terkirim." };
  }

  return <InventarisClient 
           masterBarang={masterRes.data || []} 
           riwayat={riwayatRes.data || []} 
           jadwalTerisi={semuaPinjamRes.data || []} // Lemparkan jadwal yang bentrok ke Client
           ajukanBooking={ajukanBooking} 
         />;
}
