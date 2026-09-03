import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import KerangkaIbuIbu from "@/components/ibu-ibu/KerangkaIbuIbu";
import PosyanduLansiaPanel from "@/components/ibu-ibu/PosyanduLansiaPanel";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export default async function PosyanduLansiaPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;
  if (!token) redirect("/login");
  try {
    await jwtVerify(token, JWT_SECRET);
  } catch {
    redirect("/login");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase.from("posyandu_lansia").select("*").order("tanggal_kunjungan", { ascending: false }).limit(50);

  return (
    <KerangkaIbuIbu
      judul="Posyandu Lansia"
      deskripsi="Hasil pemeriksaan kesehatan lansia yang dicatat pengurus pada setiap kunjungan posyandu."
    >
      <PosyanduLansiaPanel data={data || []} />
    </KerangkaIbuIbu>
  );
}
