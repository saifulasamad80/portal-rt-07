import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { getSupabaseAdminClient } from "@/lib/supabase-server";
import SensusClient from "./SensusClient";
import {
  ambilStatusCarik,
  cariDuplikatWarga,
  hapusKarenaNikTidakSesuai,
  simpanVerifikasiCarik,
  type AnggotaInput,
  type HasilCarik,
} from "@/lib/verifikasi-carik";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production"
);

type SesiWarga = { id: string; nik?: string; nama?: string };

async function otentikasiWarga(): Promise<{ ok: true; sesi: SesiWarga } | { ok: false; message: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;
  if (!token) {
    return { ok: false, message: "Sesi Anda telah berakhir. Silakan masuk kembali." };
  }
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const id = String(payload.id || "");
    if (!id) return { ok: false, message: "Sesi tidak berisi identitas warga." };
    return { ok: true, sesi: { id, nik: payload.nik as string | undefined, nama: payload.nama as string | undefined } };
  } catch {
    return { ok: false, message: "Sesi tidak valid atau telah dimanipulasi. Silakan masuk kembali." };
  }
}

export default async function SensusPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;
  if (!token) redirect("/login");

  let wargaAktif: SesiWarga;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    wargaAktif = { id: String(payload.id), nik: payload.nik as string, nama: payload.nama as string };
  } catch {
    redirect("/login");
  }

  const supabase = getSupabaseAdminClient();
  const statusCarik = await ambilStatusCarik(supabase, wargaAktif.id);
  if (statusCarik.ok && statusCarik.data) {
    redirect("/portal");
  }

  const { data: profilWarga } = await supabase
    .from("warga")
    .select("*, anggota_keluarga(*)")
    .eq("id", wargaAktif.id)
    .single();

  if (!profilWarga) redirect("/login");

  const duplikat = await cariDuplikatWarga(supabase, {
    id: profilWarga.id,
    nik: profilWarga.nik,
    nama_lengkap: profilWarga.nama_lengkap,
    tanggal_lahir: profilWarga.tanggal_lahir,
  });

  async function aksiSimpanCarik(
    biodata: Record<string, unknown>,
    anggota: AnggotaInput[],
    catatan: string
  ): Promise<HasilCarik> {
    "use server";
    try {
      const otentikasi = await otentikasiWarga();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };

      const klien = getSupabaseAdminClient();
      return await simpanVerifikasiCarik(
        klien,
        otentikasi.sesi.id,
        biodata,
        anggota,
        catatan,
        otentikasi.sesi.nama || otentikasi.sesi.nik || "warga"
      );
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal saat menyimpan verifikasi.";
      return { success: false, message: pesan };
    }
  }

  async function aksiNikTidakSesuai(): Promise<HasilCarik> {
    "use server";
    try {
      const otentikasi = await otentikasiWarga();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };

      const klien = getSupabaseAdminClient();
      const hasil = await hapusKarenaNikTidakSesuai(
        klien,
        otentikasi.sesi.id,
        otentikasi.sesi.nama || otentikasi.sesi.nik || "warga"
      );

      if (hasil.success) {
        const store = await cookies();
        store.delete("warga_session");
      }

      return hasil;
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal saat menghapus data lama.";
      return { success: false, message: pesan };
    }
  }

  return (
    <SensusClient
      warga={profilWarga}
      duplikat={duplikat}
      aksiSimpan={aksiSimpanCarik}
      aksiNikTidakSesuai={aksiNikTidakSesuai}
    />
  );
}
