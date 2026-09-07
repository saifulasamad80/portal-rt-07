import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type SupabaseClient } from "@supabase/supabase-js";
import SampahAdminClient from "./SampahAdminClient";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";
import {
  adminBolehMengaksesRt,
  adminUntukKlien,
  otentikasiAdminAktif,
  wajibOtentikasiAdmin,
} from "@/lib/session-security";

import { angkaPostgrest } from "@/lib/angka-postgrest";
import { POLA_UUID, UUID_SENTINEL } from "@/lib/uuid-tenant";
const UKURAN_KELOMPOK = 80;

type BarisTransaksiSampahAdmin = {
  tanggal_transaksi?: string | null;
  [kunci: string]: unknown;
};

type BarisRakBinAdmin = {
  created_at?: string | null;
  [kunci: string]: unknown;
};

async function ambilTransaksiSampahCakupan(supabase: SupabaseClient, ids: string[], rtId: string) {
  const gabungan: BarisTransaksiSampahAdmin[] = [];
  for (let i = 0; i < ids.length; i += UKURAN_KELOMPOK) {
    const potong = ids.slice(i, i + UKURAN_KELOMPOK);
    const { data, error } = await supabase
      .from("transaksi_sampah")
      .select("*, warga(nama_lengkap)")
      .in("warga_id", potong)
      .eq("rt_id", rtId);
    if (error) return { data: [] as BarisTransaksiSampahAdmin[], error };
    gabungan.push(...((data || []) as BarisTransaksiSampahAdmin[]));
  }
  gabungan.sort((a, b) =>
    String(b.tanggal_transaksi || "").localeCompare(String(a.tanggal_transaksi || "")),
  );
  return { data: gabungan, error: null };
}

async function ambilRakBinCakupan(supabase: SupabaseClient, ids: string[], rtId: string) {
  const gabungan: BarisRakBinAdmin[] = [];
  for (let i = 0; i < ids.length; i += UKURAN_KELOMPOK) {
    const potong = ids.slice(i, i + UKURAN_KELOMPOK);
    const { data, error } = await supabase
      .from("limbah_ekonomis")
      .select("*, warga(nama_lengkap), lapak_warga(nama_usaha)")
      .not("warga_id", "is", null)
      .not("rt_id", "is", null)
      .in("warga_id", potong)
      .eq("rt_id", rtId);
    if (error) return { data: [] as BarisRakBinAdmin[], error };
    gabungan.push(...((data || []) as BarisRakBinAdmin[]));
  }
  gabungan.sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || "")),
  );
  return { data: gabungan, error: null };
}

export default async function AdminSampahPage() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) redirect("/admin");
  const adminAktif = adminUntukKlien(otentikasi.sesi);

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);

  // Query/mutasi memakai klien terautentikasi agar RLS tenant merdeka.
  // Predikat rt_id di aplikasi tetap dipertahankan sebagai pertahanan berlapis.

  const queryWarga = supabaseAdmin
    .from("warga")
    .select("id, nama_lengkap, rt_id")
    .eq("status_verifikasi", "Disetujui")
    .eq("rt_id", otentikasi.sesi.rtId);
  const { data: wargaRes } = await queryWarga.order("nama_lengkap", { ascending: true }).limit(1000);
  const idWargaCakupan = (wargaRes || []).map((w) => String(w.id));
  const ids = idWargaCakupan.length ? idWargaCakupan : [UUID_SENTINEL];

  // PostgREST menaruh .in() di query string. Ratusan UUID sekali tembak pecah
  // jadi HTTP 400 (URL terlalu panjang) — kg/saldo sampah jadi kosong.
  // Webmaster memakai helper yang sama agar tidak dump lintas-RT.
  const [{ data: transaksiRes }, { data: rakBinRes }] = await Promise.all([
    ambilTransaksiSampahCakupan(supabaseAdmin, ids, otentikasi.sesi.rtId),
    ambilRakBinCakupan(supabaseAdmin, ids, otentikasi.sesi.rtId),
  ]);

  // 3. Tarik Daftar Teknisi / Jasa Profesional dari Tabel Lapak (Untuk Dropdown Penugasan)
  const queryTeknisi = supabaseAdmin
    .from("lapak_warga")
    .select("id, nama_usaha, warga(nama_lengkap)")
    .eq("kategori", "Jasa & Servis") // Hanya ambil yang kategori Jasa
    .eq("status", "Aktif")
    .eq("rt_id", otentikasi.sesi.rtId);
  const { data: teknisiRes } = await queryTeknisi.limit(200);

  // SERVER ACTION 1: SIMPAN SAMPAH KILOAN (Tetap sama)
  async function simpanTransaksiSampah(wargaId: string, jenis: string, keterangan: string, beratKg: number | null, nominalWarga: number, nominalKasRt: number, tanggal: string) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();

    try {
      const idBersih = String(wargaId || "").trim();
      const jenisBersih = String(jenis || "").trim();
      const keteranganBersih = String(keterangan || "").trim().slice(0, 1000);
      const beratBersih = beratKg == null ? null : Number(beratKg);
      const nominalWargaBersih = Number(nominalWarga);
      const nominalKasBersih = Number(nominalKasRt);
      const tanggalBersih = String(tanggal || "").trim();
      if (!POLA_UUID.test(idBersih) || !["Setor", "Tarik"].includes(jenisBersih) || !Number.isFinite(nominalWargaBersih) || nominalWargaBersih <= 0 || !Number.isFinite(nominalKasBersih) || nominalKasBersih < 0 || (beratBersih !== null && (!Number.isFinite(beratBersih) || beratBersih < 0)) || !/^\d{4}-\d{2}-\d{2}$/.test(tanggalBersih)) {
        return { success: false, message: "Data transaksi sampah tidak valid." };
      }
      const supabase = await buatKlienTerautentikasi(sesi);
      const { data: targetWarga, error: errTarget } = await supabase.from("warga").select("id, nama_lengkap, rt_id, status_verifikasi").eq("id", idBersih).maybeSingle();
      const rtIdTarget = String(targetWarga?.rt_id || "").trim();
      if (
        errTarget ||
        !targetWarga ||
        targetWarga.status_verifikasi !== "Disetujui" ||
        !POLA_UUID.test(rtIdTarget) ||
        !adminBolehMengaksesRt(sesi, rtIdTarget)
      ) {
        return { success: false, message: "Warga transaksi tidak berada dalam cakupan RT Anda." };
      }
      
      if (jenisBersih === "Tarik") {
        const { data: riwayat } = await supabase.from("transaksi_sampah").select("jenis_transaksi, nominal_warga").eq("warga_id", idBersih).eq("rt_id", rtIdTarget);
        let saldoAktual = 0;
        riwayat?.forEach(r => {
          const nominal = angkaPostgrest(r.nominal_warga);
          if (r.jenis_transaksi === "Setor") saldoAktual += nominal;
          if (r.jenis_transaksi === "Tarik") saldoAktual -= nominal;
        });
        
        if (nominalWargaBersih > saldoAktual) {
          return { success: false, message: `SERVER BLOCKED: Saldo tidak mencukupi. Saldo aktual: Rp${saldoAktual}` };
        }
      }

      const { error } = await supabase.from("transaksi_sampah").insert([{
        warga_id: idBersih,
        rt_id: rtIdTarget,
        jenis_transaksi: jenisBersih,
        keterangan: keteranganBersih,
        berat_kg: beratBersih,
        nominal_warga: nominalWargaBersih,
        nominal_kas_rt: nominalKasBersih,
        tanggal_transaksi: tanggalBersih,
      }]);
      if (error) return { success: false, message: error.message };

      await supabase.from("audit_log").insert([{
        aktor: sesi.nama, aksi: `Input Transaksi Sampah: ${jenisBersih}`, tabel_target: "transaksi_sampah",
        detail: `${targetWarga.nama_lengkap} - Warga: Rp${nominalWargaBersih} | Kas RT: Rp${nominalKasBersih}`,
        rt_id: rtIdTarget,
      }]);
      
      revalidatePath("/");
      return { success: true };
    } catch (err: unknown) { return { success: false, message: err instanceof Error ? err.message : "Aksi transaksi sampah gagal." }; }
  }

  // SERVER ACTION 2: UPDATE STATUS RAK BIN (Tugaskan Teknisi)
  async function updateStatusRakBin(idRakBin: string, statusBaru: string, idTeknisi: string | null) {
    "use server";
    const sesi = await wajibOtentikasiAdmin();

    const idBersih = String(idRakBin || "").trim();
    const statusBersih = String(statusBaru || "").trim();
    const teknisiBersih = idTeknisi == null || idTeknisi === "" ? null : String(idTeknisi).trim();
    if (!POLA_UUID.test(idBersih) || !["Tersedia di Rak Bin", "Sedang Direparasi", "Terjual"].includes(statusBersih) || (teknisiBersih && !POLA_UUID.test(teknisiBersih))) {
      return { success: false, message: "Data rak bin tidak valid." };
    }
    const supabase = await buatKlienTerautentikasi(sesi);
    const { data: targetBarang, error: errBarang } = await supabase
      .from("limbah_ekonomis")
      .select("id, nama_barang, warga_id, rt_id, teknisi_id, status, opsi_tujuan")
      .eq("id", idBersih)
      .maybeSingle();
    if (errBarang || !targetBarang) return { success: false, message: "Barang rak bin tidak ditemukan." };

    // Kedua kolom ini adalah batas tenant. Record yatim (warga_id/rt_id NULL)
    // tidak boleh diproses hanya karena penyerang mengetahui UUID-nya.
    const wargaIdTarget = String(targetBarang.warga_id || "").trim();
    const rtIdTarget = String(targetBarang.rt_id || "").trim();
    if (!POLA_UUID.test(wargaIdTarget) || !POLA_UUID.test(rtIdTarget) || !adminBolehMengaksesRt(sesi, rtIdTarget)) {
      return { success: false, message: "Barang tidak berada dalam cakupan RT Anda." };
    }

    // Re-read owner dengan predicate id+rt_id dan status aktif. Ini mencegah
    // warga_id yang valid tetapi dipasangkan ke tenant yang salah menjadi jalur
    // IDOR horizontal.
    const { data: pemilik, error: errPemilik } = await supabase
      .from("warga")
      .select("id, rt_id, status_verifikasi")
      .eq("id", wargaIdTarget)
      .eq("rt_id", rtIdTarget)
      .maybeSingle();
    if (errPemilik || !pemilik || pemilik.status_verifikasi !== "Disetujui") {
      return { success: false, message: "Pemilik barang tidak valid atau sudah tidak aktif." };
    }

    const statusSaatIni = String(targetBarang.status || "").trim();
    const transisiDiizinkan: Record<string, string[]> = {
      "Tersedia di Rak Bin": ["Menunggu Verifikasi", "Sedang Direparasi", "Selesai Direparasi"],
      "Sedang Direparasi": ["Menunggu Verifikasi", "Tersedia di Rak Bin"],
      Terjual: ["Tersedia di Rak Bin", "Selesai Direparasi"],
    };
    if (!transisiDiizinkan[statusBersih]?.includes(statusSaatIni)) {
      return { success: false, message: "Perubahan status rak bin sudah kedaluwarsa atau tidak diizinkan." };
    }
    if (statusBersih === "Sedang Direparasi" && !teknisiBersih) {
      return { success: false, message: "Teknisi wajib dipilih untuk pekerjaan reparasi." };
    }
    if (statusBersih !== "Sedang Direparasi" && teknisiBersih) {
      return { success: false, message: "Teknisi hanya boleh ditetapkan pada status reparasi." };
    }
    if (statusBersih === "Sedang Direparasi" && !String(targetBarang.opsi_tujuan || "").includes("Reparasi")) {
      return { success: false, message: "Barang ini tidak meminta layanan reparasi." };
    }

    if (teknisiBersih) {
      // RT teknisi harus sama persis dengan RT barang, termasuk untuk
      // webmaster. Hak webmaster tidak boleh menjadi jembatan lintas tenant.
      const { data: teknisi, error: errTeknisi } = await supabase
        .from("lapak_warga")
        .select("id, rt_id")
        .eq("id", teknisiBersih)
        .eq("rt_id", rtIdTarget)
        .eq("kategori", "Jasa & Servis")
        .eq("status", "Aktif")
        .maybeSingle();
      if (errTeknisi || !teknisi || !adminBolehMengaksesRt(sesi, teknisi.rt_id)) {
        return { success: false, message: "Teknisi tidak berada dalam cakupan RT barang." };
      }
    }

    // Update status + ownership + versi status secara atomik. Jika baris
    // berubah setelah preflight, 0-row update menolak mutasi stale/TOCTOU.
    const payloadUpdate: Record<string, unknown> = { status: statusBersih, teknisi_id: teknisiBersih };
    let queryUpdate = supabase
      .from("limbah_ekonomis")
      .update(payloadUpdate)
      .eq("id", idBersih)
      .eq("warga_id", wargaIdTarget)
      .eq("rt_id", rtIdTarget)
      .eq("status", statusSaatIni);
    if (targetBarang.teknisi_id) {
      queryUpdate = queryUpdate.eq("teknisi_id", String(targetBarang.teknisi_id));
    } else {
      queryUpdate = queryUpdate.is("teknisi_id", null);
    }

    const { data: diperbarui, error } = await queryUpdate.select("id").maybeSingle();
    if (error || !diperbarui) return { success: false, message: "Status rak bin gagal diperbarui." };

    await supabase.from("audit_log").insert([{
      aktor: sesi.nama,
      aksi: `Update Rak Bin: ${statusBersih}`,
      tabel_target: "limbah_ekonomis",
      detail: `Barang: ${targetBarang.nama_barang} ${teknisiBersih ? '(Telah ditugaskan ke Teknisi)' : ''}`,
      rt_id: rtIdTarget,
    }]);
    return { success: true, message: "Status rak bin berhasil diperbarui." };
  }

  return (
    <SampahAdminClient 
      adminAktif={adminAktif} 
      transaksiList={transaksiRes || []} 
      wargaList={wargaRes || []} 
      rakBinList={rakBinRes || []}
      teknisiList={teknisiRes || []}
      aksiSimpan={simpanTransaksiSampah} 
      aksiUpdateRakBin={updateStatusRakBin}
    />
  );
}
