import { redirect } from "next/navigation";
import IbuIbuAdminClient from "./IbuIbuAdminClient";
import {
  buatKlienTerautentikasi,
  getSupabaseAdminClientDariSesi,
} from "@/lib/supabase-server";
import {
  otentikasiAdminAktif,
  wajibOtentikasiAdmin,
  wajibWebmaster,
} from "@/lib/session-security";
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Tabel kunjungan_* adalah tabel legacy yang hanya boleh dibuka setelah
// operator memetakan seluruh baris ke satu tenant. Jangan pernah menerima
// rt_id dari payload warga/admin; target berasal dari konfigurasi server.
const LEGACY_POSYANDU_RT_ID = (() => {
  const nilai = process.env.LEGACY_POSYANDU_RT_ID?.trim() || "";
  return POLA_UUID.test(nilai) ? nilai : null;
})();

function klienPrivileged(sesi: { id: string; rtId: string }) {
  return getSupabaseAdminClientDariSesi(sesi);
}

export default async function AdminIbuIbuPage() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) redirect("/admin");
  const rtIdAktif = otentikasi.sesi.rtId;
  const bolehKelolaKunjungan = otentikasi.sesi.role === "webmaster" && Boolean(LEGACY_POSYANDU_RT_ID);

  const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
  const supabaseKunjungan = bolehKelolaKunjungan
    ? getSupabaseAdminClientDariSesi(otentikasi.sesi)
    : null;
  // Tabel legacy hanya dibaca bila tenant sudah dikunci lewat environment
  // server. Tanpa konfigurasi, semua akses ditahan (fail closed), termasuk
  // webmaster; ini mencegah query service-role global.
  const kunjunganKosong = Promise.resolve({ data: [], error: null });
  const [lansiaRes, balitaRes, arisanRes, jumantikRes] = await Promise.all([
    supabaseKunjungan
      ? supabaseKunjungan.from("kunjungan_lansia").select("id, created_at, nama_peserta, tanggal_kunjungan, tensi_darah, gula_darah, berat_kg, catatan").eq("rt_id", LEGACY_POSYANDU_RT_ID).order("tanggal_kunjungan", { ascending: false }).limit(200)
      : kunjunganKosong,
    supabaseKunjungan
      ? supabaseKunjungan.from("kunjungan_balita").select("id, created_at, nama_anak, nama_ibu, tanggal_kunjungan, berat_kg, tinggi_cm, imunisasi, catatan").eq("rt_id", LEGACY_POSYANDU_RT_ID).order("tanggal_kunjungan", { ascending: false }).limit(200)
      : kunjunganKosong,
    supabase.from("arisan_ibu").select("*").eq("rt_id", rtIdAktif).order("created_at", { ascending: false }).limit(200),
    supabase
      .from("laporan_jumantik")
      .select("jumlah_rumah_diperiksa, warga_terjangkit_dbd, ditemukan_jentik")
      .eq("rt_id", rtIdAktif)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const arisanIds = (arisanRes.data || []).map((row) => String(row.id)).filter(Boolean);
  const transaksiRes = arisanIds.length
    ? await supabase.from("arisan_transaksi").select("*").in("arisan_id", arisanIds).order("created_at", { ascending: false }).limit(500)
    : { data: [], error: null };

  const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
  function angkaOpsional(value: unknown, maksimum: number) {
    if (value == null || value === "") return null;
    const angka = Number(value);
    return Number.isFinite(angka) && angka >= 0 && angka <= maksimum ? angka : NaN;
  }
  function tanggalValid(value: unknown) {
    const tanggal = String(value ?? "").trim();
    if (!POLA_TANGGAL.test(tanggal)) return null;
    const [tahun, bulan, hari] = tanggal.split("-").map(Number);
    const pemeriksaan = new Date(Date.UTC(tahun, bulan - 1, hari));
    return pemeriksaan.getUTCFullYear() === tahun && pemeriksaan.getUTCMonth() === bulan - 1 && pemeriksaan.getUTCDate() === hari
      ? tanggal
      : null;
  }

  async function simpanKunjunganBalita(payload: unknown) {
    "use server";
    try {
      const sesi = await wajibWebmaster();
      if (!LEGACY_POSYANDU_RT_ID) {
        return { success: false, message: "Modul kunjungan belum tersedia sampai pemetaan RT selesai." };
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { success: false, message: "Format kunjungan balita tidak valid." };
      }
      const input = payload as Record<string, unknown>;
      const namaAnak = String(input.nama_anak ?? "").trim().slice(0, 150);
      const namaIbu = String(input.nama_ibu ?? "").trim().slice(0, 150);
      const tanggal = tanggalValid(input.tanggal_kunjungan);
      const berat = angkaOpsional(input.berat_kg, 500);
      const tinggi = angkaOpsional(input.tinggi_cm, 300);
      if (!namaAnak || !namaIbu || !tanggal || Number.isNaN(berat) || Number.isNaN(tinggi)) {
        return { success: false, message: "Data kunjungan balita tidak valid." };
      }
      const db = klienPrivileged(sesi);
      const { data, error } = await db
        .from("kunjungan_balita")
        .insert([{
          rt_id: LEGACY_POSYANDU_RT_ID,
          nama_anak: namaAnak,
          nama_ibu: namaIbu,
          tanggal_kunjungan: tanggal,
          berat_kg: berat,
          tinggi_cm: tinggi,
          imunisasi: String(input.imunisasi ?? "").trim().slice(0, 500) || null,
          catatan: String(input.catatan ?? "").trim().slice(0, 2000) || null,
        }])
        .select("id, created_at, nama_anak, nama_ibu, tanggal_kunjungan, berat_kg, tinggi_cm, imunisasi, catatan")
        .single();
      if (error || !data) return { success: false, message: "Kunjungan balita belum dapat disimpan." };
      return { success: true, data };
    } catch {
      return { success: false, message: "Aksi kunjungan balita belum dapat diproses." };
    }
  }

  async function simpanKunjunganLansia(payload: unknown) {
    "use server";
    try {
      const sesi = await wajibWebmaster();
      if (!LEGACY_POSYANDU_RT_ID) {
        return { success: false, message: "Modul kunjungan belum tersedia sampai pemetaan RT selesai." };
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { success: false, message: "Format kunjungan lansia tidak valid." };
      }
      const input = payload as Record<string, unknown>;
      const namaPeserta = String(input.nama_peserta ?? "").trim().slice(0, 150);
      const tanggal = tanggalValid(input.tanggal_kunjungan);
      const gula = angkaOpsional(input.gula_darah, 3000);
      const berat = angkaOpsional(input.berat_kg, 500);
      if (!namaPeserta || !tanggal || Number.isNaN(gula) || Number.isNaN(berat)) {
        return { success: false, message: "Data kunjungan lansia tidak valid." };
      }
      const db = klienPrivileged(sesi);
      const { data, error } = await db
        .from("kunjungan_lansia")
        .insert([{
          rt_id: LEGACY_POSYANDU_RT_ID,
          nama_peserta: namaPeserta,
          tanggal_kunjungan: tanggal,
          tensi_darah: String(input.tensi_darah ?? "").trim().slice(0, 30) || null,
          gula_darah: gula,
          berat_kg: berat,
          catatan: String(input.catatan ?? "").trim().slice(0, 2000) || null,
        }])
        .select("id, created_at, nama_peserta, tanggal_kunjungan, tensi_darah, gula_darah, berat_kg, catatan")
        .single();
      if (error || !data) return { success: false, message: "Kunjungan lansia belum dapat disimpan." };
      return { success: true, data };
    } catch {
      return { success: false, message: "Aksi kunjungan lansia belum dapat diproses." };
    }
  }

  async function simpanArisan(payload: unknown) {
    "use server";
    try {
      const sesi = await wajibOtentikasiAdmin();
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { success: false, message: "Format data arisan tidak valid." };
      }
      const db = await buatKlienTerautentikasi(sesi);
      const input = payload as Record<string, unknown>;
      const nama = String(input.nama_anggota || "").trim().slice(0, 150);
      const status = String(input.status_keanggotaan || "Aktif").trim();
      const setoran = Number(input.setoran_terakhir || 0);
      const pinjaman = Number(input.pinjaman_berjalan || 0);
      if (!nama || !["Aktif", "Tidak Aktif"].includes(status) || !Number.isFinite(setoran) || setoran < 0 || !Number.isFinite(pinjaman) || pinjaman < 0) {
        return { success: false, message: "Data arisan tidak valid." };
      }
      const { error } = await db.from("arisan_ibu").insert([{
        nama_anggota: nama,
        no_whatsapp: String(input.no_whatsapp || "").replace(/[^\d+]/g, "").slice(0, 25) || null,
        status_keanggotaan: status,
        setoran_terakhir: setoran,
        pinjaman_berjalan: pinjaman,
        catatan: String(input.catatan || "").trim().slice(0, 1000) || null,
        rt_id: sesi.rtId,
      }]);
      if (error) return { success: false, message: error.message };
      return { success: true };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : "Aksi arisan gagal." };
    }
  }

  async function simpanTransaksiArisan(payload: unknown) {
    "use server";
    try {
      const sesi = await wajibOtentikasiAdmin();
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { success: false, message: "Format transaksi tidak valid." };
      }
      const db = await buatKlienTerautentikasi(sesi);
      const input = payload as Record<string, unknown>;
      const arisanId = String(input.arisan_id || "").trim();
      const jenis = String(input.jenis || "Setoran").trim();
      const nominal = Number(input.nominal || 0);
      if (!/^[0-9a-f-]{36}$/i.test(arisanId) || !["Setoran", "Pinjaman", "Angsuran"].includes(jenis) || !Number.isFinite(nominal) || nominal <= 0) {
        return { success: false, message: "Anggota dan nominal wajib diisi." };
      }
      const { data: anggota, error: errAnggota } = await db
        .from("arisan_ibu")
        .select("id, setoran_terakhir, pinjaman_berjalan")
        .eq("id", arisanId)
        .eq("rt_id", sesi.rtId)
        .maybeSingle();
      if (errAnggota || !anggota) return { success: false, message: "Anggota arisan tidak berada dalam cakupan RT Anda." };
      const { error } = await db.from("arisan_transaksi").insert([
        { arisan_id: arisanId, jenis, nominal, catatan: String(input.catatan || "").trim().slice(0, 1000) || null },
      ]);
      if (error) return { success: false, message: error.message };

      const pinjaman = Number(anggota?.pinjaman_berjalan || 0);
      const pembaruan =
        jenis === "Pinjaman"
          ? { pinjaman_berjalan: pinjaman + nominal }
          : jenis === "Angsuran"
            ? { pinjaman_berjalan: Math.max(0, pinjaman - nominal) }
            : { setoran_terakhir: nominal };
      const { data: diperbarui, error: errUpdate } = await db
        .from("arisan_ibu")
        .update(pembaruan)
        .eq("id", arisanId)
        .eq("rt_id", sesi.rtId)
        .select("id")
        .maybeSingle();
      if (errUpdate || !diperbarui) return { success: false, message: "Saldo arisan berubah; transaksi perlu diperiksa pengurus." };
      return { success: true };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : "Aksi transaksi arisan gagal." };
    }
  }

  async function hapusCatatan(tabel: string, id: string) {
    "use server";
    try {
      const sesi = await wajibOtentikasiAdmin();
      const diizinkan = ["arisan_ibu", "arisan_transaksi"];
      if (!diizinkan.includes(tabel)) return { success: false, message: "Tabel tidak diizinkan." };
      const db = await buatKlienTerautentikasi(sesi);
      const idBersih = String(id || "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(idBersih)) return { success: false, message: "ID catatan tidak valid." };
      let query = db.from(tabel).delete().eq("id", idBersih);
      if (tabel === "arisan_ibu") {
        query = query.eq("rt_id", sesi.rtId);
      } else {
        const { data: transaksi, error: errTransaksi } = await db
          .from("arisan_transaksi")
          .select("arisan_id")
          .eq("id", idBersih)
          .maybeSingle();
        if (errTransaksi || !transaksi) return { success: false, message: "Catatan tidak ditemukan." };
        const { data: induk } = await db.from("arisan_ibu").select("id").eq("id", transaksi.arisan_id).eq("rt_id", sesi.rtId).maybeSingle();
        if (!induk) return { success: false, message: "Akses lintas RT ditolak." };
      }
      const { data: terhapus, error } = await query.select("id").maybeSingle();
      if (error) return { success: false, message: error.message };
      if (!terhapus) return { success: false, message: "Catatan sudah berubah atau tidak ditemukan." };
      return { success: true };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : "Aksi penghapusan arisan gagal." };
    }
  }

  async function catatLaporanJumantik(payload: unknown) {
    "use server";
    try {
      const sesi = await wajibOtentikasiAdmin();
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { success: false, message: "Format laporan Jumantik tidak valid." };
      }
      const input = payload as Record<string, unknown>;
      const jumlah = Math.max(0, Math.floor(Number(input.jumlah_rumah_diperiksa) || 0));
      if (!Number.isFinite(jumlah) || jumlah > 100000) {
        return { success: false, message: "Jumlah rumah diperiksa tidak valid." };
      }
      const dbd = input.warga_terjangkit_dbd === true;
      const jentik = input.ditemukan_jentik === true;
      const db = await buatKlienTerautentikasi(sesi);
      const { error } = await db.from("laporan_jumantik").insert([
        {
          jumlah_rumah_diperiksa: jumlah,
          warga_terjangkit_dbd: dbd,
          ditemukan_jentik: jentik,
          rt_id: sesi.rtId,
        },
      ]);
      if (error) {
        console.error("Gagal menyimpan laporan Jumantik:", error.message);
        return { success: false, message: "Laporan Jumantik gagal disimpan." };
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : "Laporan Jumantik gagal disimpan." };
    }
  }

  return (
    <IbuIbuAdminClient
      kunjunganLansia={lansiaRes.data || []}
      kunjunganBalita={balitaRes.data || []}
      arisan={arisanRes.data || []}
      transaksi={transaksiRes.data || []}
      aksiSimpanArisan={simpanArisan}
      aksiSimpanTransaksi={simpanTransaksiArisan}
      aksiHapus={hapusCatatan}
      aksiSimpanKunjunganBalita={simpanKunjunganBalita}
      aksiSimpanKunjunganLansia={simpanKunjunganLansia}
      bolehKelolaKunjungan={bolehKelolaKunjungan}
      laporanJumantik={jumantikRes.error ? null : jumantikRes.data}
      aksiCatatJumantik={catatLaporanJumantik}
    />
  );
}
