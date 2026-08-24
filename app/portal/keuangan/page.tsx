import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

export default async function KeuanganWarga() {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;

  if (!token) redirect("/login");

  let wargaAktif: any;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    wargaAktif = payload;
  } catch (error) {
    redirect("/login");
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: riwayatPribadi } = await supabaseAdmin
    .from("kas_rt")
    .select("*")
    .eq("warga_id", wargaAktif.id)
    .order("created_at", { ascending: false });

  const riwayat = riwayatPribadi || [];
  const totalPartisipasi = riwayat.reduce((sum, t) => sum + t.nominal, 0);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/portal" className="text-blue-600 font-bold hover:underline mb-4 inline-block">&larr; Kembali ke Dasbor</Link>
        
        {/* REVISI UX: Hapus border-t-8 raksasa, ganti shadow elegan */}
        <div className="bg-white p-8 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-slate-500 text-sm font-bold uppercase tracking-wide mb-1">Total Partisipasi Anda</h2>
            <div className="text-5xl font-black text-slate-800 mb-2 tabular-nums">
              Rp {totalPartisipasi.toLocaleString("id-ID")}
            </div>
            <p className="text-sm text-slate-500">Akumulasi iuran Anda yang telah disetorkan dan divalidasi oleh pengurus RT.</p>
          </div>
          <div className="text-6xl opacity-20 hidden md:block">💰</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-200">
          <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-slate-200 pb-3">Riwayat Iuran Anda</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-900 border-b border-slate-200">
                  <th className="p-3 font-semibold">Tanggal Validasi</th>
                  <th className="p-3 font-semibold">Kategori & Keterangan</th>
                  <th className="p-3 font-semibold text-right">Nominal Tercatat</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.length === 0 ? (
                  <tr><td colSpan={3} className="p-4 text-center text-slate-400 font-bold italic">Belum ada riwayat iuran.</td></tr>
                ) : (
                  riwayat.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-600">{new Date(t.created_at).toLocaleDateString('id-ID')}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{t.kategori}</div>
                        <div className="text-slate-500 text-xs mt-0.5">{t.keterangan}</div>
                      </td>
                      {/* REVISI UX: Penambahan 'tabular-nums' agar digit lurus sempurna */}
                      <td className="p-3 text-right font-bold text-slate-800 tabular-nums">Rp {t.nominal.toLocaleString('id-ID')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}