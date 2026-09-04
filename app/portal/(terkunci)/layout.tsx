import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { getSupabaseAdminClient } from "@/lib/supabase-server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production"
);

/**
 * Layanan portal selain /portal/sensus hanya dibuka setelah data carik
 * warisan dikonfirmasi. Route group ini tidak membungkus halaman sensus.
 */
export default async function LayoutLayananTerkunci({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;
  if (!token) redirect("/login");

  let wargaId = "";
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    wargaId = String(payload.id || "");
  } catch {
    redirect("/login");
  }

  if (wargaId) {
    const supabase = getSupabaseAdminClient();
    const { data: carik } = await supabase
      .from("sensus_kesejahteraan")
      .select("id")
      .eq("warga_id", wargaId)
      .maybeSingle();

    if (!carik) redirect("/portal/sensus");
  }

  return children;
}
