import { redirect } from "next/navigation";
import PengumumanAdminClient from "./PengumumanAdminClient";
import { BUCKET_LAMPIRAN_PENGUMUMAN } from "@/lib/batas-berkas-unggah";
import { kirimNotifikasiKeSemuaWarga } from "@/lib/notifikasi-push";
import { hapusBerkasPublikDariUrl, unggahBerkasPublik, unggahBerkasPublikKePath } from "@/lib/penyimpanan-konten-publik";
import { segarKanPortalPublik } from "@/lib/segar-portal-publik";
import { buatKlienTerautentikasi, getSupabaseAdminClientDariSesi } from "@/lib/supabase-server";
import {
  adminUntukKlien,
  otentikasiAdminAktif,
  wajibOtentikasiAdmin,
} from "@/lib/session-security";
import { parseDataUrlLampiran } from "@/lib/validasi-berkas-unggah";

async function unggahThumbnailPdfJikaAda(
  penyimpanan: ReturnType<typeof getSupabaseAdminClientDariSesi>,
  pathPdf: string,
  rtId: string,
  pdfBuffer: Buffer,
) {
  if (!/\.pdf$/i.test(pathPdf)) return;
  const pathThumb = pathPdf.replace(/\.pdf$/i, ".thumb.jpg");
  if (!pathThumb.startsWith(`${rtId}/`)) return;
  const { jpegHalamanPertamaPdfServer } = await import("@/lib/thumbnail-pdf-server");
  const jpeg = await jpegHalamanPertamaPdfServer(pdfBuffer);
  if (!jpeg) return;
  await unggahBerkasPublikKePath(
    penyimpanan,
    BUCKET_LAMPIRAN_PENGUMUMAN,
    pathThumb,
    jpeg,
    "image/jpeg",
    { timpa: true },
  );
}

export default async function AdminPengumumanPage() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) redirect("/admin");
  const adminAktif = adminUntukKlien(otentikasi.sesi);
  const rtIdAktif = otentikasi.sesi.rtId;

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);

  const [{ data: pengumumanRes }, { data: masterRt }] = await Promise.all([
    supabaseAdmin
      .from("pengumuman_rt")
      .select("*")
      .eq("rt_id", rtIdAktif)
      .order("tanggal_publikasi", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("master_rt")
      .select("nama_rt")
      .eq("id", rtIdAktif)
      .maybeSingle(),
  ]);

  async function simpanPengumuman(payload: unknown) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { success: false, message: "Data pengumuman tidak valid." };
    }
    const input = payload as Record<string, unknown>;
    const judulBersih = String(input.judul || "").trim().slice(0, 200);
    const deskripsiBersih = String(input.deskripsi || "").trim().slice(0, 5000);
    const lampiranDataUrl = typeof input.lampiranDataUrl === "string" ? input.lampiranDataUrl : "";
    if (!judulBersih || !deskripsiBersih) return { success: false, message: "Judul dan isi pengumuman wajib diisi." };

    let linkDokumen: string | null = null;
    const penyimpanan = getSupabaseAdminClientDariSesi(sesi);
    if (lampiranDataUrl) {
      const berkas = parseDataUrlLampiran(lampiranDataUrl);
      if ("error" in berkas) return { success: false, message: berkas.error };
      const unggah = await unggahBerkasPublik(penyimpanan, BUCKET_LAMPIRAN_PENGUMUMAN, sesi.rtId, berkas.buffer, berkas.contentType, berkas.ekstensi);
      if ("error" in unggah) return { success: false, message: unggah.error };
      linkDokumen = unggah.urlPublik;
      if (berkas.jenis === "pdf") {
        await unggahThumbnailPdfJikaAda(penyimpanan, unggah.path, sesi.rtId, berkas.buffer);
      }
    }

    const supabase = await buatKlienTerautentikasi(sesi);
    const { data: barisBaru, error } = await supabase.from("pengumuman_rt").insert([
      { judul: judulBersih, deskripsi: deskripsiBersih, link_dokumen: linkDokumen, rt_id: sesi.rtId }
    ]).select("id").single();
    if (error) {
      if (linkDokumen) await hapusBerkasPublikDariUrl(penyimpanan, BUCKET_LAMPIRAN_PENGUMUMAN, linkDokumen, sesi.rtId);
      return { success: false, message: "Pengumuman gagal disimpan." };
    }

    await supabase.from("audit_log").insert([{
      aktor: sesi.nama, aksi: "Buat Pengumuman Baru", tabel_target: "pengumuman_rt", detail: `Judul: ${judulBersih}`, rt_id: sesi.rtId
    }]);

    try {
      await kirimNotifikasiKeSemuaWarga({
        title: "Pengumuman baru dari pengurus RT",
        body: judulBersih.length > 120 ? `${judulBersih.slice(0, 117)}...` : judulBersih,
        url: barisBaru?.id ? `/pengumuman/${barisBaru.id}` : "/portal",
        tag: `pengumuman-${barisBaru?.id || "baru"}`,
      }, sesi.rtId);
    } catch (pushErr) {
      console.error("Pengumuman tersimpan, namun notifikasi push gagal:", pushErr);
    }

    segarKanPortalPublik();
    return { success: true, message: "Pengumuman berhasil disebarkan.", id: barisBaru?.id };
  }

  async function editPengumuman(id: string, payload: unknown) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();
    const idBersih = String(id || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(idBersih)) return { success: false, message: "Data pengumuman tidak valid." };
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { success: false, message: "Data pengumuman tidak valid." };
    }
    const input = payload as Record<string, unknown>;
    const judulBersih = String(input.judul || "").trim().slice(0, 200);
    const deskripsiBersih = String(input.deskripsi || "").trim().slice(0, 5000);
    const lampiranDataUrl = typeof input.lampiranDataUrl === "string" ? input.lampiranDataUrl : "";
    const hapusLampiran = input.hapusLampiran === true;
    if (!judulBersih || !deskripsiBersih) return { success: false, message: "Judul dan isi pengumuman wajib diisi." };

    const supabase = await buatKlienTerautentikasi(sesi);
    const { data: lama } = await supabase
      .from("pengumuman_rt")
      .select("id, link_dokumen")
      .eq("id", idBersih)
      .eq("rt_id", sesi.rtId)
      .maybeSingle();
    if (!lama) return { success: false, message: "Pengumuman tidak ditemukan dalam cakupan RT Anda." };

    const pembaruan: Record<string, unknown> = {
      judul: judulBersih,
      deskripsi: deskripsiBersih,
    };
    const penyimpanan = getSupabaseAdminClientDariSesi(sesi);
    let urlBaru: string | null = null;

    if (lampiranDataUrl) {
      const berkas = parseDataUrlLampiran(lampiranDataUrl);
      if ("error" in berkas) return { success: false, message: berkas.error };
      const unggah = await unggahBerkasPublik(penyimpanan, BUCKET_LAMPIRAN_PENGUMUMAN, sesi.rtId, berkas.buffer, berkas.contentType, berkas.ekstensi);
      if ("error" in unggah) return { success: false, message: unggah.error };
      pembaruan.link_dokumen = unggah.urlPublik;
      urlBaru = unggah.urlPublik;
      if (berkas.jenis === "pdf") {
        await unggahThumbnailPdfJikaAda(penyimpanan, unggah.path, sesi.rtId, berkas.buffer);
      }
    } else if (hapusLampiran) {
      pembaruan.link_dokumen = null;
    }

    const { error } = await supabase
      .from("pengumuman_rt")
      .update(pembaruan)
      .eq("id", idBersih)
      .eq("rt_id", sesi.rtId)
      .select("id")
      .maybeSingle();
    if (error) {
      if (urlBaru) await hapusBerkasPublikDariUrl(penyimpanan, BUCKET_LAMPIRAN_PENGUMUMAN, urlBaru, sesi.rtId);
      return { success: false, message: "Pengumuman gagal diperbarui." };
    }

    if ((urlBaru || hapusLampiran) && lama.link_dokumen) {
      await hapusBerkasPublikDariUrl(penyimpanan, BUCKET_LAMPIRAN_PENGUMUMAN, lama.link_dokumen, sesi.rtId);
    }

    await supabase.from("audit_log").insert([{
      aktor: sesi.nama, aksi: "Edit Pengumuman", tabel_target: "pengumuman_rt", detail: `Memperbarui pengumuman: ${judulBersih}`, rt_id: sesi.rtId
    }]);

    segarKanPortalPublik();
    return { success: true, message: "Pengumuman berhasil diperbarui." };
  }

  async function hapusPengumuman(id: string) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();
    const idBersih = String(id || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(idBersih)) return { success: false, message: "ID pengumuman tidak valid." };

    const supabase = await buatKlienTerautentikasi(sesi);
    const { data: target } = await supabase.from("pengumuman_rt").select("judul, link_dokumen").eq("id", idBersih).eq("rt_id", sesi.rtId).maybeSingle();
    if (!target) return { success: false, message: "Pengumuman tidak ditemukan dalam cakupan RT Anda." };
    const { data: terhapus, error } = await supabase.from("pengumuman_rt").delete().eq("id", idBersih).eq("rt_id", sesi.rtId).select("id").maybeSingle();

    if (error || !terhapus) return { success: false, message: "Pengumuman gagal dihapus atau sudah berubah." };

    await hapusBerkasPublikDariUrl(getSupabaseAdminClientDariSesi(sesi), BUCKET_LAMPIRAN_PENGUMUMAN, target.link_dokumen, sesi.rtId);

    await supabase.from("audit_log").insert([{
      aktor: sesi.nama, aksi: "Hapus Pengumuman", tabel_target: "pengumuman_rt", detail: `Menghapus siaran: ${target.judul}`, rt_id: sesi.rtId
    }]);

    segarKanPortalPublik();
    return { success: true, message: "Pengumuman dihapus." };
  }

  return <PengumumanAdminClient
            adminAktif={adminAktif}
            namaRt={String(masterRt?.nama_rt || "RT").trim() || "RT"}
            pengumumanList={pengumumanRes || []}
            aksiSimpan={simpanPengumuman}
            aksiEdit={editPengumuman}
            aksiHapus={hapusPengumuman}
         />;
}
