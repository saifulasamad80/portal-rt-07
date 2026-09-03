import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import RondaAdminClient from "./RondaAdminClient";
import { kirimNotifikasiKeWarga } from "@/lib/notifikasi-push";
import { kueriFallbackStatusAktif, type ErrorSupabase } from "@/lib/arsip-warga";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

type SesiAdmin = { nama?: string; role?: string; rt_id?: string };
type BarisWargaRonda = { id: string; nama_lengkap: string | null };

function buatKlienAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Zero-Trust: JWT diverifikasi ulang di dalam setiap Server Action, dan
 * hasilnya dikembalikan sebagai Result Object agar tidak pernah melempar
 * exception yang bisa memicu crash React/Vercel.
 */
async function otentikasiAdmin(): Promise<
  { ok: true; sesi: SesiAdmin } | { ok: false; message: string }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) {
    return { ok: false, message: "Akses ditolak: sesi pengurus sudah berakhir. Silakan masuk kembali." };
  }
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { ok: true, sesi: payload as SesiAdmin };
  } catch {
    return { ok: false, message: "Akses ditolak: sesi tidak valid atau telah dimanipulasi. Silakan masuk kembali." };
  }
}

export default async function AdminRondaPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) redirect("/admin");

  let adminAktif: SesiAdmin;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    adminAktif = JSON.parse(JSON.stringify(payload)) as SesiAdmin;
  } catch {
    redirect("/admin");
  }

  const adminAman = {
    ...adminAktif,
    nama: String(adminAktif.nama || "Pengurus"),
    role: String(adminAktif.role || "pengurus"),
  };

  const supabaseAdmin = buatKlienAdmin();

  // FAKTA: Tarik Jadwal Ronda, JOIN dengan nama warga, urutkan dari tanggal terbaru
  const { data: jadwalRes, error: errJadwal } = await supabaseAdmin
    .from("jadwal_ronda")
    .select("*, warga(nama_lengkap)")
    .order("tanggal_tugas", { ascending: false });

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
        .neq("status_aktif", false)
        .order("nama_lengkap", { ascending: true }),
    () =>
      supabaseAdmin
        .from("warga")
        .select("id, nama_lengkap")
        .eq("status_verifikasi", "Disetujui")
        .order("nama_lengkap", { ascending: true })
  );

  if (errWarga) console.error("Gagal memuat daftar petugas ronda:", errWarga.message);

  // FAKTA: Server Action untuk menetapkan jadwal ke database
  async function simpanJadwal(wargaId: string, tanggalTugas: string) {
    "use server";
    try {
      const otentikasi = await otentikasiAdmin();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };

      const idBersih = String(wargaId || "").trim();
      if (!POLA_UUID.test(idBersih)) {
        return { success: false, message: "Petugas belum dipilih atau ID warga tidak valid." };
      }

      const tanggalBersih = String(tanggalTugas || "").trim();
      if (!POLA_TANGGAL.test(tanggalBersih)) {
        return { success: false, message: "Tanggal tugas tidak valid. Gunakan format YYYY-MM-DD." };
      }

      const supabase = buatKlienAdmin();

      // Status awal selalu "Menunggu Konfirmasi" sampai warga memvalidasinya di portal
      const { error } = await supabase.from("jadwal_ronda").insert([
        { warga_id: idBersih, tanggal_tugas: tanggalBersih, status: "Menunggu Konfirmasi" },
      ]);
      if (error) return { success: false, message: `Gagal menyimpan jadwal: ${error.message}` };

      // Dapatkan nama warga untuk log audit
      const { data: targetWarga } = await supabase
        .from("warga")
        .select("nama_lengkap")
        .eq("id", idBersih)
        .maybeSingle();

      const namaPetugas = targetWarga?.nama_lengkap || "Warga";

      const { error: errAudit } = await supabase.from("audit_log").insert([
        {
          aktor: otentikasi.sesi.nama || "pengurus",
          aksi: "Menetapkan Jadwal Ronda",
          tabel_target: "jadwal_ronda",
          detail: `Menugaskan ${namaPetugas} untuk tanggal ${tanggalBersih}`,
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
      const otentikasi = await otentikasiAdmin();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };

      const idBersih = String(idJadwal || "").trim();
      if (!POLA_UUID.test(idBersih)) {
        return { success: false, message: "ID jadwal tidak valid." };
      }

      const supabase = buatKlienAdmin();

      const { error } = await supabase.from("jadwal_ronda").delete().eq("id", idBersih);
      if (error) return { success: false, message: `Gagal membatalkan jadwal: ${error.message}` };

      const { error: errAudit } = await supabase.from("audit_log").insert([
        {
          aktor: otentikasi.sesi.nama || "pengurus",
          aksi: "Membatalkan Jadwal Ronda",
          tabel_target: "jadwal_ronda",
          detail: `ID Jadwal: ${idBersih} telah dihapus`,
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
