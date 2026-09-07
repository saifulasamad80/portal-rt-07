import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import VerifikasiWargaClient, { type WargaAntrean } from "./VerifikasiWargaClient";
import { prosesValidasiAkunWarga } from "@/lib/validasi-akun-warga";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";
import { otentikasiAdminAktif as otentikasiAdmin } from "@/lib/session-security";
import { POLA_UUID } from "@/lib/uuid-tenant";

export default async function VerifikasiWargaPage() {
  const otentikasiHalaman = await otentikasiAdmin();
  if (!otentikasiHalaman.ok) redirect("/admin");

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasiHalaman.sesi);

  const queryAntrean = supabaseAdmin
    .from("warga")
    .select(`
      id,
      nik,
      nama_lengkap,
      no_whatsapp,
      status_tinggal,
      detail_alamat,
      status_verifikasi,
      status_validasi,
      created_at,
      ktp_path,
      kk_path,
      rt_id,
      anggota_keluarga (id, nama_lengkap, hubungan_keluarga, rt_id)
    `)
    .eq("status_validasi", "Menunggu")
    .eq("rt_id", otentikasiHalaman.sesi.rtId);

  const { data: antreanRes, error: errAntrean } = await queryAntrean.order("created_at", { ascending: true });
  if (errAntrean) console.error("Gagal memuat antrean verifikasi:", errAntrean.message);

  const antreanAman: WargaAntrean[] = (Array.isArray(antreanRes) ? antreanRes : []).map((warga: Record<string, unknown>) => {
    const rtIdWarga = String(warga.rt_id || "");
    const anggotaMentah = Array.isArray(warga.anggota_keluarga) ? warga.anggota_keluarga : [];
    const anggotaKeluarga = anggotaMentah
      .filter((anggota: { rt_id?: unknown }) => String(anggota?.rt_id || "") === rtIdWarga)
      .map((anggota: Record<string, unknown>) => ({
        id: anggota.id == null ? undefined : String(anggota.id),
        nama_lengkap: anggota.nama_lengkap == null ? null : String(anggota.nama_lengkap),
        hubungan_keluarga: anggota.hubungan_keluarga == null ? null : String(anggota.hubungan_keluarga),
      }));
    return {
      id: String(warga.id),
      nik: warga.nik == null ? null : String(warga.nik),
      nama_lengkap: warga.nama_lengkap == null ? null : String(warga.nama_lengkap),
      no_whatsapp: warga.no_whatsapp == null ? null : String(warga.no_whatsapp),
      status_tinggal: warga.status_tinggal == null ? null : String(warga.status_tinggal),
      detail_alamat: warga.detail_alamat == null ? null : String(warga.detail_alamat),
      status_verifikasi: warga.status_verifikasi == null ? null : String(warga.status_verifikasi),
      status_validasi: warga.status_validasi == null ? null : String(warga.status_validasi),
      ktp_path: warga.ktp_path == null ? null : String(warga.ktp_path),
      kk_path: warga.kk_path == null ? null : String(warga.kk_path),
      created_at: warga.created_at == null ? null : String(warga.created_at),
      anggota_keluarga: anggotaKeluarga,
    };
  });

  let tautanRujukan = "/register";
  if (rtTerbatas && POLA_UUID.test(rtTerbatas)) {
    const { data: master } = await supabaseAdmin
      .from("master_rt")
      .select("kode_rujukan")
      .eq("id", rtTerbatas)
      .maybeSingle();
    const kode = String(master?.kode_rujukan || "").trim().toLowerCase();
    if (kode) tautanRujukan = `/register?rt=${kode}`;
  }

  async function prosesValidasi(idWarga: string, status: string) {
    "use server";
    try {
      const otentikasi = await otentikasiAdmin();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };

      const idBersih = String(idWarga || "").trim();
      if (!POLA_UUID.test(idBersih)) {
        return { success: false, message: "ID warga tidak valid." };
      }

      const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
      const hasil = await prosesValidasiAkunWarga(
        supabase,
        otentikasi.sesi,
        idBersih,
        status,
        "Verifikasi Pendaftaran"
      );
      if (hasil.success) revalidatePath("/");
      return hasil;
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal server saat memvalidasi.";
      return { success: false, message: pesan };
    }
  }

  return (
    <VerifikasiWargaClient
      wargaList={antreanAman}
      tautanRujukan={tautanRujukan}
      prosesValidasi={prosesValidasi}
    />
  );
}
