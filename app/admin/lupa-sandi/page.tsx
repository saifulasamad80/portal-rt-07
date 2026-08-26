import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import crypto from "crypto";
import nodemailer from "nodemailer";
import LupaSandiClient from "./LupaSandiClient";

export default async function LupaSandiPage() {
  
  async function kirimEmailReset(email: string) {
    "use server";
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // 1. Cek eksistensi email pengurus
    const { data: pengurus } = await supabaseAdmin.from("pengurus_rt").select("id, nama_lengkap").eq("email", email).single();
    if (!pengurus) return { success: false, message: "Akses Ditolak: Email tidak terdaftar dalam sistem Pusat Komando." };

    // 2. Ciptakan Kunci Enkripsi 32-Byte (Token Reset)
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000).toISOString(); // Masa aktif 1 Jam

    // 3. Kunci token ke dalam brankas database
    await supabaseAdmin.from("pengurus_rt").update({ reset_token: token, reset_token_expires: expires }).eq("id", pengurus.id);

    // 4. Deteksi otomatis URL / Domain aktif saat ini
    const headerList = await headers();
    const host = headerList.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const resetLink = `${protocol}://${host}/admin/reset-sandi?token=${token}`;

    // 5. Eksekusi pengiriman email via Gmail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    try {
      await transporter.sendMail({
        from: `"Pusat Komando RT 07" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "🚨 Otorisasi Ulang: Reset Password Admin RT 07",
        html: `
          <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #0f172a; padding: 20px; text-align: center; color: white;">
              <h2 style="margin: 0; letter-spacing: 2px;">PUSAT KOMANDO RT 07</h2>
            </div>
            <div style="padding: 30px; background-color: #f8fafc; color: #334155;">
              <p>Halo <b>${pengurus.nama_lengkap}</b>,</p>
              <p>Sistem mendeteksi permintaan reset password untuk akun admin Anda. Klik tombol darurat di bawah ini untuk merakit ulang kunci akses Anda:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">RESET PASSWORD SEKARANG</a>
              </div>
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">Tautan ini dienkripsi dan akan hancur sendiri dalam waktu 1 Jam. Jika Anda tidak merasa meminta reset, abaikan email ini.</p>
            </div>
          </div>
        `
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, message: "Server email gagal mengirim pesan: " + err.message };
    }
  }

  return <LupaSandiClient aksiKirim={kirimEmailReset} />;
}