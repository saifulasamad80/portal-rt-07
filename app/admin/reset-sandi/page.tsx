import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import ResetSandiClient from "./ResetSandiClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function ResetSandiPage({ searchParams }: { searchParams: { token?: string } }) {
  // Peringatan strict dari Next.js 15: searchParams harus di-await jika ada async operations
  const params = await searchParams;
  const token = params.token;
  
  if (!token) redirect("/admin");

  async function ubahPassword(passwordBaru: string) {
    "use server";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // 1. Validasi Token Anti-Hacker
    const { data: pengurus } = await supabase.from("pengurus_rt").select("id, reset_token_expires").eq("reset_token", token).single();
    if (!pengurus) return { success: false, message: "Token tidak valid atau sudah digunakan." };
    
    // 2. Cek apakah waktu sudah lewat 1 Jam
    if (new Date(pengurus.reset_token_expires) < new Date()) {
      return { success: false, message: "Token kedaluwarsa. Silakan minta link reset baru." };
    }

    // 3. Timpa Password & Hanguskan Token agar tidak bisa dipakai 2x
    const { error } = await supabase.from("pengurus_rt")
      .update({ password: passwordBaru, reset_token: null, reset_token_expires: null })
      .eq("id", pengurus.id);

    if (error) return { success: false, message: "Gagal menyimpan password: " + error.message };

    // 4. Catat ke Audit Log
    await supabase.from("audit_log").insert([{
      aktor: "SISTEM OTOMATIS", aksi: "Reset Password Berhasil", tabel_target: "pengurus_rt", detail: `Pemulihan akun admin ID: ${pengurus.id}`
    }]);

    return { success: true };
  }

  return <ResetSandiClient aksiReset={ubahPassword} />;
}