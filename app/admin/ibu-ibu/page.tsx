import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import IbuIbuAdminClient from "./IbuIbuAdminClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

async function pastikanOtentikasiAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) throw new Error("Akses Ilegal: Sesi tidak valid atau telah berakhir.");
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as any;
}

function klien() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export default async function AdminIbuIbuPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) redirect("/admin");
  try {
    await jwtVerify(token, JWT_SECRET);
  } catch {
    redirect("/admin");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const [lansiaRes, balitaRes, arisanRes, transaksiRes] = await Promise.all([
    supabase.from("posyandu_lansia").select("*").order("tanggal_kunjungan", { ascending: false }).limit(200),
    supabase.from("posyandu_balita").select("*").order("tanggal_kunjungan", { ascending: false }).limit(200),
    supabase.from("arisan_ibu").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("arisan_transaksi").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  async function simpanLansia(payload: any) {
    "use server";
    try {
      const sesi = await pastikanOtentikasiAdmin();
      const db = klien();
      const { error } = await db.from("posyandu_lansia").insert([{
        nama_peserta: String(payload.nama_peserta || "").trim(),
        tanggal_lahir: payload.tanggal_lahir || null,
        tanggal_kunjungan: payload.tanggal_kunjungan || new Date().toISOString().slice(0, 10),
        tekanan_darah: payload.tekanan_darah || null,
        gula_darah: payload.gula_darah || null,
        berat_kg: payload.berat_kg ? Number(payload.berat_kg) : null,
        catatan: payload.catatan || null,
        rt_id: sesi.rt_id || null,
      }]);
      if (error) return { success: false, message: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async function simpanBalita(payload: any) {
    "use server";
    try {
      const sesi = await pastikanOtentikasiAdmin();
      const db = klien();
      const { error } = await db.from("posyandu_balita").insert([{
        nama_anak: String(payload.nama_anak || "").trim(),
        nama_ibu: payload.nama_ibu || null,
        tanggal_lahir: payload.tanggal_lahir || null,
        tanggal_kunjungan: payload.tanggal_kunjungan || new Date().toISOString().slice(0, 10),
        berat_kg: payload.berat_kg ? Number(payload.berat_kg) : null,
        tinggi_cm: payload.tinggi_cm ? Number(payload.tinggi_cm) : null,
        imunisasi: payload.imunisasi || null,
        catatan: payload.catatan || null,
        rt_id: sesi.rt_id || null,
      }]);
      if (error) return { success: false, message: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async function simpanArisan(payload: any) {
    "use server";
    try {
      const sesi = await pastikanOtentikasiAdmin();
      const db = klien();
      const { error } = await db.from("arisan_ibu").insert([{
        nama_anggota: String(payload.nama_anggota || "").trim(),
        no_whatsapp: payload.no_whatsapp || null,
        status_keanggotaan: payload.status_keanggotaan || "Aktif",
        setoran_terakhir: Number(payload.setoran_terakhir || 0),
        pinjaman_berjalan: Number(payload.pinjaman_berjalan || 0),
        catatan: payload.catatan || null,
        rt_id: sesi.rt_id || null,
      }]);
      if (error) return { success: false, message: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async function simpanTransaksiArisan(payload: any) {
    "use server";
    try {
      await pastikanOtentikasiAdmin();
      const db = klien();
      const arisanId = String(payload.arisan_id || "");
      const jenis = String(payload.jenis || "Setoran");
      const nominal = Number(payload.nominal || 0);
      if (!arisanId || !nominal) return { success: false, message: "Anggota dan nominal wajib diisi." };
      const { error } = await db.from("arisan_transaksi").insert([
        { arisan_id: arisanId, jenis, nominal, catatan: payload.catatan || null },
      ]);
      if (error) return { success: false, message: error.message };

      const { data: anggota } = await db.from("arisan_ibu").select("setoran_terakhir, pinjaman_berjalan").eq("id", arisanId).single();
      const setoran = Number(anggota?.setoran_terakhir || 0);
      const pinjaman = Number(anggota?.pinjaman_berjalan || 0);
      const pembaruan =
        jenis === "Pinjaman"
          ? { pinjaman_berjalan: pinjaman + nominal }
          : jenis === "Angsuran"
            ? { pinjaman_berjalan: Math.max(0, pinjaman - nominal) }
            : { setoran_terakhir: nominal };
      await db.from("arisan_ibu").update(pembaruan).eq("id", arisanId);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async function hapusCatatan(tabel: string, id: string) {
    "use server";
    try {
      await pastikanOtentikasiAdmin();
      const diizinkan = ["posyandu_lansia", "posyandu_balita", "arisan_ibu", "arisan_transaksi"];
      if (!diizinkan.includes(tabel)) return { success: false, message: "Tabel tidak diizinkan." };
      const db = klien();
      const { error } = await db.from(tabel).delete().eq("id", id);
      if (error) return { success: false, message: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  return (
    <IbuIbuAdminClient
      posyanduLansia={lansiaRes.data || []}
      posyanduBalita={balitaRes.data || []}
      arisan={arisanRes.data || []}
      transaksi={transaksiRes.data || []}
      aksiSimpanLansia={simpanLansia}
      aksiSimpanBalita={simpanBalita}
      aksiSimpanArisan={simpanArisan}
      aksiSimpanTransaksi={simpanTransaksiArisan}
      aksiHapus={hapusCatatan}
    />
  );
}
