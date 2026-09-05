import { redirect } from "next/navigation";
import PengumumanAdminClient from "./PengumumanAdminClient";
import { kirimNotifikasiKeSemuaWarga } from "@/lib/notifikasi-push";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";
import {
  adminUntukKlien,
  otentikasiAdminAktif,
  wajibOtentikasiAdmin,
} from "@/lib/session-security";

export default async function AdminPengumumanPage() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) redirect("/admin");
  const adminAktif = adminUntukKlien(otentikasi.sesi);
  const rtIdAktif = otentikasi.sesi.rtId;

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);

  // OPTIMASI: Tambahkan limit untuk mencegah OOM
  const { data: pengumumanRes } = await supabaseAdmin
    .from("pengumuman_rt")
    .select("*")
    .eq("rt_id", rtIdAktif)
    .order("tanggal_publikasi", { ascending: false })
    .limit(100);

  // REFACTOR: Injeksi Zero-Trust Barrier di semua fungsi mutasi
  async function simpanPengumuman(judul: string, deskripsi: string, linkDokumen: string) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();
    const judulBersih = String(judul || "").trim().slice(0, 200);
    const deskripsiBersih = String(deskripsi || "").trim().slice(0, 5000);
    const linkBersih = String(linkDokumen || "").trim().slice(0, 500);
    if (!judulBersih || !deskripsiBersih) return { success: false, message: "Judul dan isi pengumuman wajib diisi." };

    const supabase = await buatKlienTerautentikasi(sesi);
    const { data: barisBaru, error } = await supabase.from("pengumuman_rt").insert([
      { judul: judulBersih, deskripsi: deskripsiBersih, link_dokumen: linkBersih || null, rt_id: sesi.rtId }
    ]).select("id").single();
    if (error) return { success: false, message: "Pengumuman gagal disimpan." };

    await supabase.from("audit_log").insert([{
      aktor: sesi.nama, aksi: "Buat Pengumuman Baru", tabel_target: "pengumuman_rt", detail: `Judul: ${judulBersih}`, rt_id: sesi.rtId
    }]);

    try {
      await kirimNotifikasiKeSemuaWarga({
        title: "Pengumuman baru dari pengurus RT",
        body: judulBersih.length > 120 ? `${judulBersih.slice(0, 117)}...` : judulBersih,
        url: "/",
        tag: `pengumuman-${barisBaru?.id || "baru"}`,
      }, sesi.rtId);
    } catch (pushErr) {
      console.error("Pengumuman tersimpan, namun notifikasi push gagal:", pushErr);
    }
  }

  async function editPengumuman(id: string, judul: string, deskripsi: string, linkDokumen: string) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();
    const idBersih = String(id || "").trim();
    const judulBersih = String(judul || "").trim().slice(0, 200);
    const deskripsiBersih = String(deskripsi || "").trim().slice(0, 5000);
    const linkBersih = String(linkDokumen || "").trim().slice(0, 500);
    if (!/^[0-9a-f-]{36}$/i.test(idBersih) || !judulBersih || !deskripsiBersih) return { success: false, message: "Data pengumuman tidak valid." };

    const supabase = await buatKlienTerautentikasi(sesi);
    const { error } = await supabase.from("pengumuman_rt").update({ 
      judul: judulBersih, deskripsi: deskripsiBersih, link_dokumen: linkBersih || null
    }).eq("id", idBersih).eq("rt_id", sesi.rtId).select("id").maybeSingle();
    
    if (error) return { success: false, message: "Pengumuman gagal diperbarui." };

    await supabase.from("audit_log").insert([{
      aktor: sesi.nama, aksi: "Edit Pengumuman", tabel_target: "pengumuman_rt", detail: `Memperbarui pengumuman: ${judulBersih}`, rt_id: sesi.rtId
    }]);
  }

  async function hapusPengumuman(id: string) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();
    const idBersih = String(id || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(idBersih)) return { success: false, message: "ID pengumuman tidak valid." };

    const supabase = await buatKlienTerautentikasi(sesi);
    const { data: target } = await supabase.from("pengumuman_rt").select("judul").eq("id", idBersih).eq("rt_id", sesi.rtId).maybeSingle();
    if (!target) return { success: false, message: "Pengumuman tidak ditemukan dalam cakupan RT Anda." };
    const { data: terhapus, error } = await supabase.from("pengumuman_rt").delete().eq("id", idBersih).eq("rt_id", sesi.rtId).select("id").maybeSingle();
    
    if (error || !terhapus) return { success: false, message: "Pengumuman gagal dihapus atau sudah berubah." };

    await supabase.from("audit_log").insert([{
      aktor: sesi.nama, aksi: "Hapus Pengumuman", tabel_target: "pengumuman_rt", detail: `Menghapus siaran: ${target.judul}`, rt_id: sesi.rtId
    }]);
  }

  return <PengumumanAdminClient 
            adminAktif={adminAktif} 
            pengumumanList={pengumumanRes || []} 
            aksiSimpan={simpanPengumuman} 
            aksiEdit={editPengumuman}
            aksiHapus={hapusPengumuman}
         />;
}
