import { redirect } from "next/navigation";
import RondaAdminClient from "./RondaAdminClient";
import { kirimNotifikasiKeWarga } from "@/lib/notifikasi-push";
import { kueriFallbackStatusAktif, type ErrorSupabase } from "@/lib/arsip-warga";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";
import {
  adminUntukKlien,
  otentikasiAdminAktif,
  wajibOtentikasiAdmin,
  adminBolehMengaksesRt,
} from "@/lib/session-security";

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

type BarisWargaRonda = { id: string; nama_lengkap: string | null };

export default async function AdminRondaPage() {
  const otentikasiHalaman = await otentikasiAdminAktif();
  if (!otentikasiHalaman.ok) redirect("/admin");
  const adminAman = adminUntukKlien(otentikasiHalaman.sesi);

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasiHalaman.sesi);

  // FAKTA: Tarik Jadwal Ronda, JOIN dengan nama warga, urutkan dari tanggal terbaru
  let queryJadwal = supabaseAdmin
    .from("jadwal_ronda")
    .select("*, warga(nama_lengkap)")
    .order("tanggal_tugas", { ascending: false });
  if (otentikasiHalaman.sesi.role !== "webmaster") queryJadwal = queryJadwal.eq("rt_id", otentikasiHalaman.sesi.rtId);
  const { data: jadwalRes, error: errJadwal } = await queryJadwal.limit(500);

  if (errJadwal) console.error("Gagal memuat jadwal ronda:", errJadwal.message);

  // FAKTA: Tarik daftar warga yang terverifikasi untuk dropdown petugas.
  // Filter status_aktif hanya berlaku bila migrasi wargaku-v2 sudah dijalankan;
  // bila belum, query diulang tanpa filter agar dropdown tidak kosong total.
  const { data: wargaRes, error: errWarga } = await kueriFallbackStatusAktif<{
    data: BarisWargaRonda[] | null;
    error: ErrorSupabase;
  }>(
    () =>
      supabaseAdmin
        .from("warga")
        .select("id, nama_lengkap")
        .eq("status_verifikasi", "Disetujui")
        .eq("rt_id", otentikasiHalaman.sesi.rtId)
        .neq("status_aktif", false)
        .order("nama_lengkap", { ascending: true }),
    () =>
      supabaseAdmin
        .from("warga")
        .select("id, nama_lengkap")
        .eq("status_verifikasi", "Disetujui")
        .eq("rt_id", otentikasiHalaman.sesi.rtId)
        .order("nama_lengkap", { ascending: true })
  );

  if (errWarga) console.error("Gagal memuat daftar petugas ronda:", errWarga.message);

  // FAKTA: Server Action untuk menetapkan jadwal ke database
  async function simpanJadwal(wargaId: string, tanggalTugas: string) {
    "use server";
    try {
      const sesi = await wajibOtentikasiAdmin();

      const idBersih = String(wargaId || "").trim();
      if (!POLA_UUID.test(idBersih)) {
        return { success: false, message: "Petugas belum dipilih atau ID warga tidak valid." };
      }

      const tanggalBersih = String(tanggalTugas || "").trim();
      if (!POLA_TANGGAL.test(tanggalBersih)) {
        return { success: false, message: "Tanggal tugas tidak valid. Gunakan format YYYY-MM-DD." };
      }

      const supabase = await buatKlienTerautentikasi(sesi);

      const { data: targetWarga, error: errTarget } = await supabase
        .from("warga")
        .select("id, nama_lengkap, rt_id, status_verifikasi")
        .eq("id", idBersih)
        .maybeSingle();
      if (errTarget || !targetWarga || targetWarga.status_verifikasi !== "Disetujui" || !adminBolehMengaksesRt(sesi, targetWarga.rt_id)) {
        return { success: false, message: "Petugas tidak berada dalam cakupan RT Anda." };
      }

      // Status awal selalu "Menunggu Konfirmasi" sampai warga memvalidasinya di portal
      const { error } = await supabase.from("jadwal_ronda").insert([
        { warga_id: idBersih, rt_id: targetWarga.rt_id, tanggal_tugas: tanggalBersih, status: "Menunggu Konfirmasi" },
      ]);
      if (error) return { success: false, message: `Gagal menyimpan jadwal: ${error.message}` };

      // Dapatkan nama warga untuk log audit
      const namaPetugas = targetWarga?.nama_lengkap || "Warga";

      const { error: errAudit } = await supabase.from("audit_log").insert([
        {
          aktor: sesi.nama || "pengurus",
          aksi: "Menetapkan Jadwal Ronda",
          tabel_target: "jadwal_ronda",
          detail: `Menugaskan ${namaPetugas} untuk tanggal ${tanggalBersih}`,
          rt_id: sesi.rtId,
        },
      ]);
      if (errAudit) console.error("Audit log jadwal ronda gagal dicatat:", errAudit.message);

      // Jadwal sudah tersimpan; kegagalan push tidak boleh membatalkannya.
      try {
        await kirimNotifikasiKeWarga(idBersih, {
          title: "Anda dijadwalkan siskamling",
          body: `${namaPetugas} bertugas ronda pada ${tanggalBersih}. Buka portal untuk konfirmasi.`,
          url: "/portal/ronda",
          tag: "siskamling",
        });
      } catch (pushErr) {
        console.error("Jadwal tersimpan, namun notifikasi push gagal:", pushErr);
      }

      return { success: true, message: `Jadwal ronda untuk ${namaPetugas} berhasil ditetapkan.` };
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal server saat menyimpan jadwal.";
      return { success: false, message: pesan };
    }
  }

  // FAKTA: Server Action untuk membatalkan/menghapus jadwal
  async function hapusJadwal(idJadwal: string) {
    "use server";
    try {
      const sesi = await wajibOtentikasiAdmin();

      const idBersih = String(idJadwal || "").trim();
      if (!POLA_UUID.test(idBersih)) {
        return { success: false, message: "ID jadwal tidak valid." };
      }

      const supabase = await buatKlienTerautentikasi(sesi);

      let queryTarget = supabase.from("jadwal_ronda").select("id, rt_id").eq("id", idBersih);
      if (sesi.role !== "webmaster") queryTarget = queryTarget.eq("rt_id", sesi.rtId);
      const { data: target } = await queryTarget.maybeSingle();
      if (!target) return { success: false, message: "Jadwal tidak berada dalam cakupan RT Anda." };

      let queryHapus = supabase.from("jadwal_ronda").delete().eq("id", idBersih);
      if (sesi.role !== "webmaster") queryHapus = queryHapus.eq("rt_id", sesi.rtId);
      const { data: terhapus, error } = await queryHapus.select("id").maybeSingle();
      if (error || !terhapus) return { success: false, message: "Jadwal sudah berubah atau gagal dibatalkan." };

      const { error: errAudit } = await supabase.from("audit_log").insert([
        {
          aktor: sesi.nama || "pengurus",
          aksi: "Membatalkan Jadwal Ronda",
          tabel_target: "jadwal_ronda",
          detail: `ID Jadwal: ${idBersih} telah dihapus`,
          rt_id: sesi.rtId,
        },
      ]);
      if (errAudit) console.error("Audit log pembatalan ronda gagal dicatat:", errAudit.message);

      return { success: true, message: "Jadwal ronda berhasil dibatalkan." };
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal server saat membatalkan jadwal.";
      return { success: false, message: pesan };
    }
  }

  return (
    <RondaAdminClient
      adminAktif={adminAman}
      jadwalList={jadwalRes || []}
      wargaList={wargaRes || []}
      aksiSimpan={simpanJadwal}
      aksiHapus={hapusJadwal}
    />
  );
}
