import { redirect } from "next/navigation";
import LaporAdminClient from "./LaporAdminClient";
import {
  adalahTiketPerubahanKeluarga,
  STATUS_TIKET_TERBUKA,
  tiketKeluargaMasihTerbuka,
} from "@/lib/kebijakan-sensus";
import { adminBolehMengaksesRt, otentikasiAdminAktif } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";

import { POLA_UUID } from "@/lib/uuid-tenant";

type HasilAksiLapor = { success: boolean; message?: string };
type SesiPengurusSaring = { role: string; rtId: string };

async function bacaTiketTerbuka(
  supabase: Awaited<ReturnType<typeof buatKlienTerautentikasi>>,
  sesi: SesiPengurusSaring,
  laporanId: string
) {
  const queryTarget = supabase
    .from("laporan_warga")
    .select("id, judul_laporan, status, rt_id, warga_id")
    .eq("id", laporanId)
    .eq("rt_id", sesi.rtId);
  const { data, error } = await queryTarget.maybeSingle();
  if (error || !data) return { ok: false as const, message: "Laporan tidak berada dalam cakupan RT Anda." };
  return { ok: true as const, tiket: data };
}

function namaPelaporDariRelasi(warga: unknown): { nama_lengkap: string | null } | null {
  if (Array.isArray(warga)) {
    const pertama = warga[0] as { nama_lengkap?: unknown } | undefined;
    return { nama_lengkap: pertama?.nama_lengkap == null ? null : String(pertama.nama_lengkap) };
  }
  if (warga && typeof warga === "object" && "nama_lengkap" in warga) {
    const nama = (warga as { nama_lengkap?: unknown }).nama_lengkap;
    return { nama_lengkap: nama == null ? null : String(nama) };
  }
  return null;
}

export default async function AdminLaporPage() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) redirect("/admin");

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);

  const queryLaporan = supabaseAdmin
    .from("laporan_warga")
    .select("id, warga_id, judul_laporan, deskripsi, status, tanggapan_rt, created_at, warga(nama_lengkap)")
    .eq("rt_id", otentikasi.sesi.rtId)
    .order("created_at", { ascending: false })
    .limit(1000);
  const { data: laporanRes, error: errLaporan } = await queryLaporan;
  if (errLaporan) console.error("Gagal memuat antrean laporan:", errLaporan.message);

  async function tanggapiLaporan(laporanId: string, statusBaru: string, tanggapanTeks: string): Promise<HasilAksiLapor> {
    "use server";
    try {
      const otentikasiAksi = await otentikasiAdminAktif();
      if (!otentikasiAksi.ok) return { success: false, message: otentikasiAksi.message };

      const idBersih = String(laporanId || "").trim();
      const statusBersih = String(statusBaru || "").trim();
      const tanggapanBersih = String(tanggapanTeks || "").trim().slice(0, 5000);
      if (!POLA_UUID.test(idBersih) || !["Menunggu", "Diproses", "Selesai", "Ditolak"].includes(statusBersih) || !tanggapanBersih) {
        return { success: false, message: "Data tanggapan tidak valid." };
      }

      const supabase = await buatKlienTerautentikasi(otentikasiAksi.sesi);
      const target = await bacaTiketTerbuka(supabase, otentikasiAksi.sesi, idBersih);
      if (!target.ok) return { success: false, message: target.message };

      if (adalahTiketPerubahanKeluarga(target.tiket.judul_laporan) && statusBersih === "Selesai") {
        return { success: false, message: "Tiket data keluarga hanya ditutup lewat Izinkan Revisi." };
      }

      const queryUpdate = supabase
        .from("laporan_warga")
        .update({
          status: statusBersih,
          tanggapan_rt: tanggapanBersih,
        })
        .eq("id", idBersih)
        .eq("rt_id", otentikasiAksi.sesi.rtId);
      const { data: diperbarui, error } = await queryUpdate.select("id").maybeSingle();

      if (error || !diperbarui) return { success: false, message: "Laporan berubah atau gagal diperbarui." };

      await supabase.from("audit_log").insert([{
        aktor: otentikasiAksi.sesi.nama,
        aksi: `Tanggapan Laporan: ${statusBersih}`,
        tabel_target: "laporan_warga",
        detail: `Merespons tiket: ${target.tiket.judul_laporan}`,
        rt_id: target.tiket.rt_id,
      }]);
      return { success: true };
    } catch (err: unknown) {
      console.error("Tanggapan laporan gagal:", err instanceof Error ? err.name : "unknown");
      return { success: false, message: "Tanggapan belum dapat disimpan. Coba lagi nanti." };
    }
  }

  async function aksiIzinkanRevisi(laporanId: string): Promise<HasilAksiLapor> {
    "use server";
    try {
      const otentikasiAksi = await otentikasiAdminAktif();
      if (!otentikasiAksi.ok) return { success: false, message: otentikasiAksi.message };

      const idBersih = String(laporanId || "").trim();
      if (!POLA_UUID.test(idBersih)) return { success: false, message: "Tiket tidak valid." };

      const supabase = await buatKlienTerautentikasi(otentikasiAksi.sesi);
      const target = await bacaTiketTerbuka(supabase, otentikasiAksi.sesi, idBersih);
      if (!target.ok) return { success: false, message: target.message };
      if (!adalahTiketPerubahanKeluarga(target.tiket.judul_laporan)) {
        return { success: false, message: "Izinkan Revisi hanya untuk tiket data keluarga." };
      }
      if (!tiketKeluargaMasihTerbuka(target.tiket.status)) {
        return { success: false, message: "Tiket ini sudah ditutup." };
      }

      const wargaId = String(target.tiket.warga_id || "");
      if (!POLA_UUID.test(wargaId)) {
        return { success: false, message: "Pemilik tiket tidak valid." };
      }

      const rtIdTujuan = String(target.tiket.rt_id || "").trim();
      if (!POLA_UUID.test(rtIdTujuan) || !adminBolehMengaksesRt(otentikasiAksi.sesi, rtIdTujuan)) {
        return { success: false, message: "Laporan tidak berada dalam cakupan RT Anda." };
      }

      const { data: pemilik, error: errPemilik } = await supabase
        .from("warga")
        .select("id")
        .eq("id", wargaId)
        .eq("rt_id", rtIdTujuan)
        .maybeSingle();
      if (errPemilik || !pemilik) {
        return { success: false, message: "Pemilik tiket tidak berada dalam cakupan RT tiket." };
      }

      const { data: hasilRpc, error: errRpc } = await supabase.rpc("aksi_izinkan_revisi", {
        p_laporan_id: idBersih,
        p_aktor: otentikasiAksi.sesi.nama,
      });
      if (errRpc) {
        console.error("Izinkan revisi RPC gagal:", errRpc.code || "database_error");
        const pesan = String(errRpc.message || "");
        if (pesan.includes("Tiket ini sudah ditutup")) return { success: false, message: "Tiket ini sudah ditutup." };
        if (pesan.includes("Izinkan Revisi hanya")) return { success: false, message: "Izinkan Revisi hanya untuk tiket data keluarga." };
        if (pesan.includes("cakupan")) return { success: false, message: "Laporan tidak berada dalam cakupan RT Anda." };
        if (pesan.includes("Cap verifikasi")) return { success: false, message: "Cap verifikasi keluarga tidak dapat dibuka. Muat ulang halaman." };
        return { success: false, message: "Revisi belum dapat diizinkan. Coba lagi nanti." };
      }

      const ok = Boolean(hasilRpc && typeof hasilRpc === "object" && (hasilRpc as { ok?: unknown }).ok === true);
      const pesanRpc = hasilRpc && typeof hasilRpc === "object"
        ? String((hasilRpc as { message?: unknown }).message || "")
        : "";
      if (!ok) {
        return { success: false, message: pesanRpc || "Revisi belum dapat diizinkan. Coba lagi nanti." };
      }

      return { success: true, message: pesanRpc || "Revisi diizinkan. Warga dapat mengoreksi data di form Carik." };
    } catch (err: unknown) {
      console.error("Izinkan revisi gagal:", err instanceof Error ? err.name : "unknown");
      return { success: false, message: "Revisi belum dapat diizinkan. Coba lagi nanti." };
    }
  }

  async function aksiTolakRevisi(laporanId: string, alasan: string): Promise<HasilAksiLapor> {
    "use server";
    try {
      const otentikasiAksi = await otentikasiAdminAktif();
      if (!otentikasiAksi.ok) return { success: false, message: otentikasiAksi.message };

      const idBersih = String(laporanId || "").trim();
      const alasanBersih = String(alasan || "").trim().slice(0, 1000);
      if (!POLA_UUID.test(idBersih) || alasanBersih.length < 10) {
        return { success: false, message: "Alasan penolakan wajib diisi (minimal 10 karakter)." };
      }

      const supabase = await buatKlienTerautentikasi(otentikasiAksi.sesi);
      const target = await bacaTiketTerbuka(supabase, otentikasiAksi.sesi, idBersih);
      if (!target.ok) return { success: false, message: target.message };
      if (!adalahTiketPerubahanKeluarga(target.tiket.judul_laporan)) {
        return { success: false, message: "Penolakan ini hanya untuk tiket data keluarga." };
      }
      if (!tiketKeluargaMasihTerbuka(target.tiket.status)) {
        return { success: false, message: "Tiket ini sudah ditutup." };
      }

      const queryTolak = supabase
        .from("laporan_warga")
        .update({
          status: "Ditolak",
          tanggapan_rt: alasanBersih,
        })
        .eq("id", idBersih)
        .eq("rt_id", otentikasiAksi.sesi.rtId)
        .in("status", [...STATUS_TIKET_TERBUKA]);
      const { data: ditolak, error } = await queryTolak.select("id").maybeSingle();
      if (error || !ditolak) return { success: false, message: "Tiket berubah atau gagal ditolak." };

      await supabase.from("audit_log").insert([{
        aktor: otentikasiAksi.sesi.nama,
        aksi: "Tolak Revisi Data Keluarga",
        tabel_target: "laporan_warga",
        detail: `Menolak tiket ${idBersih} tanpa membuka cap Carik.`,
        rt_id: target.tiket.rt_id,
      }]);

      return { success: true, message: "Permohonan ditolak. Data keluarga tetap terkunci." };
    } catch (err: unknown) {
      console.error("Tolak revisi gagal:", err instanceof Error ? err.name : "unknown");
      return { success: false, message: "Penolakan belum dapat disimpan. Coba lagi nanti." };
    }
  }

  const daftarTiket = (laporanRes || []).map((baris) => ({
    id: String(baris.id),
    judul_laporan: (baris.judul_laporan as string | null) ?? null,
    deskripsi: (baris.deskripsi as string | null) ?? null,
    status: (baris.status as string | null) ?? null,
    tanggapan_rt: (baris.tanggapan_rt as string | null) ?? null,
    created_at: (baris.created_at as string | null) ?? null,
    warga: namaPelaporDariRelasi(baris.warga),
  }));

  return (
    <LaporAdminClient
      laporanList={daftarTiket}
      aksiTanggapi={tanggapiLaporan}
      aksiIzinkanRevisi={aksiIzinkanRevisi}
      aksiTolakRevisi={aksiTolakRevisi}
    />
  );
}
