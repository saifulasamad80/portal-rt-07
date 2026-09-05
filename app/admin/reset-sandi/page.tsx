import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import {
  digestTokenReset,
  kodeErrorAman,
  normalisasiTokenReset,
  sandiAdminResetValid,
} from "@/lib/reset-sandi-security";
import ResetSandiClient from "./ResetSandiClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PESAN_TOKEN_TIDAK_SAH = "Tautan reset tidak valid, kedaluwarsa, atau sudah digunakan.";
const PESAN_GAGAL_UMUM = "Password belum dapat diubah. Silakan coba lagi atau minta tautan baru.";

type HasilReset =
  | { success: true }
  | { success: false; message: string };

export default async function ResetSandiPage({
  searchParams,
}: {
  // Duplicate query keys berbentuk array dan wajib ditolak, bukan dipilih satu.
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const token = normalisasiTokenReset(params.token);

  if (!token) redirect("/admin");

  // Hanya digest yang masuk ke closure Server Action dan database. Token asli
  // tetap menjadi bearer credential pada URL yang diterima pemilik email.
  const tokenDigest = digestTokenReset(token);

  async function ubahPassword(passwordBaru: unknown): Promise<HasilReset> {
    "use server";

    if (!sandiAdminResetValid(passwordBaru)) {
      return {
        success: false,
        message: "Password harus 8–72 byte dan tidak boleh memuat karakter kontrol.",
      };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    try {
      const hashedPassword = await bcrypt.hash(passwordBaru, 12);
      const waktuSekarang = new Date().toISOString();

      // Klaim token dan perubahan password terjadi dalam satu UPDATE dengan
      // compare-and-swap. Dua request paralel tidak bisa sama-sama menang:
      // request pertama mengosongkan reset_token, request berikutnya mendapat
      // nol baris dan ditolak.
      const { data: pengurus, error } = await supabase
        .from("pengurus_rt")
        .update({
          password: hashedPassword,
          reset_token: null,
          reset_token_expires: null,
          percobaan_gagal: 0,
          terkunci_sampai: null,
        })
        .eq("reset_token", tokenDigest)
        .gt("reset_token_expires", waktuSekarang)
        .select("id, rt_id")
        .maybeSingle();

      if (error) {
        console.error("Reset sandi admin gagal:", kodeErrorAman(error));
        return { success: false, message: PESAN_GAGAL_UMUM };
      }
      if (!pengurus) return { success: false, message: PESAN_TOKEN_TIDAK_SAH };

      const { error: errorAudit } = await supabase.from("audit_log").insert([{
        aktor: "SISTEM PEMULIHAN AKUN",
        aksi: "Reset Password Berhasil",
        tabel_target: "pengurus_rt",
        detail: `Pemulihan akun pengurus ID: ${pengurus.id}`,
        rt_id: pengurus.rt_id,
      }]);

      // Audit tidak boleh mengubah reset yang telah berhasil menjadi kegagalan
      // palsu, tetapi kegagalan log tetap terlihat di observability server.
      if (errorAudit) {
        console.error("Audit reset sandi admin gagal:", kodeErrorAman(errorAudit));
      }

      return { success: true };
    } catch (error: unknown) {
      console.error("Reset sandi admin tidak dapat diproses:", kodeErrorAman(error));
      return { success: false, message: PESAN_GAGAL_UMUM };
    }
  }

  return <ResetSandiClient aksiReset={ubahPassword} />;
}
