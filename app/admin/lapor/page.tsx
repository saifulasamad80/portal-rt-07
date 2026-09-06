import { redirect } from "next/navigation";
import LaporAdminClient from "./LaporAdminClient";
import {
  adalahTiketPerubahanKeluarga,
  PESAN_TANGGAPAN_IZINKAN_REVISI,
  STATUS_TIKET_TERBUKA,
  tiketKeluargaMasihTerbuka,
} from "@/lib/kebijakan-sensus";
import { otentikasiAdminAktif } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";

const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type HasilAksiLapor = { success: boolean; message?: string };
type SesiPengurusSaring = { role: string; rtId: string };

async function bacaTiketTerbuka(
  supabase: Awaited<ReturnType<typeof buatKlienTerautentikasi>>,
  sesi: SesiPengurusSaring,
  laporanId: string
) {
  let queryTarget = supabase
    .from("laporan_warga")
    .select("id, judul_laporan, status, rt_id, warga_id")
    .eq("id", laporanId);
  if (sesi.role !== "webmaster") queryTarget = queryTarget.eq("rt_id", sesi.rtId);
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

  let queryLaporan = supabaseAdmin
    .from("laporan_warga")
    .select("id, warga_id, judul_laporan, deskripsi, status, tanggapan_rt, created_at, warga(nama_lengkap)")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (otentikasi.sesi.role !== "webmaster") queryLaporan = queryLaporan.eq("rt_id", otentikasi.sesi.rtId);
  const { data: laporanRes, error: errLaporan } = await queryLaporan;
  // #region agent log
  fetch('http://127.0.0.1:7451/ingest/bdf48fb7-809f-4eb9-8796-2124cb9050c0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4c2797'},body:JSON.stringify({sessionId:'4c2797',runId:'post-fix',hypothesisId:'E',location:'app/admin/lapor/page.tsx:queryLaporan',message:'admin lapor query result',data:{adaError:Boolean(errLaporan),kodeError:errLaporan?.code||null,pesanError:errLaporan?.message||null,jumlahBaris:Array.isArray(laporanRes)?laporanRes.length:0,role:otentikasi.sesi.role,rtIdTail:String(otentikasi.sesi.rtId||'').slice(-4)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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

      let queryUpdate = supabase
        .from("laporan_warga")
        .update({
          status: statusBersih,
          tanggapan_rt: tanggapanBersih,
        })
        .eq("id", idBersih);
      if (otentikasiAksi.sesi.role !== "webmaster") queryUpdate = queryUpdate.eq("rt_id", otentikasiAksi.sesi.rtId);
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

      const { data: capDibuka, error: errCap } = await supabase
        .from("sensus_kesejahteraan")
        .update({ status_validasi: "Menunggu" })
        .eq("warga_id", wargaId)
        .eq("status_validasi", "Disetujui")
        .select("id")
        .maybeSingle();

      if (errCap) {
        console.error("Pembukaan cap Carik gagal:", errCap.message);
        return { success: false, message: "Cap verifikasi belum dapat dibuka. Coba lagi nanti." };
      }

      if (!capDibuka) {
        const { data: capAda, error: errCek } = await supabase
          .from("sensus_kesejahteraan")
          .select("id, status_validasi")
          .eq("warga_id", wargaId)
          .maybeSingle();
        if (errCek) {
          console.error("Pemeriksaan cap Carik gagal:", errCek.message);
          return { success: false, message: "Status verifikasi belum dapat diperiksa. Coba lagi nanti." };
        }
        if (capAda?.status_validasi !== "Menunggu") {
          return { success: false, message: "Cap verifikasi keluarga tidak dapat dibuka. Muat ulang halaman." };
        }
      }

      let queryTutup = supabase
        .from("laporan_warga")
        .update({
          status: "Selesai",
          tanggapan_rt: PESAN_TANGGAPAN_IZINKAN_REVISI,
        })
        .eq("id", idBersih)
        .in("status", [...STATUS_TIKET_TERBUKA]);
      if (otentikasiAksi.sesi.role !== "webmaster") queryTutup = queryTutup.eq("rt_id", otentikasiAksi.sesi.rtId);
      const { data: tiketDitutup, error: errTutup } = await queryTutup.select("id").maybeSingle();

      if (errTutup || !tiketDitutup) {
        console.error("Penutupan tiket revisi gagal:", errTutup?.message);
        return { success: false, message: "Cap sudah dibuka, tetapi tiket belum tertutup. Ulangi Izinkan Revisi." };
      }

      await supabase.from("audit_log").insert([{
        aktor: otentikasiAksi.sesi.nama,
        aksi: "Izinkan Revisi Data Keluarga",
        tabel_target: "sensus_kesejahteraan",
        detail: `Membuka cap Carik untuk tiket ${idBersih} tanpa mengubah status akun.`,
        rt_id: target.tiket.rt_id,
      }]);

      return { success: true, message: "Revisi diizinkan. Warga dapat mengoreksi data di form Carik." };
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

      let queryTolak = supabase
        .from("laporan_warga")
        .update({
          status: "Ditolak",
          tanggapan_rt: alasanBersih,
        })
        .eq("id", idBersih)
        .in("status", [...STATUS_TIKET_TERBUKA]);
      if (otentikasiAksi.sesi.role !== "webmaster") queryTolak = queryTolak.eq("rt_id", otentikasiAksi.sesi.rtId);
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
