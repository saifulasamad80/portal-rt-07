import "server-only";

import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import {
  JEDA_PERMINTAAN_RESET_MS,
  MASA_BERLAKU_TOKEN_RESET_MS,
  buatTautanReset,
  buatTokenReset,
  dapatkanBaseUrlReset,
  escapeHtml,
  kodeErrorAman,
  normalisasiEmailReset,
} from "@/lib/reset-sandi-security";
import LupaSandiClient from "./LupaSandiClient";

const PESAN_PUBLIK_RESET =
  "Jika alamat tersebut terdaftar, instruksi pemulihan akan dikirim. Periksa kotak masuk atau folder spam.";

type HasilReset = { success: true; message: string };

/**
 * Semua pekerjaan yang dapat membedakan akun (lookup, klaim token, SMTP)
 * dijalankan setelah respons dikirim. Browser selalu menerima pesan yang sama;
 * detail Supabase/SMTP hanya masuk ke log server dengan kode aman.
 */
async function prosesPermintaanReset(email: string): Promise<void> {
  const baseUrl = dapatkanBaseUrlReset();
  const emailPengirim = normalisasiEmailReset(process.env.EMAIL_USER);
  const sandiPengirim = process.env.EMAIL_PASS;

  // Jangan membuat token yang tidak dapat dipakai bila konfigurasi belum siap.
  if (!baseUrl || !emailPengirim || typeof sandiPengirim !== "string" || !sandiPengirim) {
    console.error("Reset sandi tidak diproses: konfigurasi origin/SMTP tidak lengkap.");
    return;
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    // Email sudah dinormalisasi dan tidak pernah diinterpolasikan ke filter
    // PostgREST. Ambiguitas data ditolak, bukan memilih akun secara arbitrer.
    const { data: pengurus, error: errorCari } = await supabaseAdmin
      .from("pengurus_rt")
      .select("id, nama_lengkap, email, reset_token, reset_token_expires")
      .eq("email", email)
      .maybeSingle();

    if (errorCari) {
      console.error("Lookup reset sandi gagal:", kodeErrorAman(errorCari));
      return;
    }
    if (!pengurus || typeof pengurus.id !== "string") return;

    const tokenBaru = buatTokenReset();
    const batasKirimUlang = new Date(
      Date.now() + MASA_BERLAKU_TOKEN_RESET_MS - JEDA_PERMINTAAN_RESET_MS,
    ).toISOString();

    // Compare-and-swap di tingkat baris PostgreSQL. Request konkuren untuk
    // akun yang sama hanya satu yang dapat mengklaim token baru.
    const { data: klaim, error: errorKlaim } = await supabaseAdmin
      .from("pengurus_rt")
      .update({
        reset_token: tokenBaru.digest,
        reset_token_expires: tokenBaru.kedaluwarsa,
      })
      .eq("id", pengurus.id)
      .or(`reset_token_expires.is.null,reset_token_expires.lt.${batasKirimUlang}`)
      .select("id, nama_lengkap")
      .maybeSingle();

    if (errorKlaim) {
      console.error("Klaim token reset sandi gagal:", kodeErrorAman(errorKlaim));
      return;
    }
    // Cooldown aktif: tetap diam agar tidak menjadi oracle/rate-limit oracle.
    if (!klaim) return;

    const resetLink = buatTautanReset(baseUrl, tokenBaru.token);
    const namaMentah = typeof klaim.nama_lengkap === "string" ? klaim.nama_lengkap : "Pengurus";
    const namaAman = escapeHtml(namaMentah);
    const linkAman = escapeHtml(resetLink);
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: emailPengirim, pass: sandiPengirim },
    });

    try {
      await transporter.sendMail({
        from: `\"Pusat Komando RT 07\" <${emailPengirim}>`,
        to: email,
        subject: "Otorisasi ulang: reset sandi admin",
        text: `Halo ${namaMentah},\n\nBuka tautan berikut untuk membuat sandi baru (berlaku 1 jam dan hanya dapat digunakan sekali):\n${resetLink}\n\nJika Anda tidak meminta reset, abaikan email ini.`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
            <div style="background:#0f172a;padding:20px;text-align:center;color:#fff"><h2 style="margin:0;letter-spacing:2px">PUSAT KOMANDO RT 07</h2></div>
            <div style="padding:30px;background:#f8fafc;color:#334155">
              <p>Halo <b>${namaAman}</b>,</p>
              <p>Permintaan reset sandi admin diterima. Tautan di bawah berlaku satu jam dan hanya dapat digunakan sekali.</p>
              <p style="text-align:center;margin:30px 0"><a href="${linkAman}" style="background:#059669;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block">BUAT SANDI BARU</a></p>
              <p style="font-size:12px;color:#64748b;text-align:center">Jika Anda tidak merasa meminta reset, abaikan email ini.</p>
            </div>
          </div>
        `,
      });
    } catch (error: unknown) {
      console.error("Pengiriman email reset sandi gagal:", kodeErrorAman(error));

      // Invalidasi hanya bila token masih milik request ini. Jangan memulihkan
      // token lama: pada database lama nilainya mungkin plaintext/bocor, dan
      // pemulihan dapat menghidupkan kembali bearer credential usang.
      await supabaseAdmin
        .from("pengurus_rt")
        .update({
          reset_token: null,
          reset_token_expires: null,
        })
        .eq("id", pengurus.id)
        .eq("reset_token", tokenBaru.digest);
    }
  } catch (error: unknown) {
    console.error("Reset sandi tidak dapat diproses:", kodeErrorAman(error));
  }
}

export default function LupaSandiPage() {
  async function kirimEmailReset(emailInput: unknown): Promise<HasilReset> {
    "use server";

    const email = normalisasiEmailReset(emailInput);
    if (email) {
      // Server Action mengembalikan hasil generik segera; proses SMTP tidak
      // membocorkan keberadaan akun maupun err.message ke klien.
      after(() => prosesPermintaanReset(email));
    }

    return { success: true, message: PESAN_PUBLIK_RESET };
  }

  return <LupaSandiClient aksiKirim={kirimEmailReset} />;
}
