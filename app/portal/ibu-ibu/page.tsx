import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import KerangkaIbuIbu from "@/components/ibu-ibu/KerangkaIbuIbu";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const MODUL = [
  {
    href: "/portal/ibu-ibu/lansia",
    judul: "Posyandu Lansia",
    deskripsi: "Catatan tekanan darah, gula darah, dan kunjungan kesehatan lansia.",
    ikon: "👵",
    aksen: "bg-violet-50 text-violet-700 border-violet-100",
    statKey: "lansia" as const,
    statLabel: "kunjungan tercatat",
  },
  {
    href: "/portal/ibu-ibu/balita",
    judul: "Posyandu Balita",
    deskripsi: "Pencatatan berat, tinggi, dan imunisasi anak.",
    ikon: "👶",
    aksen: "bg-sky-50 text-sky-700 border-sky-100",
    statKey: "balita" as const,
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
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;
  if (!token) redirect("/login");
  try {
    await jwtVerify(token, JWT_SECRET);
  } catch {
    redirect("/login");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const [{ count: totalLansia }, { count: totalBalita }, { count: totalArisan }, { data: arisanAktif }] = await Promise.all([
    supabase.from("posyandu_lansia").select("id", { count: "exact", head: true }),
    supabase.from("posyandu_balita").select("id", { count: "exact", head: true }),
    supabase.from("arisan_ibu").select("id", { count: "exact", head: true }),
    supabase.from("arisan_ibu").select("setoran_terakhir, pinjaman_berjalan"),
  ]);

  const totalDanaTerkumpul = (arisanAktif || []).reduce((sum, a) => sum + Number(a.setoran_terakhir || 0), 0);
  const statistik: Record<string, number> = {
    lansia: totalLansia || 0,
    balita: totalBalita || 0,
    arisan: totalArisan || 0,
  };

  return (
    <KerangkaIbuIbu
      judul="Pusat kegiatan Ibu-ibu RT"
      deskripsi="Pilih sub-modul Posyandu Lansia, Posyandu Balita, atau manajemen pendaftaran simpan-pinjam arisan."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Kunjungan Lansia</p>
          <p className="text-2xl font-black text-violet-700">{statistik.lansia}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Kunjungan Balita</p>
          <p className="text-2xl font-black text-sky-700">{statistik.balita}</p>
        </div>
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
          <Link
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
          </Link>
        ))}
      </div>
    </KerangkaIbuIbu>
  );
}
