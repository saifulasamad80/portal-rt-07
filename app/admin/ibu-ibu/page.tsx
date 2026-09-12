import { redirect } from "next/navigation";
import IbuIbuAdminClient from "./IbuIbuAdminClient";
import {
  buatKlienTerautentikasi,
  getSupabaseAdminClientDariSesi,
} from "@/lib/supabase-server";
import {
  otentikasiAdminAktif,
  wajibOtentikasiAdmin,
} from "@/lib/session-security";
import {
  anonimkanKunjunganYatimRt,
  daftarKartuIzinPosyandu,
  daftarKunjunganBalitaRt,
  daftarKunjunganLansiaRt,
  hapusKunjunganPosyandu,
  hitungRekamYatimRt,
  simpanKunjunganBalita,
  simpanKunjunganLansia,
} from "@/lib/posyandu-kunjungan";

export default async function AdminIbuIbuPage() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok) redirect("/admin");
  const rtIdAktif = otentikasi.sesi.rtId;

  const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
  const supabasePosyandu = getSupabaseAdminClientDariSesi(otentikasi.sesi);
  const [kunjunganLansia, kunjunganBalita, kartuIzin, jumlahRekamYatim, arisanRes, jumantikRes] = await Promise.all([
    daftarKunjunganLansiaRt(supabasePosyandu, rtIdAktif),
    daftarKunjunganBalitaRt(supabasePosyandu, rtIdAktif),
    daftarKartuIzinPosyandu(supabasePosyandu, rtIdAktif),
    hitungRekamYatimRt(supabasePosyandu, rtIdAktif),
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

  async function aksiSimpanKunjunganBalita(payload: unknown) {
    "use server";
    try {
      const sesi = await wajibOtentikasiAdmin();
      const hasil = await simpanKunjunganBalita(getSupabaseAdminClientDariSesi(sesi), {
        rtId: sesi.rtId,
        aktor: sesi.nama,
        payload,
      });
      return hasil.ok
        ? { success: true, data: hasil.data }
        : { success: false, message: hasil.message };
    } catch {
      return { success: false, message: "Aksi kunjungan balita belum dapat diproses." };
    }
  }

  async function aksiSimpanKunjunganLansia(payload: unknown) {
    "use server";
    try {
      const sesi = await wajibOtentikasiAdmin();
      const hasil = await simpanKunjunganLansia(getSupabaseAdminClientDariSesi(sesi), {
        rtId: sesi.rtId,
        aktor: sesi.nama,
        payload,
      });
      return hasil.ok
        ? { success: true, data: hasil.data }
        : { success: false, message: hasil.message };
    } catch {
      return { success: false, message: "Aksi kunjungan lansia belum dapat diproses." };
    }
  }

  async function aksiHapusKunjungan(tabel: string, id: string) {
    "use server";
    try {
      const sesi = await wajibOtentikasiAdmin();
      const hasil = await hapusKunjunganPosyandu(getSupabaseAdminClientDariSesi(sesi), {
        rtId: sesi.rtId,
        aktor: sesi.nama,
        tabel,
        id,
      });
      return hasil.ok ? { success: true } : { success: false, message: hasil.message };
    } catch {
      return { success: false, message: "Kunjungan belum dapat dihapus." };
    }
  }

  async function aksiAnonimkanYatim() {
    "use server";
    try {
      const sesi = await wajibOtentikasiAdmin();
      const hasil = await anonimkanKunjunganYatimRt(getSupabaseAdminClientDariSesi(sesi), {
        rtId: sesi.rtId,
        aktor: sesi.nama,
      });
      return hasil.ok
        ? { success: true, message: `${hasil.jumlah} rekam tanpa tautan dianonimkan.` }
        : { success: false, message: hasil.message };
    } catch {
      return { success: false, message: "Rekam yatim belum dapat dianonimkan." };
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
        { arisan_id: arisanId, rt_id: sesi.rtId, jenis, nominal, catatan: String(input.catatan || "").trim().slice(0, 1000) || null },
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
          .eq("rt_id", sesi.rtId)
          .maybeSingle();
        if (errTransaksi || !transaksi) return { success: false, message: "Catatan tidak ditemukan." };
        const { data: induk } = await db.from("arisan_ibu").select("id").eq("id", transaksi.arisan_id).eq("rt_id", sesi.rtId).maybeSingle();
        if (!induk) return { success: false, message: "Akses lintas RT ditolak." };
        query = query.eq("rt_id", sesi.rtId);
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
      kunjunganLansia={kunjunganLansia}
      kunjunganBalita={kunjunganBalita}
      arisan={arisanRes.data || []}
      transaksi={transaksiRes.data || []}
      aksiSimpanArisan={simpanArisan}
      aksiSimpanTransaksi={simpanTransaksiArisan}
      aksiHapus={hapusCatatan}
      aksiSimpanKunjunganBalita={aksiSimpanKunjunganBalita}
      aksiSimpanKunjunganLansia={aksiSimpanKunjunganLansia}
      aksiHapusKunjungan={aksiHapusKunjungan}
      aksiAnonimkanYatim={aksiAnonimkanYatim}
      jumlahRekamYatim={jumlahRekamYatim}
      laporanJumantik={jumantikRes.error ? null : jumantikRes.data}
      aksiCatatJumantik={catatLaporanJumantik}
      kartuIzin={kartuIzin.ok ? kartuIzin.data : []}
    />
  );
}
