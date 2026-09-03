import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  catatDanKirimSekali,
  isUlangTahunHariIni,
  tanggalJakartaSekarang,
} from "@/lib/notifikasi-push";
import { kueriFallbackStatusAktif, type ErrorSupabase } from "@/lib/arsip-warga";

type BarisWargaUltah = {
  id: string;
  nama_lengkap: string;
  tanggal_lahir?: string | null;
  status_aktif?: boolean | null;
  anggota_keluarga?: { nama_lengkap: string; tanggal_lahir?: string }[] | null;
};

function otorisasiCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  const headerCadangan = request.headers.get("x-cron-secret");
  return auth === `Bearer ${secret}` || headerCadangan === secret;
}

async function jalankanCron() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { bulan, hari, tahun, todayStr, tomorrowStr } = tanggalJakartaSekarang();
  const ringkasan = { ulangTahun: 0, siskamlingHariIni: 0, siskamlingBesok: 0 };

  // Kolom status_aktif hanya ada bila migrasi wargaku-v2 sudah dijalankan.
  // Bila belum, query diulang tanpa kolom tersebut supaya daftar warga tidak
  // menjadi null dan seluruh notifikasi ulang tahun batal terkirim.
  const { data: daftarWarga, error: errWarga } = await kueriFallbackStatusAktif<{
    data: BarisWargaUltah[] | null;
    error: ErrorSupabase;
  }>(
    () =>
      supabase
        .from("warga")
        .select("id, nama_lengkap, tanggal_lahir, status_aktif, anggota_keluarga(nama_lengkap, tanggal_lahir)")
        .eq("status_verifikasi", "Disetujui"),
    () =>
      supabase
        .from("warga")
        .select("id, nama_lengkap, tanggal_lahir, anggota_keluarga(nama_lengkap, tanggal_lahir)")
        .eq("status_verifikasi", "Disetujui")
  );

  if (errWarga) console.error("Gagal memuat daftar warga untuk notifikasi ulang tahun:", errWarga.message);

  for (const warga of daftarWarga || []) {
    if (warga.status_aktif === false) continue;
    const namaUltah: string[] = [];
    if (isUlangTahunHariIni(warga.tanggal_lahir, bulan, hari)) {
      namaUltah.push(warga.nama_lengkap);
    }
    (warga.anggota_keluarga || []).forEach((ak: { nama_lengkap: string; tanggal_lahir?: string }) => {
      if (isUlangTahunHariIni(ak.tanggal_lahir, bulan, hari)) namaUltah.push(ak.nama_lengkap);
    });
    if (namaUltah.length === 0) continue;

    const hasil = await catatDanKirimSekali(
      "ulang_tahun",
      `ultah:${warga.id}:${tahun}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`,
      {
        title: "Selamat ulang tahun dari RT 07",
        body: `Pengurus RT mengucapkan selamat bertambah usia untuk ${namaUltah.join(", ")}. Semoga sehat dan berkah selalu.`,
        url: "/portal",
        tag: "ulang-tahun",
      },
      { wargaId: warga.id }
    );
    ringkasan.ulangTahun += hasil.terkirim || 0;
  }

  const { data: jadwalHariIni } = await supabase
    .from("jadwal_ronda")
    .select("id, warga_id, tanggal_tugas")
    .eq("tanggal_tugas", todayStr);

  for (const jadwal of jadwalHariIni || []) {
    if (!jadwal.warga_id) continue;
    const hasil = await catatDanKirimSekali(
      "siskamling",
      `ronda:${jadwal.id}:${todayStr}`,
      {
        title: "Tugas siskamling malam ini",
        body: "Anda dijadwalkan ronda malam ini. Buka portal untuk konfirmasi kehadiran.",
        url: "/portal/ronda",
        tag: "siskamling",
      },
      { wargaId: jadwal.warga_id }
    );
    ringkasan.siskamlingHariIni += hasil.terkirim || 0;
  }

  const { data: jadwalBesok } = await supabase
    .from("jadwal_ronda")
    .select("id, warga_id, tanggal_tugas")
    .eq("tanggal_tugas", tomorrowStr);

  for (const jadwal of jadwalBesok || []) {
    if (!jadwal.warga_id) continue;
    const hasil = await catatDanKirimSekali(
      "siskamling_besok",
      `ronda-besok:${jadwal.id}:${tomorrowStr}`,
      {
        title: "Pengingat siskamling besok",
        body: "Anda dijadwalkan ronda besok malam. Siapkan diri dan konfirmasi kehadiran di portal.",
        url: "/portal/ronda",
        tag: "siskamling",
      },
      { wargaId: jadwal.warga_id }
    );
    ringkasan.siskamlingBesok += hasil.terkirim || 0;
  }

  return { success: true, tanggal: todayStr, ringkasan };
}

export async function GET(request: Request) {
  if (!otorisasiCron(request)) {
    return NextResponse.json({ error: "Akses cron ditolak." }, { status: 401 });
  }
  try {
    return NextResponse.json(await jalankanCron());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menjalankan cron notifikasi.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
