import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type SupabaseClient } from "@supabase/supabase-js";
import KurbanAdminClient from "./KurbanClient";
import { buatKlienTerautentikasi, getSupabaseAdminClientDariSesi } from "@/lib/supabase-server";
import {
  adminBolehMengaksesRt,
  adminUntukKlien,
  otentikasiAdminAktif,
  wajibOtentikasiAdmin,
} from "@/lib/session-security";

import { POLA_UUID, UUID_SENTINEL } from "@/lib/uuid-tenant";

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const UKURAN_KELOMPOK = 80;

type BarisKurbanAdmin = {
  tanggal_transaksi?: string | null;
  [kunci: string]: unknown;
};

type BarisSampahAdmin = {
  warga_id: string;
  jenis_transaksi: string;
  nominal_warga: number;
};

async function ambilKurbanCakupan(supabase: SupabaseClient, ids: string[], rtId: string) {
  const gabungan: BarisKurbanAdmin[] = [];
  for (let i = 0; i < ids.length; i += UKURAN_KELOMPOK) {
    const potong = ids.slice(i, i + UKURAN_KELOMPOK);
    const { data, error } = await supabase
      .from("transaksi_kurban")
      .select("*, warga(nama_lengkap)")
      .in("warga_id", potong)
      .eq("rt_id", rtId);
    if (error) return { data: [] as BarisKurbanAdmin[], error };
    gabungan.push(...((data || []) as BarisKurbanAdmin[]));
  }
  gabungan.sort((a, b) =>
    String(b.tanggal_transaksi || "").localeCompare(String(a.tanggal_transaksi || "")),
  );
  return { data: gabungan, error: null };
}

async function ambilSampahCakupan(supabase: SupabaseClient, ids: string[], rtId: string) {
  const gabungan: BarisSampahAdmin[] = [];
  for (let i = 0; i < ids.length; i += UKURAN_KELOMPOK) {
    const potong = ids.slice(i, i + UKURAN_KELOMPOK);
    const { data, error } = await supabase
      .from("transaksi_sampah")
      .select("warga_id, jenis_transaksi, nominal_warga")
      .in("warga_id", potong)
      .eq("rt_id", rtId);
    if (error) return { data: [] as BarisSampahAdmin[], error };
    gabungan.push(...((data || []) as BarisSampahAdmin[]));
  }
  return { data: gabungan, error: null };
}

export default async function AdminKurbanPage() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) redirect("/admin");
  const adminAktif = adminUntukKlien(otentikasi.sesi);

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);

  // Baca daftar warga lebih dulu agar transaksi lintas-RT tidak ikut dikirim.
  let queryWarga = supabaseAdmin.from("warga").select("id, nama_lengkap, rt_id").eq("status_verifikasi", "Disetujui");
  if (otentikasi.sesi.role !== "webmaster") queryWarga = queryWarga.eq("rt_id", otentikasi.sesi.rtId);
  const { data: wargaRes } = await queryWarga.order("nama_lengkap", { ascending: true }).limit(1000);
  const idWargaCakupan = (wargaRes || []).map((w) => String(w.id));
  // PostgREST menaruh .in() di query string. Ratusan UUID sekali tembak pecah
  // jadi HTTP 400 (URL terlalu panjang) — daftar/saldo kurban jadi kosong.
  const [{ data: kurbanRes }, { data: sampahRes }] =
    otentikasi.sesi.role === "webmaster"
      ? await Promise.all([
          supabaseAdmin.from("transaksi_kurban").select("*, warga(nama_lengkap)").order("tanggal_transaksi", { ascending: false }).limit(500),
          supabaseAdmin.from("transaksi_sampah").select("warga_id, jenis_transaksi, nominal_warga").limit(5000),
        ])
      : await Promise.all([
          ambilKurbanCakupan(
            supabaseAdmin,
            idWargaCakupan.length ? idWargaCakupan : [UUID_SENTINEL],
            otentikasi.sesi.rtId,
          ),
          ambilSampahCakupan(
            supabaseAdmin,
            idWargaCakupan.length ? idWargaCakupan : [UUID_SENTINEL],
            otentikasi.sesi.rtId,
          ),
        ]);

  async function simpanTransaksiKurban(wargaId: string, jenis: string, sumber: string, nominal: number, keterangan: string, tanggal: string) {
    "use server";
    const sesiAsli = await wajibOtentikasiAdmin();

    try {
      const idBersih = String(wargaId || "").trim();
      const jenisBersih = String(jenis || "").trim();
      const sumberBersih = String(sumber || "").trim();
      const nominalBersih = Number(nominal);
      const tanggalBersih = String(tanggal || "").trim();
      const sumberNormal = sumberBersih === "Transfer" ? "Transfer Bank" : sumberBersih;
      if (!POLA_UUID.test(idBersih) || !["Setoran (+)", "Tarikan (-)"].includes(jenisBersih) || !["Tunai", "Transfer Bank", "Saldo Tabungan Sampah"].includes(sumberNormal) || !Number.isFinite(nominalBersih) || nominalBersih <= 0 || !POLA_TANGGAL.test(tanggalBersih)) {
        return { success: false, message: "Data transaksi kurban tidak valid." };
      }
      const supabase = await buatKlienTerautentikasi(sesiAsli);
      const { data: targetWarga, error: errTarget } = await supabase
        .from("warga")
        .select("id, nama_lengkap, rt_id, status_verifikasi")
        .eq("id", idBersih)
        .maybeSingle();
      if (errTarget || !targetWarga || targetWarga.status_verifikasi !== "Disetujui" || !adminBolehMengaksesRt(sesiAsli, targetWarga.rt_id)) {
        return { success: false, message: "Warga transaksi tidak berada dalam cakupan RT Anda." };
      }
      
      // ---------------------------------------------------------------------
      // EKSEKUSI RPC: Transaksi Finansial Atomik (Auto-Debet Sampah)
      // ---------------------------------------------------------------------
      if (sumberBersih === "Saldo Tabungan Sampah" && jenisBersih === "Setoran (+)") {
        const { error: errRpc } = await getSupabaseAdminClientDariSesi(sesiAsli).rpc("proses_autodebet_kurban", {
          p_warga_id: targetWarga.id,
          p_nominal: nominalBersih,
          p_keterangan: String(keterangan || "").trim().slice(0, 1000),
          p_tanggal: tanggalBersih,
          p_aktor: sesiAsli.nama,
        });

        if (errRpc) {
          console.error("Auto-debet kurban ditolak:", errRpc.code || "database_error");
          return { success: false, message: "Auto-debet belum dapat diproses. Saldo mungkin berubah; coba lagi." };
        }
        revalidatePath("/");
        return { success: true };
      }

      // ---------------------------------------------------------------------
      // TRANSAKSI NORMAL (Penarikan Kurban / Setoran Tunai & Transfer)
      // ---------------------------------------------------------------------
      if (jenisBersih === "Tarikan (-)") {
        const { data: riwayat } = await supabase.from("transaksi_kurban").select("jenis_transaksi, nominal").eq("warga_id", idBersih).eq("rt_id", targetWarga.rt_id);
        let saldoKurban = 0;
        riwayat?.forEach(r => {
          if (r.jenis_transaksi === "Setoran (+)") saldoKurban += r.nominal;
          if (r.jenis_transaksi === "Tarikan (-)") saldoKurban -= r.nominal;
        });
        if (nominalBersih > saldoKurban) return { success: false, message: "SERVER BLOCKED: Saldo kurban tidak mencukupi!" };
      }

      const { error } = await supabase.from("transaksi_kurban").insert([{
        warga_id: idBersih, rt_id: targetWarga.rt_id, jenis_transaksi: jenisBersih, sumber_dana: sumberNormal, nominal: nominalBersih, keterangan: String(keterangan || "").trim().slice(0, 1000), tanggal_transaksi: tanggalBersih
      }]);

      if (error) {
        console.error("Simpan transaksi kurban gagal:", error.code || "database_error");
        return { success: false, message: "Transaksi kurban belum dapat disimpan." };
      }

      await supabase.from("audit_log").insert([{
        aktor: sesiAsli.nama, aksi: `Input Transaksi Kurban: ${jenisBersih}`, tabel_target: "transaksi_kurban",
        detail: `${targetWarga.nama_lengkap} - Rp${nominalBersih} via ${sumberBersih}`,
        rt_id: targetWarga.rt_id,
      }]);
      
      revalidatePath("/");
      return { success: true };
    } catch (err: unknown) {
      console.error("Aksi transaksi kurban gagal:", err instanceof Error ? err.name : "unknown");
      return { success: false, message: "Aksi transaksi kurban belum dapat diproses." };
    }
  }

  return <KurbanAdminClient adminAktif={adminAktif} transaksiList={kurbanRes || []} wargaList={wargaRes || []} sampahList={sampahRes || []} aksiSimpan={simpanTransaksiKurban} />;
}
