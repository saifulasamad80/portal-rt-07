import { redirect } from "next/navigation";
import KerangkaIbuIbu from "@/components/ibu-ibu/KerangkaIbuIbu";
import PosyanduBalitaPanel from "@/components/ibu-ibu/PosyanduBalitaPanel";
import { otentikasiWargaAktif } from "@/lib/session-security";
import { getSupabaseAdminClientDariSesi } from "@/lib/supabase-server";
import { ambilRumahTanggaPortal } from "@/lib/rumah-tangga-warga";
import { daftarKunjunganBalitaRumahTangga } from "@/lib/posyandu-kunjungan";

export default async function PosyanduBalitaPage() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");
  const rumah = await ambilRumahTanggaPortal(otentikasi.sesi);
  const data = await daftarKunjunganBalitaRumahTangga(
    getSupabaseAdminClientDariSesi(otentikasi.sesi),
    otentikasi.sesi.rtId,
    rumah.kepalaId,
  );

  return (
    <KerangkaIbuIbu
      judul="Posyandu balita rumah tangga"
      deskripsi="Catatan tumbuh kembang anak rumah tangga Anda. Bukan data tetangga. Pengurus hanya mencatat jika izin kesehatan dan wali anak sudah ada."
    >
      <PosyanduBalitaPanel data={data} />
    </KerangkaIbuIbu>
  );
}
