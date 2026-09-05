import { redirect } from "next/navigation";
import KasAdminClient from "./KasAdminClient";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";
import {
  adminUntukKlien,
  otentikasiAdminAktif,
  wajibOtentikasiAdmin,
} from "@/lib/session-security";

export default async function AdminKasPage() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) redirect("/admin");
  const adminAktif = adminUntukKlien(otentikasi.sesi);
  const rtIdAktif = otentikasi.sesi.rtId;

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);

  // OPTIMASI LIMITASI: Batasi output maksimal 500 baris agar tidak terjadi OOM (Memory Leak)
  const { data: dataKas } = await supabaseAdmin
    .from("kas_rt")
    .select("*, warga(nama_lengkap)")
    .eq("rt_id", rtIdAktif)
    .order("created_at", { ascending: false })
    .limit(500);

  const { data: dataWarga } = await supabaseAdmin
    .from("warga")
    .select("id, nama_lengkap")
    .eq("status_verifikasi", "Disetujui")
    .eq("rt_id", rtIdAktif)
    .order("nama_lengkap", { ascending: true })
    .limit(1000);

  // REFACTOR: Kunci Server Action dengan Barrier Otentikasi
  async function simpanTransaksi(tipe: string, wargaId: string, kategori: string, nominal: number, keterangan: string) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();

    const supabase = await buatKlienTerautentikasi(sesi);
    
    // Ambil RT ID secara absolut dari token admin yang tervalidasi, bukan dari closure luar!
    const idRt = sesi.rtId;

    if (!idRt) {
      return { success: false, message: "Akses Ditolak: Sistem gagal memverifikasi ID RT Anda." };
    }

    const tipeBersih = String(tipe || "").trim();
    const kategoriBersih = String(kategori || "").trim().slice(0, 120);
    const keteranganBersih = String(keterangan || "").trim().slice(0, 1000);
    const nominalBersih = Number(nominal);
    if (!["Pemasukan", "Pengeluaran"].includes(tipeBersih)) {
      return { success: false, message: "Tipe transaksi tidak valid." };
    }
    if (!kategoriBersih || !Number.isFinite(nominalBersih) || nominalBersih <= 0) {
      return { success: false, message: "Kategori dan nominal positif wajib diisi." };
    }

    const payload: Record<string, unknown> = {
      tipe_transaksi: tipeBersih,
      kategori: kategoriBersih,
      nominal: nominalBersih,
      keterangan: keteranganBersih || null,
      rt_id: idRt,
    };
    if (wargaId) {
      const idWarga = String(wargaId).trim();
      const { data: targetWarga, error: errTarget } = await supabase
        .from("warga")
        .select("id")
        .eq("id", idWarga)
        .eq("rt_id", idRt)
        .eq("status_verifikasi", "Disetujui")
        .maybeSingle();
      if (errTarget || !targetWarga) return { success: false, message: "Warga transaksi tidak berada dalam cakupan RT Anda." };
      payload.warga_id = targetWarga.id;
    }

    const { error: errorKas } = await supabase.from("kas_rt").insert([payload]);
    if (errorKas) return { success: false, message: errorKas.message };

    await supabase.from("audit_log").insert([{
      aktor: sesi.nama,
      aksi: `Input Kas: ${tipeBersih}`,
      tabel_target: "kas_rt",
      detail: `${kategori} - Rp ${nominal}`,
      rt_id: idRt 
    }]);

    return { success: true };
  }

  return <KasAdminClient 
            adminAktif={adminAktif} 
            transaksiList={dataKas || []} 
            wargaList={dataWarga || []} 
            aksiSimpan={simpanTransaksi} 
         />;
}
