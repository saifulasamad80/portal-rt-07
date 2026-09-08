import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  catatDanKirimSekali,
  isUlangTahunHariIni,
  tanggalJakartaSekarang,
} from "@/lib/notifikasi-push";
import { kueriFallbackStatusAktif, type ErrorSupabase } from "@/lib/arsip-warga";
import { uuidTenantSah } from "@/lib/uuid-tenant";
import { anggotaSamaWilayah } from "@/lib/normalisasi-warga";

type BarisWargaUltah = {
  id: string;
  nama_lengkap: string;
  rt_id?: string | null;
  tanggal_lahir?: string | null;
  status_aktif?: boolean | null;
  anggota_keluarga?: { nama_lengkap: string; tanggal_lahir?: string; rt_id?: string | null }[] | null;
};

type BarisJadwalRonda = {
  id: string;
  warga_id: string | null;
  tanggal_tugas?: string | null;
  rt_id?: string | null;
};

type RingkasanCron = {
  ulangTahun: number;
  siskamlingHariIni: number;
  siskamlingBesok: number;
  rtDiproses: number;
};

function otorisasiCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  const headerCadangan = request.headers.get("x-cron-secret");
  return auth === `Bearer ${secret}` || headerCadangan === secret;
}

async function idWargaSahDiRt(supabase: SupabaseClient, rtId: string, idWarga: string[]) {
  const unik = [...new Set(idWarga.map((id) => String(id || "").trim()).filter(Boolean))];
  if (unik.length === 0) return new Set<string>();
  const { data, error } = await supabase.from("warga").select("id").eq("rt_id", rtId).in("id", unik);
  if (error) {
    console.error("Gagal memverifikasi warga di RT untuk notifikasi:", error.message);
    return new Set<string>();
  }
  return new Set((data || []).map((w) => String(w.id)));
}

async function prosesUlangTahunPerRt(
  supabase: SupabaseClient,
  rtId: string,
  namaRt: string,
  kalender: { bulan: number; hari: number; tahun: number }
) {
  let terkirim = 0;
  const { bulan, hari, tahun } = kalender;
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
        .select("id, nama_lengkap, rt_id, tanggal_lahir, status_aktif, anggota_keluarga(nama_lengkap, tanggal_lahir, rt_id)")
        .eq("status_verifikasi", "Disetujui")
        .eq("rt_id", rtId),
    () =>
      supabase
        .from("warga")
        .select("id, nama_lengkap, rt_id, tanggal_lahir, anggota_keluarga(nama_lengkap, tanggal_lahir, rt_id)")
        .eq("status_verifikasi", "Disetujui")
        .eq("rt_id", rtId)
  );

  if (errWarga) {
    console.error(`Gagal memuat daftar warga RT ${rtId} untuk notifikasi ulang tahun:`, errWarga.message);
    return 0;
  }

  for (const warga of daftarWarga || []) {
    if (warga.status_aktif === false) continue;
    if (uuidTenantSah(warga.rt_id) !== rtId) continue;
    const namaUltah: string[] = [];
    if (isUlangTahunHariIni(warga.tanggal_lahir, bulan, hari)) {
      namaUltah.push(warga.nama_lengkap);
    }
    (warga.anggota_keluarga || []).forEach((ak) => {
      if (!anggotaSamaWilayah(ak.rt_id, rtId)) return;
      if (isUlangTahunHariIni(ak.tanggal_lahir, bulan, hari)) namaUltah.push(ak.nama_lengkap);
    });
    if (namaUltah.length === 0) continue;

    const hasil = await catatDanKirimSekali(
      "ulang_tahun",
      `ultah:${warga.id}:${tahun}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`,
      {
        title: `Selamat ulang tahun dari ${namaRt}`,
        body: `Pengurus RT mengucapkan selamat bertambah usia untuk ${namaUltah.join(", ")}. Semoga sehat dan berkah selalu.`,
        url: "/portal",
        tag: "ulang-tahun",
      },
      { wargaId: warga.id, rtId }
    );
    terkirim += hasil.terkirim || 0;
  }
  return terkirim;
}

async function prosesRondaPerRt(
  supabase: SupabaseClient,
  rtId: string,
  tanggal: string,
  jenis: "siskamling" | "siskamling_besok",
  payload: { title: string; body: string }
) {
  let terkirim = 0;
  const { data: jadwalRt, error: errJadwal } = await supabase
    .from("jadwal_ronda")
    .select("id, warga_id, tanggal_tugas, rt_id")
    .eq("tanggal_tugas", tanggal)
    .eq("rt_id", rtId);

  if (errJadwal) {
    console.error(`Gagal memuat jadwal ronda RT ${rtId} (${tanggal}):`, errJadwal.message);
    return 0;
  }

  const daftar = (jadwalRt || []) as BarisJadwalRonda[];
  const wargaSah = await idWargaSahDiRt(
    supabase,
    rtId,
    daftar.map((j) => String(j.warga_id || ""))
  );

  for (const jadwal of daftar) {
    if (!jadwal.warga_id) continue;
    if (uuidTenantSah(jadwal.rt_id) !== rtId) continue;
    if (!wargaSah.has(jadwal.warga_id)) continue;
    const hasil = await catatDanKirimSekali(
      jenis,
      `${jenis === "siskamling" ? "ronda" : "ronda-besok"}:${jadwal.id}:${tanggal}`,
      {
        title: payload.title,
        body: payload.body,
        url: "/portal/ronda",
        tag: "siskamling",
      },
      { wargaId: jadwal.warga_id, rtId }
    );
    terkirim += hasil.terkirim || 0;
  }
  return terkirim;
}

async function jalankanCron() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { bulan, hari, tahun, todayStr, tomorrowStr } = tanggalJakartaSekarang();
  const ringkasan: RingkasanCron = { ulangTahun: 0, siskamlingHariIni: 0, siskamlingBesok: 0, rtDiproses: 0 };

  // Vercel Cron hanya memicu satu URL global. Isolasi tenant wajib di dalam job:
  // iterasi master_rt, lalu setiap kueri warga/jadwal dikunci .eq("rt_id", ...).
  const { data: daftarRt, error: errRt } = await supabase.from("master_rt").select("id, nama_rt");
  if (errRt) {
    throw new Error(`Gagal memuat daftar wilayah RT untuk cron notifikasi: ${errRt.message}`);
  }
  if (!daftarRt?.length) {
    return { success: true, tanggal: todayStr, ringkasan };
  }

  for (const rt of daftarRt) {
    const rtId = uuidTenantSah(rt.id);
    if (!rtId) continue;
    const namaRt = String(rt.nama_rt || "RT").trim() || "RT";
    ringkasan.rtDiproses += 1;
    ringkasan.ulangTahun += await prosesUlangTahunPerRt(supabase, rtId, namaRt, { bulan, hari, tahun });
    ringkasan.siskamlingHariIni += await prosesRondaPerRt(supabase, rtId, todayStr, "siskamling", {
      title: "Tugas siskamling malam ini",
      body: "Anda dijadwalkan ronda malam ini. Buka portal untuk konfirmasi kehadiran.",
    });
    ringkasan.siskamlingBesok += await prosesRondaPerRt(supabase, rtId, tomorrowStr, "siskamling_besok", {
      title: "Pengingat siskamling besok",
      body: "Anda dijadwalkan ronda besok malam. Siapkan diri dan konfirmasi kehadiran di portal.",
    });
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
