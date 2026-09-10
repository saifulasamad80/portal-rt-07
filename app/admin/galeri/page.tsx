import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import GaleriAdminClient from "./GaleriAdminClient";
import { KATEGORI_GALERI, KUOTA_FOTO_GALERI, BUCKET_GALERI } from "@/lib/batas-berkas-unggah";
import { hapusBerkasPublikDariUrl, unggahBerkasPublik } from "@/lib/penyimpanan-konten-publik";
import { segarKanPortalPublik } from "@/lib/segar-portal-publik";
import { parseDataUrlGambar } from "@/lib/validasi-berkas-unggah";
import { buatKlienTerautentikasi, getSupabaseAdminClientDariSesi } from "@/lib/supabase-server";
import {
  adminUntukKlien,
  otentikasiAdminAktif,
  wajibOtentikasiAdmin,
} from "@/lib/session-security";
import { POLA_UUID } from "@/lib/uuid-tenant";

const KATEGORI_SAH = new Set<string>(KATEGORI_GALERI);

export default async function AdminGaleriPage() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) redirect("/admin");
  const adminAktif = adminUntukKlien(otentikasi.sesi);
  const rtIdAktif = otentikasi.sesi.rtId;

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);
  const { data: daftarFoto } = await supabaseAdmin
    .from("galeri_kegiatan")
    .select("id, judul, deskripsi, url_foto, kategori, tanggal_kegiatan, dipublikasikan, urutan, created_at")
    .eq("rt_id", rtIdAktif)
    .order("urutan", { ascending: true })
    .order("tanggal_kegiatan", { ascending: false })
    .limit(KUOTA_FOTO_GALERI);

  async function simpanFoto(payload: unknown) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { success: false, message: "Data foto tidak valid." };
    }
    const input = payload as Record<string, unknown>;
    const judul = String(input.judul || "").trim().slice(0, 120);
    const deskripsi = String(input.deskripsi || "").trim().slice(0, 500);
    const kategori = String(input.kategori || "").trim();
    const tanggal = String(input.tanggalKegiatan || "").trim();
    const urutan = Number(input.urutan);
    const dipublikasikan = input.dipublikasikan !== false;
    const fotoDataUrl = input.fotoDataUrl;

    if (!judul) return { success: false, message: "Judul foto wajib diisi." };
    if (!KATEGORI_SAH.has(kategori)) return { success: false, message: "Kategori kegiatan tidak valid." };
    if (tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return { success: false, message: "Tanggal kegiatan tidak valid." };
    }
    if (!Number.isInteger(urutan) || urutan < 0 || urutan > 999) {
      return { success: false, message: "Urutan tampil harus 0–999." };
    }

    const foto = parseDataUrlGambar(fotoDataUrl);
    if ("error" in foto) return { success: false, message: foto.error };

    const supabase = await buatKlienTerautentikasi(sesi);
    const { count, error: errKuota } = await supabase
      .from("galeri_kegiatan")
      .select("id", { count: "exact", head: true })
      .eq("rt_id", sesi.rtId);
    if (errKuota) return { success: false, message: "Kuota galeri belum dapat diverifikasi." };
    if ((count || 0) >= KUOTA_FOTO_GALERI) {
      return { success: false, message: `Galeri penuh. Maksimal ${KUOTA_FOTO_GALERI} foto per RT.` };
    }

    const penyimpanan = getSupabaseAdminClientDariSesi(sesi);
    const unggah = await unggahBerkasPublik(penyimpanan, BUCKET_GALERI, sesi.rtId, foto.buffer, foto.contentType, foto.ekstensi);
    if ("error" in unggah) return { success: false, message: unggah.error };

    const { error } = await supabase.from("galeri_kegiatan").insert([{
      judul,
      deskripsi: deskripsi || null,
      url_foto: unggah.urlPublik,
      kategori,
      tanggal_kegiatan: tanggal || null,
      dipublikasikan,
      urutan,
      rt_id: sesi.rtId,
    }]);
    if (error) {
      await hapusBerkasPublikDariUrl(penyimpanan, BUCKET_GALERI, unggah.urlPublik, sesi.rtId);
      return { success: false, message: "Foto gagal disimpan ke galeri." };
    }

    await supabase.from("audit_log").insert([{
      aktor: sesi.nama,
      aksi: "Unggah Galeri",
      tabel_target: "galeri_kegiatan",
      detail: `Judul: ${judul}`,
      rt_id: sesi.rtId,
    }]);

    segarKanPortalPublik();
    revalidatePath("/admin/galeri");
    return { success: true, message: "Foto galeri berhasil diunggah." };
  }

  async function ubahFoto(id: string, payload: unknown) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();
    const idBersih = String(id || "").trim();
    if (!POLA_UUID.test(idBersih)) return { success: false, message: "ID foto tidak valid." };
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { success: false, message: "Data foto tidak valid." };
    }
    const input = payload as Record<string, unknown>;
    const judul = String(input.judul || "").trim().slice(0, 120);
    const deskripsi = String(input.deskripsi || "").trim().slice(0, 500);
    const kategori = String(input.kategori || "").trim();
    const tanggal = String(input.tanggalKegiatan || "").trim();
    const urutan = Number(input.urutan);
    const dipublikasikan = input.dipublikasikan !== false;
    const fotoDataUrl = typeof input.fotoDataUrl === "string" ? input.fotoDataUrl : "";

    if (!judul) return { success: false, message: "Judul foto wajib diisi." };
    if (!KATEGORI_SAH.has(kategori)) return { success: false, message: "Kategori kegiatan tidak valid." };
    if (tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return { success: false, message: "Tanggal kegiatan tidak valid." };
    }
    if (!Number.isInteger(urutan) || urutan < 0 || urutan > 999) {
      return { success: false, message: "Urutan tampil harus 0–999." };
    }

    const supabase = await buatKlienTerautentikasi(sesi);
    const { data: lama } = await supabase
      .from("galeri_kegiatan")
      .select("id, url_foto")
      .eq("id", idBersih)
      .eq("rt_id", sesi.rtId)
      .maybeSingle();
    if (!lama) return { success: false, message: "Foto tidak ditemukan dalam cakupan RT Anda." };

    const pembaruan: Record<string, unknown> = {
      judul,
      deskripsi: deskripsi || null,
      kategori,
      tanggal_kegiatan: tanggal || null,
      dipublikasikan,
      urutan,
    };

    const penyimpanan = getSupabaseAdminClientDariSesi(sesi);
    let urlBaru: string | null = null;
    if (fotoDataUrl) {
      const foto = parseDataUrlGambar(fotoDataUrl);
      if ("error" in foto) return { success: false, message: foto.error };
      const unggah = await unggahBerkasPublik(penyimpanan, BUCKET_GALERI, sesi.rtId, foto.buffer, foto.contentType, foto.ekstensi);
      if ("error" in unggah) return { success: false, message: unggah.error };
      pembaruan.url_foto = unggah.urlPublik;
      urlBaru = unggah.urlPublik;
    }

    const { error } = await supabase
      .from("galeri_kegiatan")
      .update(pembaruan)
      .eq("id", idBersih)
      .eq("rt_id", sesi.rtId);
    if (error) {
      if (urlBaru) await hapusBerkasPublikDariUrl(penyimpanan, BUCKET_GALERI, urlBaru, sesi.rtId);
      return { success: false, message: "Data foto gagal diperbarui." };
    }

    if (urlBaru && lama.url_foto) {
      await hapusBerkasPublikDariUrl(penyimpanan, BUCKET_GALERI, lama.url_foto, sesi.rtId);
    }

    await supabase.from("audit_log").insert([{
      aktor: sesi.nama,
      aksi: "Edit Galeri",
      tabel_target: "galeri_kegiatan",
      detail: `Judul: ${judul}`,
      rt_id: sesi.rtId,
    }]);

    segarKanPortalPublik();
    revalidatePath("/admin/galeri");
    return { success: true, message: "Data foto berhasil diperbarui." };
  }

  async function hapusFoto(id: string) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();
    const idBersih = String(id || "").trim();
    if (!POLA_UUID.test(idBersih)) return { success: false, message: "ID foto tidak valid." };

    const supabase = await buatKlienTerautentikasi(sesi);
    const { data: target } = await supabase
      .from("galeri_kegiatan")
      .select("id, judul, url_foto")
      .eq("id", idBersih)
      .eq("rt_id", sesi.rtId)
      .maybeSingle();
    if (!target) return { success: false, message: "Foto tidak ditemukan dalam cakupan RT Anda." };

    const { data: terhapus, error } = await supabase
      .from("galeri_kegiatan")
      .delete()
      .eq("id", idBersih)
      .eq("rt_id", sesi.rtId)
      .select("id")
      .maybeSingle();
    if (error || !terhapus) return { success: false, message: "Foto gagal dihapus." };

    await hapusBerkasPublikDariUrl(getSupabaseAdminClientDariSesi(sesi), BUCKET_GALERI, target.url_foto, sesi.rtId);

    await supabase.from("audit_log").insert([{
      aktor: sesi.nama,
      aksi: "Hapus Galeri",
      tabel_target: "galeri_kegiatan",
      detail: `Judul: ${target.judul}`,
      rt_id: sesi.rtId,
    }]);

    segarKanPortalPublik();
    revalidatePath("/admin/galeri");
    return { success: true, message: "Foto galeri dihapus." };
  }

  return (
    <GaleriAdminClient
      adminAktif={adminAktif}
      daftarFoto={daftarFoto || []}
      kuota={KUOTA_FOTO_GALERI}
      aksiSimpan={simpanFoto}
      aksiUbah={ubahFoto}
      aksiHapus={hapusFoto}
    />
  );
}
