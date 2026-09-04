import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import KerangkaIbuIbu from "@/components/ibu-ibu/KerangkaIbuIbu";
import ArisanIbuPanel from "@/components/ibu-ibu/ArisanIbuPanel";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export default async function ArisanIbuPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;
  if (!token) redirect("/login");
  try {
    await jwtVerify(token, JWT_SECRET);
  } catch {
    redirect("/login");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const [{ data }, { data: transaksi }] = await Promise.all([
    supabase.from("arisan_ibu").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("arisan_transaksi").select("*, arisan_ibu(nama_anggota)").order("created_at", { ascending: false }).limit(15),
  ]);

  async function daftarArisan(nama: string, wa: string, catatan: string) {
    "use server";
    try {
      const store = await cookies();
      const sesi = store.get("warga_session")?.value;
      if (!sesi) return { success: false, message: "Sesi berakhir. Silakan masuk ulang." };
      const { payload } = await jwtVerify(sesi, JWT_SECRET);
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { error } = await db.from("arisan_ibu").insert([
        {
          nama_anggota: nama.trim(),
          no_whatsapp: wa.trim() || null,
          catatan: catatan.trim() || null,
          status_keanggotaan: "Menunggu",
          rt_id: (payload as any).rt_id || null,
        },
      ]);
      if (error) return { success: false, message: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || "Gagal menyimpan pendaftaran." };
    }
  }

  return (
    <KerangkaIbuIbu
      judul="Arisan Ibu-ibu RT"
      deskripsi="Pendaftaran anggota baru serta ringkasan setoran dan pinjaman berjalan."
    >
      <ArisanIbuPanel arisan={data || []} transaksi={transaksi || []} aksiDaftarArisan={daftarArisan} />
    </KerangkaIbuIbu>
  );
}
