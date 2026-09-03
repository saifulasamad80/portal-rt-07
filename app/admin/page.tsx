import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import AdminLogin from "./AdminLogin";
import AdminDashboardClient from "./AdminDashboardClient";
import { skemaBelumSiap } from "@/lib/arsip-warga";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

const STATUS_VALIDASI_SAH = ["Disetujui", "Ditolak", "Menunggu"] as const;
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SesiAdmin = { nama?: string; role?: string; rt_id?: string };

/**
 * Zero-Trust: setiap Server Action memverifikasi ulang JWT dari cookie, tidak
 * pernah bersandar pada nilai hasil render. Sengaja mengembalikan Result
 * Object, bukan melempar exception, agar tidak memicu crash React/Vercel.
 */
async function otentikasiAdmin(): Promise<
  { ok: true; sesi: SesiAdmin } | { ok: false; message: string }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) {
    return { ok: false, message: "Sesi pengurus sudah berakhir. Silakan masuk kembali." };
  }
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { ok: true, sesi: payload as SesiAdmin };
  } catch {
    return { ok: false, message: "Sesi tidak valid atau telah dimanipulasi. Silakan masuk kembali." };
  }
}

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
async function hitungWargaSah(supabase: SupabaseClient): Promise<number> {
  const queryDasar = () =>
    supabase
      .from("warga")
      .select("id", { count: "exact" })
      .eq("status_verifikasi", "Disetujui");

  let { count, error } = await queryDasar().neq("status_aktif", false).limit(1);

  if (error) {
    if (!skemaBelumSiap(error)) {
      // Bukan kegagalan fatal: hitungan diulang tanpa filter arsip tepat di
      // bawah ini. Dicatat sebagai warn supaya tidak memicu overlay merah
      // Next.js di mode development.
      console.warn(
        "Filter arsip dilewati saat menghitung warga sah:",
        error.message || error.code || "database tidak menyertakan detail"
      );
    }
    ({ count, error } = await queryDasar().limit(1));
  }

  if (error) {
    console.error("Gagal menghitung warga sah:", error.message || error.code || "penyebab tidak diketahui");
    return 0;
  }
  return count || 0;
}

export default async function AdminDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) return <AdminLogin />;

  let adminAktif: SesiAdmin;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    adminAktif = JSON.parse(JSON.stringify(payload)) as SesiAdmin;
  } catch {
    return <AdminLogin />;
  }

  // Menjaga AdminDashboardClient dari nilai kosong (mis. adminAktif.nama
  // undefined saat memanggil charAt) tanpa menyembunyikan identitas asli.
  const adminAman = {
    ...adminAktif,
    nama: String(adminAktif.nama || "Pengurus"),
    role: String(adminAktif.role || "pengurus"),
  };

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Tembakan paralel untuk mengambil data Agregat (Statistik Cepat) & Antrean Validasi
  const [wargaListRes, totalWargaAktif, sampahRes, kurbanRes] = await Promise.all([
    supabaseAdmin
      .from("warga")
      .select(
        "id, nik, nama_lengkap, no_whatsapp, status_tinggal, detail_alamat, status_verifikasi, created_at, ktp_path, kk_path, anggota_keluarga(nama_lengkap, hubungan_keluarga)"
      )
      .eq("status_verifikasi", "Menunggu")
      .order("created_at", { ascending: true }),
    hitungWargaSah(supabaseAdmin),
    supabaseAdmin.from("transaksi_sampah").select("berat_kg, jenis_transaksi, nominal_warga, nominal_kas_rt"),
    supabaseAdmin.from("transaksi_kurban").select("jenis_transaksi, nominal"),
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

      const statusBersih = String(status || "").trim();
      if (!STATUS_VALIDASI_SAH.includes(statusBersih as (typeof STATUS_VALIDASI_SAH)[number])) {
        return { success: false, message: `Status "${statusBersih}" tidak dikenali sistem.` };
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

      // maybeSingle() dipakai agar baris yang sudah dihapus admin lain tidak
      // memunculkan error PGRST116, melainkan data null yang bisa dijelaskan.
      const { data: targetWarga, error: errTarget } = await supabase
        .from("warga")
        .select("id, nik, nama_lengkap")
        .eq("id", idBersih)
        .maybeSingle();

      if (errTarget) {
        return { success: false, message: `Gagal membaca data warga: ${errTarget.message}` };
      }
      if (!targetWarga) {
        return {
          success: false,
          message: "Data warga ini sudah tidak ada di database. Daftar akan disegarkan.",
        };
      }

      const { error } = await supabase
        .from("warga")
        .update({ status_verifikasi: statusBersih })
        .eq("id", idBersih);

      if (error) {
        return { success: false, message: `Gagal menyimpan status: ${error.message}` };
      }

      const { error: errAudit } = await supabase.from("audit_log").insert([
        {
          aktor: otentikasi.sesi.nama || "pengurus",
          aksi: `Validasi Cepat: ${statusBersih}`,
          tabel_target: "warga",
          detail: `Memvalidasi NIK: ${targetWarga.nik || idBersih}`,
        },
      ]);
      // Status warga sudah tersimpan; kegagalan audit log tidak boleh
      // membatalkan keberhasilan aksi utama.
      if (errAudit) console.error("Audit log validasi gagal dicatat:", errAudit.message);

      return {
        success: true,
        message: `${targetWarga.nama_lengkap || "Warga"} berhasil ditandai sebagai ${statusBersih}.`,
      };
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

  return (
    <AdminDashboardClient
      adminAktif={adminAman}
      wargaList={wargaListRes.data || []}
      statistik={statistik}
      prosesValidasi={prosesValidasi}
      logoutAction={handleLogout}
    />
  );
}
