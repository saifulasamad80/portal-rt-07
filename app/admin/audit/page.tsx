import { redirect } from "next/navigation";
import AuditClient from "./AuditClient";
import { otentikasiAdminAktif } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";


export default async function AdminAuditPage() {
  const otentikasi = await otentikasiAdminAktif();
  if (!otentikasi.ok || otentikasi.sesi.role !== "webmaster") redirect("/admin");

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasi.sesi);

  const { data: logsRes } = await supabaseAdmin
    .from("audit_log")
    .select("id, created_at, aktor, aksi, tabel_target, detail, rt_id")
    .order("created_at", { ascending: false })
    .limit(100);

  return <AuditClient logs={logsRes || []} />;
}
