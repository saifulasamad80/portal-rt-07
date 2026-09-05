import { redirect } from "next/navigation";
import PengurusAdminClient from "./PengurusAdminClient";
import bcrypt from "bcryptjs";
import { otentikasiAdminAktif, wajibWebmaster } from "@/lib/session-security";
import { buatKlienTerautentikasi, getSupabaseAdminClientDariSesi } from "@/lib/supabase-server";
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminPengurusPage() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok || otentikasi.sesi.role !== "webmaster") redirect("/admin");

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);

  // OPTIMASI: Batasi tarikan data maksimal 100 baris untuk mencegah Memory Leak
  const { data: pengurusRes } = await supabaseAdmin
    .from("pengurus_rt")
    .select("id, nama_lengkap, jabatan, email, created_at")
    .order("created_at", { ascending: true })
    .limit(100); 

  async function tambahPengurus(nama: string, jabatan: string, email: string, pass: string) {
    "use server";
    const sesiAsli = await wajibWebmaster();
    const namaBersih = String(nama || "").trim().slice(0, 150);
    const jabatanBersih = String(jabatan || "").trim().slice(0, 100);
    const emailBersih = String(email || "").trim().toLowerCase().slice(0, 254);
    const sandi = String(pass || "");
    if (!namaBersih || !jabatanBersih || !/^\S+@\S+\.\S+$/.test(emailBersih) || sandi.length < 8 || sandi.length > 512) {
      return { success: false, message: "Data pengurus atau sandi tidak valid." };
    }

    const supabase = getSupabaseAdminClientDariSesi(sesiAsli);
    const hashedPassword = await bcrypt.hash(sandi, 12);
    const { data: idBaru, error } = await supabase.rpc("simpan_pengurus_rt", {
      p_aktor_id: sesiAsli.id,
      p_pengurus_id: null,
      p_nama: namaBersih,
      p_jabatan: jabatanBersih,
      p_email: emailBersih,
      p_password_hash: hashedPassword,
      p_rt_id: sesiAsli.rtId,
    });

    if (error) {
      console.error("RPC pengurus ditolak:", error.code || "database_error");
      if (error.code === "23505") return { success: false, message: "Email atau username pengurus sudah terpakai." };
      if (error.code === "42501") return { success: false, message: "Akses webmaster ditolak." };
      if (error.code === "22023") return { success: false, message: "Data pengurus atau sandi tidak valid." };
      return { success: false, message: "Akun pengurus belum dapat diterbitkan. Coba lagi nanti." };
    }
    if (!idBaru) return { success: false, message: "Akun pengurus belum dapat diterbitkan. Coba lagi nanti." };

    return { success: true };
  }

  async function hapusPengurus(idTarget: string) {
    "use server";
    const sesiAsli = await wajibWebmaster();
    const idBersih = String(idTarget || "").trim();
    if (!POLA_UUID.test(idBersih)) return { success: false, message: "ID pengurus tidak valid." };

    if (idBersih === sesiAsli.id) return { success: false, message: "Anda tidak dapat menghapus akun sendiri." };

    const supabase = await buatKlienTerautentikasi(sesiAsli);
    const { data: target } = await supabase.from("pengurus_rt").select("nama_lengkap").eq("id", idBersih).maybeSingle();
    if (!target) return { success: false, message: "Pengurus tidak ditemukan." };
    
    const { data: terhapus, error } = await supabase.from("pengurus_rt").delete().eq("id", idBersih).select("id").maybeSingle();
    if (error || !terhapus) return { success: false, message: "Akun pengurus gagal dihapus atau sudah berubah." };

    await supabase.from("audit_log").insert([{
      aktor: sesiAsli.nama, aksi: "Hapus Akun Pengurus", tabel_target: "pengurus_rt", detail: `Mencabut akses admin: ${target?.nama_lengkap}`, rt_id: sesiAsli.rtId
    }]);
    return { success: true };
  }

  async function resetSandiPengurus(idTarget: string, sandiBaru: string) {
    "use server";
    const sesiAsli = await wajibWebmaster();
    const idBersih = String(idTarget || "").trim();
    const sandi = String(sandiBaru || "");
    if (!POLA_UUID.test(idBersih) || sandi.length < 8 || sandi.length > 512) return { success: false, message: "ID atau sandi baru tidak valid." };

    const supabase = getSupabaseAdminClientDariSesi(sesiAsli);
    const hashedPassword = await bcrypt.hash(sandi, 12);

    const { error } = await supabase.rpc("simpan_pengurus_rt", {
      p_aktor_id: sesiAsli.id,
      p_pengurus_id: idBersih,
      p_nama: null,
      p_jabatan: null,
      p_email: null,
      p_password_hash: hashedPassword,
      p_rt_id: sesiAsli.rtId,
    });
    if (error) {
      console.error("RPC reset sandi pengurus ditolak:", error.code || "database_error");
      if (error.code === "40001") return { success: false, message: "Pengurus tidak ditemukan." };
      if (error.code === "42501") return { success: false, message: "Akses webmaster ditolak." };
      return { success: false, message: "Sandi pengurus gagal diubah." };
    }

    return { success: true };
  }

  return <PengurusAdminClient pengurusList={pengurusRes || []} aksiTambah={tambahPengurus} aksiHapus={hapusPengurus} aksiReset={resetSandiPengurus} />;
}
