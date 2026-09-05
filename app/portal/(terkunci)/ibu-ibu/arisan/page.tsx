import { redirect } from "next/navigation";
import KerangkaIbuIbu from "@/components/ibu-ibu/KerangkaIbuIbu";
import ArisanIbuPanel from "@/components/ibu-ibu/ArisanIbuPanel";
import { otentikasiWargaAktif, wajibOtentikasiWarga } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";

export default async function ArisanIbuPage() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");
  const wargaAktif = otentikasi.sesi;

  const supabase = await buatKlienTerautentikasi(wargaAktif);
  const { data } = await supabase
    .from("arisan_ibu")
    .select("id, nama_anggota, status_keanggotaan, setoran_terakhir, pinjaman_berjalan")
    .eq("rt_id", wargaAktif.rtId)
    .order("created_at", { ascending: false })
    .limit(100);
  const arisanIds = (data || []).map((row) => String(row.id)).filter(Boolean);
  const { data: transaksi } = arisanIds.length
    ? await supabase
        .from("arisan_transaksi")
        .select("id, jenis, nominal, created_at, arisan_ibu(nama_anggota)")
        .in("arisan_id", arisanIds)
        .order("created_at", { ascending: false })
        .limit(15)
    : { data: [] };

  // PostgREST returns a one-to-many relation as an array even when the UI
  // only needs the single related arisan label. Normalize it at the server
  // boundary so the client never has to guess the relation shape.
  const transaksiUntukKlien = (transaksi || []).map((row) => ({
    ...row,
    arisan_ibu: Array.isArray(row.arisan_ibu)
      ? row.arisan_ibu[0] || null
      : row.arisan_ibu || null,
  }));

  async function daftarArisan(nama: string, wa: string, catatan: string) {
    "use server";
    try {
      const sesi = await wajibOtentikasiWarga();
      const namaBersih = String(nama || "").trim().slice(0, 150);
      const waBersih = String(wa || "").replace(/[^\d+]/g, "").slice(0, 25);
      const catatanBersih = String(catatan || "").trim().slice(0, 1000);
      if (!namaBersih) return { success: false, message: "Nama lengkap wajib diisi." };

      const db = await buatKlienTerautentikasi(sesi);
      const { error } = await db.from("arisan_ibu").insert([
        {
          nama_anggota: namaBersih,
          no_whatsapp: waBersih || null,
          catatan: catatanBersih || null,
          status_keanggotaan: "Menunggu",
          rt_id: sesi.rtId,
        },
      ]);
      if (error) return { success: false, message: "Pendaftaran belum dapat disimpan." };
      return { success: true };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : "Gagal menyimpan pendaftaran." };
    }
  }

  return (
    <KerangkaIbuIbu
      judul="Arisan Ibu-ibu RT"
      deskripsi="Pendaftaran anggota baru serta ringkasan setoran dan pinjaman berjalan."
    >
      <ArisanIbuPanel arisan={data || []} transaksi={transaksiUntukKlien} aksiDaftarArisan={daftarArisan} />
    </KerangkaIbuIbu>
  );
}
