import { redirect } from "next/navigation";
import KerangkaIbuIbu from "@/components/ibu-ibu/KerangkaIbuIbu";
import TautanHalus from "@/components/TautanHalus";
import { otentikasiWargaAktif } from "@/lib/session-security";
import { buatKlienTerautentikasi, getSupabaseAdminClientDariSesi } from "@/lib/supabase-server";
import { ambilRumahTanggaPortal } from "@/lib/rumah-tangga-warga";
import {
  daftarKunjunganBalitaRumahTangga,
  daftarKunjunganLansiaRumahTangga,
} from "@/lib/posyandu-kunjungan";

const MODUL = [
  {
    href: "/portal/ibu-ibu/balita",
    judul: "Posyandu Balita",
    deskripsi: "Catatan tumbuh kembang anak rumah tangga Anda.",
    ikon: "👶",
    aksen: "bg-sky-50 text-sky-700 border-sky-100",
    statKey: "balita" as const,
    statLabel: "kunjungan tercatat",
  },
  {
    href: "/portal/ibu-ibu/lansia",
    judul: "Posyandu Lansia",
    deskripsi: "Catatan pemeriksaan lansia rumah tangga Anda.",
    ikon: "🧓",
    aksen: "bg-violet-50 text-violet-700 border-violet-100",
    statKey: "lansia" as const,
    statLabel: "kunjungan tercatat",
  },
  {
    href: "/portal/ibu-ibu/arisan",
    judul: "Arisan Ibu-ibu",
    deskripsi: "Pendaftaran anggota serta ringkasan simpan-pinjam.",
    ikon: "🤝",
    aksen: "bg-rose-50 text-rose-700 border-rose-100",
    statKey: "arisan" as const,
    statLabel: "anggota terdaftar",
  },
];

export default async function PortalIbuIbuPage() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");
  const wargaAktif = otentikasi.sesi;

  const supabase = await buatKlienTerautentikasi(wargaAktif);
  const rumah = await ambilRumahTanggaPortal(wargaAktif);
  const posyandu = getSupabaseAdminClientDariSesi(wargaAktif);

  const [{ count: totalArisan }, { data: arisanAktif }, balita, lansia] = await Promise.all([
    supabase.from("arisan_ibu").select("id", { count: "exact", head: true }).eq("rt_id", wargaAktif.rtId),
    supabase.from("arisan_ibu").select("setoran_terakhir, pinjaman_berjalan").eq("rt_id", wargaAktif.rtId).limit(500),
    daftarKunjunganBalitaRumahTangga(posyandu, wargaAktif.rtId, rumah.kepalaId),
    daftarKunjunganLansiaRumahTangga(posyandu, wargaAktif.rtId, rumah.kepalaId),
  ]);

  const totalDanaTerkumpul = (arisanAktif || []).reduce((sum, a) => sum + Number(a.setoran_terakhir || 0), 0);
  const statistik: Record<string, number> = {
    arisan: totalArisan || 0,
    balita: balita.length,
    lansia: lansia.length,
  };

  return (
    <KerangkaIbuIbu
      judul="Pusat kegiatan Ibu-ibu RT"
      deskripsi="Arisan ibu-ibu RT, plus catatan posyandu rumah tangga Anda sendiri — bukan milik tetangga."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Anggota Arisan</p>
          <p className="text-2xl font-black text-rose-700">{statistik.arisan}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Total Setoran</p>
          <p className="text-2xl font-black text-emerald-700">Rp {(totalDanaTerkumpul / 1000).toFixed(0)}k</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {MODUL.map((item) => (
          <TautanHalus
            key={item.href}
            href={item.href}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col"
          >
            <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-2xl mb-4 ${item.aksen}`}>
              {item.ikon}
            </div>
            <h2 className="font-bold text-slate-900">{item.judul}</h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed flex-1">{item.deskripsi}</p>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                {statistik[item.statKey]} {item.statLabel}
              </span>
              <span className="text-xs font-bold text-blue-700">Buka &rarr;</span>
            </div>
          </TautanHalus>
        ))}
      </div>
    </KerangkaIbuIbu>
  );
}
