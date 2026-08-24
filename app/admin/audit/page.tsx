import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import AuditClient from "./AuditClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function AdminAuditPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) redirect("/admin");

  try {
    // Validasi JWT untuk memastikan ini benar-benar admin
    await jwtVerify(token, JWT_SECRET);
  } catch (error) {
    redirect("/admin");
  }

  // Gunakan Service Role untuk menembus RLS agar log audit selalu terbaca penuh
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: logsRes } = await supabaseAdmin
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return <AuditClient logs={logsRes || []} />;
}