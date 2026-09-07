import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { type SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import AdminLogin from "./AdminLogin";
import AdminDashboardClient from "./AdminDashboardClient";
import { skemaBelumSiap } from "@/lib/arsip-warga";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";
import { otentikasiAdminAktif as otentikasiAdmin } from "@/lib/session-security";
import { prosesValidasiAkunWarga } from "@/lib/validasi-akun-warga";
import { POLA_UUID } from "@/lib/uuid-tenant";

/**
 * Menghitung jumlah KK yang sah.
 *
 * Filter status_aktif hanya bisa dipakai bila migrasi
 * wargaku-v2-push-ibu-soft-delete.sql sudah dijalankan. Bila kolomnya belum
 * ada, PostgREST membalas error 42703 dan `count` menjadi null — inilah
 * penyebab kartu "Warga Sah" menampilkan 0 KK. Query builder Supabase tidak
 * pernah menolak Promise, jadi errornya tertelan tanpa jejak. Di sini error
 * tersebut ditangkap secara eksplisit lalu dihitung ulang tanpa filter arsip.
 *
 * Sengaja TIDAK memakai head: true. Permintaan HEAD dibalas tanpa body,
 * sehingga supabase-js hanya bisa menyusun error kosong ({ message: "" }) dan
 * skemaBelumSiap() kehilangan kode 42703 yang dibutuhkannya. limit(1) menjaga
 * payload tetap ringan; jumlah sebenarnya tetap datang dari header
 * content-range, bukan dari baris yang ikut terkirim.
 */
async function hitungWargaSah(supabase: SupabaseClient, rtId: string | null): Promise<number> {
  const queryDasar = () => {
    let query = supabase
      .from("warga")
      .select("id", { count: "exact" })
      .eq("status_validasi", "Disetujui");
    if (rtId) query = query.eq("rt_id", rtId);
    return query;
  };

  let { count, error } = await queryDasar().neq("status_aktif", false).limit(1);

  if (error && skemaBelumSiap(error)) {
    // Hanya perbedaan skema yang boleh mengaktifkan kompatibilitas. Error
    // jaringan/RLS/timeout tidak boleh diam-diam berubah menjadi query yang
    // lebih longgar karena hasilnya bisa salah (mis. warga arsip ikut
    // terhitung) dan menyamarkan kegagalan database.
    console.warn(
      "Kolom status_aktif belum tersedia; menghitung tanpa filter arsip:",
      error.message || error.code || "database tidak menyertakan detail"
    );
    ({ count, error } = await queryDasar().limit(1));
  }

  if (error) {
    console.error("Gagal menghitung warga sah:", error.message || error.code || "penyebab tidak diketahui");
    return 0;
  }
  return count || 0;
}

export default async function AdminDashboard() {
  const otentikasiHalaman = await otentikasiAdmin();
  if (!otentikasiHalaman.ok) return <AdminLogin />;

  const adminAman = {
    id: otentikasiHalaman.sesi.id,
    nama: otentikasiHalaman.sesi.nama,
    role: otentikasiHalaman.sesi.role,
    rt_id: otentikasiHalaman.sesi.rtId,
  };

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasiHalaman.sesi);

  const rtSesi = otentikasiHalaman.sesi.rtId;
  const queryAntrean = supabaseAdmin
    .from("warga")
    .select(
      "id, nik, nama_lengkap, no_whatsapp, status_tinggal, detail_alamat, status_verifikasi, status_validasi, created_at, ktp_path, kk_path, anggota_keluarga(nama_lengkap, hubungan_keluarga)"
    )
    .eq("status_validasi", "Menunggu")
    .eq("rt_id", rtSesi);

  const querySampah = supabaseAdmin
    .from("transaksi_sampah")
    .select("berat_kg, jenis_transaksi, nominal_warga, nominal_kas_rt")
    .eq("rt_id", rtSesi);

  const queryKurban = supabaseAdmin
    .from("transaksi_kurban")
    .select("jenis_transaksi, nominal")
    .eq("rt_id", otentikasiHalaman.sesi.rtId);

  const [wargaListRes, totalWargaAktif, sampahRes, kurbanRes] = await Promise.all([
    queryAntrean.order("created_at", { ascending: true }),
    hitungWargaSah(supabaseAdmin, rtSesi),
    querySampah,
    queryKurban,
  ]);

  if (wargaListRes.error) console.error("Gagal memuat antrean validasi:", wargaListRes.error.message);
  if (sampahRes.error) console.error("Gagal memuat transaksi sampah:", sampahRes.error.message);
  if (kurbanRes.error) console.error("Gagal memuat transaksi kurban:", kurbanRes.error.message);

  let totalSampahKg = 0;
  let saldoSampahWarga = 0;
  sampahRes.data?.forEach((s) => {
    totalSampahKg += Number(s.berat_kg) || 0;
    if (s.jenis_transaksi === "Setor") saldoSampahWarga += Number(s.nominal_warga) || 0;
    if (s.jenis_transaksi === "Tarik") saldoSampahWarga -= Number(s.nominal_warga) || 0;
  });

  let saldoKurban = 0;
  kurbanRes.data?.forEach((k) => {
    if (k.jenis_transaksi === "Setoran (+)") saldoKurban += Number(k.nominal) || 0;
    if (k.jenis_transaksi === "Tarikan (-)") saldoKurban -= Number(k.nominal) || 0;
  });

  const statistik = {
    warga: totalWargaAktif,
    sampahKg: totalSampahKg,
    sampahRp: saldoSampahWarga,
    kurbanRp: saldoKurban,
  };

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
        "Validasi Cepat"
      );
      if (hasil.success) revalidatePath("/");
      return hasil;
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal server saat memvalidasi.";
      return { success: false, message: pesan };
    }
  }

  const handleLogout = async () => {
    "use server";
    const cookieStore = await cookies();
    cookieStore.delete("admin_session");
    redirect("/");
  };

  const modeWebmaster = otentikasiHalaman.sesi.role === "webmaster";
  const judulDasbor = modeWebmaster
    ? "Mode Webmaster: Antrean dan KPI mengikuti RT sesi"
    : "Pusat Komando";

  return (
    <AdminDashboardClient
      adminAktif={adminAman}
      wargaList={wargaListRes.data || []}
      statistik={statistik}
      prosesValidasi={prosesValidasi}
      logoutAction={handleLogout}
      modeWebmaster={modeWebmaster}
      judulDasbor={judulDasbor}
    />
  );
}
// Validasi Keamanan: Fungsi mendelegasikan pengecekan ke wilayahMutasiWarga dan saringWargaTerotorisasi di layer service.
