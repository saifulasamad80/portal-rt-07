import { redirect } from "next/navigation";
import KerangkaIbuIbu from "@/components/ibu-ibu/KerangkaIbuIbu";
import PosyanduLansiaPanel from "@/components/ibu-ibu/PosyanduLansiaPanel";
import { otentikasiWargaAktif } from "@/lib/session-security";
import { getSupabaseAdminClientDariSesi } from "@/lib/supabase-server";
import { ambilRumahTanggaPortal } from "@/lib/rumah-tangga-warga";
import { daftarKunjunganLansiaRumahTangga } from "@/lib/posyandu-kunjungan";

export default async function PosyanduLansiaPage() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");
  const rumah = await ambilRumahTanggaPortal(otentikasi.sesi);
  const data = await daftarKunjunganLansiaRumahTangga(
    getSupabaseAdminClientDariSesi(otentikasi.sesi),
    otentikasi.sesi.rtId,
    rumah.kepalaId,
  );

  return (
    <KerangkaIbuIbu
      judul="Posyandu lansia rumah tangga"
      deskripsi="Catatan kunjungan posyandu lansia rumah tangga Anda. Bukan data tetangga. Pengurus hanya mencatat jika izin kesehatan sudah ada."
    >
      <PosyanduLansiaPanel
        data={data.map((row) => ({
          ...row,
          tekanan_darah: row.tensi_darah,
          gula_darah: row.gula_darah == null ? null : String(row.gula_darah),
        }))}
      />
    </KerangkaIbuIbu>
  );
}
