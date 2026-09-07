import webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { kueriFallbackStatusAktif, skemaBelumSiap, type ErrorSupabase } from "@/lib/arsip-warga";
import { uuidTenantSah } from "@/lib/uuid-tenant";

export type PayloadNotifikasi = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

const PESAN_PUSH_BELUM_SIAP =
  "Fitur notifikasi belum aktif di database. Jalankan SQL wargaku-v2-push-ibu-soft-delete.sql di Supabase.";

function klienAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export function siapkanVapid(): boolean {
  const publik = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privat = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publik || !privat) return false;
  webpush.setVapidDetails("mailto:pengurus@wargaku-six.vercel.app", publik, privat);
  return true;
}

async function hapusLanggananMati(endpoint: string) {
  const supabase = klienAdmin();
  const { error } = await supabase.from("push_langganan").delete().eq("endpoint", endpoint);
  if (error && !skemaBelumSiap(error)) {
    console.error("Gagal membersihkan langganan push mati:", error.message);
  }
}

async function kirimKeLangganan(langganan: { endpoint: string; p256dh: string; auth: string }, payload: PayloadNotifikasi) {
  try {
    await webpush.sendNotification(
      {
        endpoint: langganan.endpoint,
        keys: { p256dh: langganan.p256dh, auth: langganan.auth },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (err: unknown) {
    const status = typeof err === "object" && err && "statusCode" in err ? Number((err as { statusCode?: number }).statusCode) : 0;
    if (status === 404 || status === 410) {
      await hapusLanggananMati(langganan.endpoint);
    }
    console.error("Gagal kirim web push:", err);
    return false;
  }
}

export async function kirimNotifikasiKeWarga(wargaId: string, payload: PayloadNotifikasi) {
  if (!siapkanVapid()) return { terkirim: 0, pesan: "Kunci VAPID belum diatur." };
  const supabase = klienAdmin();
  const { data: warga, error: errWarga } = await supabase
    .from("warga")
    .select("id, rt_id")
    .eq("id", wargaId)
    .maybeSingle();
  const rtId = uuidTenantSah(warga?.rt_id);
  if (errWarga || !rtId) {
    return { terkirim: 0, pesan: "Wilayah penerima push belum valid." };
  }
  const { data, error } = await supabase
    .from("push_langganan")
    .select("endpoint, p256dh, auth")
    .eq("warga_id", wargaId)
    .eq("rt_id", rtId);
  if (error) {
    return { terkirim: 0, pesan: skemaBelumSiap(error) ? PESAN_PUSH_BELUM_SIAP : error.message };
  }
  if (!data?.length) return { terkirim: 0 };
  let terkirim = 0;
  for (const row of data) {
    if (await kirimKeLangganan(row, payload)) terkirim += 1;
  }
  return { terkirim };
}

export async function kirimNotifikasiKeSemuaWarga(payload: PayloadNotifikasi, rtId: string) {
  const rtBersih = uuidTenantSah(rtId);
  if (!rtBersih) {
    return { terkirim: 0, pesan: "Siaran push ditolak: wilayah RT sesi tidak valid." };
  }
  if (!siapkanVapid()) return { terkirim: 0, pesan: "Kunci VAPID belum diatur." };
  const supabase = klienAdmin();
  const { data: wargaRt, error: errWargaRt } = await supabase
    .from("warga")
    .select("id")
    .eq("rt_id", rtBersih)
    .limit(5000);
  if (errWargaRt) {
    console.error("Gagal membatasi siaran push ke RT sesi:", errWargaRt.message);
    return { terkirim: 0, pesan: "Penerima siaran belum dapat diverifikasi." };
  }
  const idWargaRt = (wargaRt || []).map((w) => String(w.id));
  if (!idWargaRt.length) return { terkirim: 0 };

  const { data, error } = await supabase
    .from("push_langganan")
    .select("endpoint, p256dh, auth, warga_id")
    .eq("rt_id", rtBersih)
    .in("warga_id", idWargaRt);
  if (error) {
    return { terkirim: 0, pesan: skemaBelumSiap(error) ? PESAN_PUSH_BELUM_SIAP : error.message };
  }
  if (!data?.length) return { terkirim: 0 };

  const wargaIds = [...new Set(data.map((row) => row.warga_id).filter(Boolean))];
  // Fail-closed: bila status akun tidak bisa dibaca, jangan anggap semua
  // pelanggan sah. Daftar kosong di sini menahan siaran, bukan membukanya.
  let wargaAktif = new Set<string>();
  if (wargaIds.length > 0) {
    const { data: daftarWarga, error: errWarga } = await kueriFallbackStatusAktif<{
      data: { id: string; status_aktif?: boolean | null }[] | null;
      error: ErrorSupabase;
    }>(
      () => supabase.from("warga").select("id, status_aktif").in("id", wargaIds),
      () => supabase.from("warga").select("id").in("id", wargaIds)
    );

    if (errWarga) {
      // Fail-closed: jangan siarkan ke seluruh pelanggan ketika status akun
      // tidak bisa diverifikasi. Fail-open sebelumnya mengirim ke akun arsip.
      console.error("Gagal memeriksa status aktif warga, siaran dibatalkan:", errWarga.message);
      return { terkirim: 0, pesan: "Status penerima belum dapat diverifikasi." };
    } else if (daftarWarga) {
      wargaAktif = new Set(daftarWarga.filter((w) => w.status_aktif !== false).map((w) => w.id));
    }
  }

  let terkirim = 0;
  for (const row of data) {
    if (row.warga_id && !wargaAktif.has(row.warga_id)) continue;
    if (await kirimKeLangganan(row, payload)) terkirim += 1;
  }
  return { terkirim };
}

export async function catatDanKirimSekali(
  jenis: string,
  kunciUnik: string,
  payload: PayloadNotifikasi,
  sasaran: { semua?: boolean; wargaId?: string }
) {
  const supabase = klienAdmin();
  const { error } = await supabase.from("notifikasi_riwayat").insert([
    { jenis, kunci_unik: kunciUnik, judul: payload.title, isi: payload.body },
  ]);
  if (error) {
    if (error.code === "23505") return { terkirim: 0, dilewati: true };
    console.error("Gagal mencatat riwayat notifikasi:", error.message);
  }
  if (sasaran.semua) {
    console.error("Siaran push ke semua tenant ditolak; wajib rt_id dari sesi.");
    return { terkirim: 0, pesan: "Siaran push lintas RT ditolak." };
  }
  if (sasaran.wargaId) return kirimNotifikasiKeWarga(sasaran.wargaId, payload);
  return { terkirim: 0 };
}

export function tanggalJakartaSekarang() {
  const currDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const bulan = currDate.getMonth() + 1;
  const hari = currDate.getDate();
  const tahun = currDate.getFullYear();
  const todayStr = `${tahun}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
  const besok = new Date(currDate);
  besok.setDate(currDate.getDate() + 1);
  const tomorrowStr = `${besok.getFullYear()}-${String(besok.getMonth() + 1).padStart(2, "0")}-${String(besok.getDate()).padStart(2, "0")}`;
  return { currDate, bulan, hari, tahun, todayStr, tomorrowStr };
}

export function isUlangTahunHariIni(tanggalLahir: string | null | undefined, bulan: number, hari: number) {
  if (!tanggalLahir) return false;
  const potongan = String(tanggalLahir).slice(0, 10);
  const bagian = potongan.split("-");
  if (bagian.length === 3) {
    const bulanLahir = Number(bagian[1]);
    const hariLahir = Number(bagian[2]);
    if (bulanLahir && hariLahir) return bulanLahir === bulan && hariLahir === hari;
  }
  const bdate = new Date(tanggalLahir);
  if (Number.isNaN(bdate.getTime())) return false;
  return bdate.getMonth() + 1 === bulan && bdate.getDate() === hari;
}
