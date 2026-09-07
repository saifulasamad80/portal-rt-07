import Link from "next/link";
import { redirect } from "next/navigation";
import {
  JUDUL_PERMOHONAN_PERUBAHAN_KELUARGA,
  STATUS_TIKET_TERBUKA,
  adalahCapCarikDisetujui,
  samarkanNik,
} from "@/lib/kebijakan-sensus";
import { otentikasiWargaAktif } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";
import PermohonanKeluargaClient from "./PermohonanKeluargaClient";

type AnggotaTerbaca = {
  id: string;
  nik: string | null;
  rt_id?: unknown;
  nama_lengkap: string | null;
  hubungan_keluarga: string | null;
  hubungan_detail: string | null;
  tanggal_lahir: string | null;
  tempat_lahir: string | null;
  jenis_kelamin: string | null;
  agama: string | null;
  pekerjaan: string | null;
};

function formatTanggalLokal(nilai: string | null | undefined) {
  const isi = String(nilai || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isi)) return "—";
  const [tahun, bulan, hari] = isi.split("-").map(Number);
  return new Date(tahun, bulan - 1, hari).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function teksAtauStrip(nilai: unknown) {
  const isi = String(nilai ?? "").trim();
  return isi && isi !== "-" ? isi : "—";
}

function labelHubungan(hubungan: string | null, detail: string | null) {
  const utama = teksAtauStrip(hubungan);
  if (utama === "Lainnya" && String(detail || "").trim()) {
    return String(detail).trim();
  }
  return utama;
}

function BarisData({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-800">{nilai}</p>
    </div>
  );
}

export default async function HalamanKeluarga() {
  const otentikasi = await otentikasiWargaAktif();
  if (!otentikasi.ok) redirect("/login");

  const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
  const [{ data: profilWarga, error: errProfil }, { data: tiketRes }, { data: capCarik }] = await Promise.all([
    supabase
      .from("warga")
      .select(`
        id,
        nik,
        nama_lengkap,
        tempat_lahir,
        tanggal_lahir,
        jenis_kelamin,
        agama,
        pekerjaan,
        no_whatsapp,
        status_tinggal,
        detail_alamat,
        pendapatan_bulanan,
        daya_listrik,
        anggota_keluarga (
          id,
          nik,
          rt_id,
          nama_lengkap,
          hubungan_keluarga,
          hubungan_detail,
          tanggal_lahir,
          tempat_lahir,
          jenis_kelamin,
          agama,
          pekerjaan
        )
      `)
      .eq("id", otentikasi.sesi.id)
      .eq("nik", otentikasi.sesi.nik)
      .eq("rt_id", otentikasi.sesi.rtId)
      .maybeSingle(),
    supabase
      .from("laporan_warga")
      .select("id, status, deskripsi, tanggapan_rt, created_at")
      .eq("warga_id", otentikasi.sesi.id)
      .eq("rt_id", otentikasi.sesi.rtId)
      .eq("judul_laporan", JUDUL_PERMOHONAN_PERUBAHAN_KELUARGA)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("sensus_kesejahteraan")
      .select("id, status_validasi")
      .eq("warga_id", otentikasi.sesi.id)
      .eq("rt_id", otentikasi.sesi.rtId)
      .maybeSingle(),
  ]);

  if (!adalahCapCarikDisetujui(capCarik?.status_validasi)) redirect("/portal/sensus");

  if (errProfil) console.error("Profil keluarga gagal dimuat:", errProfil.message);
  if (errProfil || !profilWarga) redirect("/login");

  const anggotaTerbaca = Array.isArray(profilWarga.anggota_keluarga)
    ? (profilWarga.anggota_keluarga as AnggotaTerbaca[])
    : [];
  if (anggotaTerbaca.some((anggota) => String(anggota.rt_id || "") !== otentikasi.sesi.rtId)) {
    console.error("Profil keluarga memiliki anggota lintas tenant atau tanpa rt_id:", otentikasi.sesi.id);
    redirect("/login");
  }

  const anggotaTampil = anggotaTerbaca.map((anggota) => ({
    id: anggota.id,
    nama_lengkap: teksAtauStrip(anggota.nama_lengkap),
    hubungan: labelHubungan(anggota.hubungan_keluarga, anggota.hubungan_detail),
    nikTampil: samarkanNik(anggota.nik),
    tanggal_lahir: formatTanggalLokal(anggota.tanggal_lahir),
    tempat_lahir: teksAtauStrip(anggota.tempat_lahir),
    jenis_kelamin: teksAtauStrip(anggota.jenis_kelamin),
    agama: teksAtauStrip(anggota.agama),
    pekerjaan: teksAtauStrip(anggota.pekerjaan),
  }));

  const riwayat = (tiketRes || []).map((tiket) => ({
    id: String(tiket.id),
    status: (tiket.status as string | null) ?? "Menunggu",
    deskripsi: (tiket.deskripsi as string | null) ?? "",
    tanggapan_rt: (tiket.tanggapan_rt as string | null) ?? null,
    created_at: (tiket.created_at as string | null) ?? null,
  }));
  const tiketTerbuka = riwayat.some((tiket) =>
    STATUS_TIKET_TERBUKA.includes(tiket.status as (typeof STATUS_TIKET_TERBUKA)[number])
  );
  const jumlahJiwa = 1 + anggotaTampil.length;

  async function aksiAjukanPerubahan(alasanMentah: string) {
    "use server";
    try {
      const sesiAktif = await otentikasiWargaAktif();
      if (!sesiAktif.ok) return { success: false, message: sesiAktif.message };

      const alasan = String(alasanMentah || "").trim().slice(0, 1000);
      if (alasan.length < 10) {
        return { success: false, message: "Uraikan perubahan yang diminta (minimal 10 karakter)." };
      }

      const klien = await buatKlienTerautentikasi(sesiAktif.sesi);
      const { data: carik, error: errCarik } = await klien
        .from("sensus_kesejahteraan")
        .select("id")
        .eq("warga_id", sesiAktif.sesi.id)
        .eq("rt_id", sesiAktif.sesi.rtId)
        .eq("status_validasi", "Disetujui")
        .maybeSingle();
      if (errCarik || !carik) {
        return { success: false, message: "Data keluarga belum diverifikasi. Lengkapi verifikasi Carik terlebih dahulu." };
      }

      const { data: tiketAda, error: errTiket } = await klien
        .from("laporan_warga")
        .select("id")
        .eq("warga_id", sesiAktif.sesi.id)
        .eq("rt_id", sesiAktif.sesi.rtId)
        .eq("judul_laporan", JUDUL_PERMOHONAN_PERUBAHAN_KELUARGA)
        .in("status", [...STATUS_TIKET_TERBUKA])
        .limit(1)
        .maybeSingle();
      if (errTiket) {
        console.error("Pemeriksaan tiket perubahan keluarga gagal:", errTiket.message);
        return { success: false, message: "Permohonan belum dapat diperiksa. Coba lagi nanti." };
      }
      if (tiketAda) {
        return {
          success: false,
          message: "Permohonan sebelumnya masih menunggu atau sedang diproses pengurus.",
        };
      }

      const { data: tersimpan, error } = await klien
        .from("laporan_warga")
        .insert([
          {
            warga_id: sesiAktif.sesi.id,
            rt_id: sesiAktif.sesi.rtId,
            judul_laporan: JUDUL_PERMOHONAN_PERUBAHAN_KELUARGA,
            deskripsi: alasan,
            status: "Menunggu",
          },
        ])
        .select("id")
        .maybeSingle();

      if (error || !tersimpan) {
        console.error("Permohonan perubahan keluarga gagal:", error?.message);
        return { success: false, message: "Permohonan belum dapat dikirim. Coba lagi nanti." };
      }

      return {
        success: true,
        message: "Permohonan terkirim. Pengurus RT akan meninjau data keluarga Anda.",
      };
    } catch (err: unknown) {
      console.error("Server Action permohonan keluarga gagal:", err instanceof Error ? err.name : "unknown");
      return { success: false, message: "Permohonan belum dapat dikirim. Coba lagi nanti." };
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-800">
      <header className="bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-8 pb-10">
          <Link href="/portal" className="text-[11px] font-semibold text-blue-300 hover:text-white">
            ← Kembali ke dasbor
          </Link>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300 mt-4 mb-2">
            Data keluarga · Terverifikasi
          </p>
          <h1 className="text-2xl md:text-3xl font-bold leading-tight">KK yang tercatat di RT</h1>
          <p className="text-sm text-slate-300 mt-3 leading-relaxed max-w-2xl">
            Halaman ini hanya untuk melihat. NIK terkunci. Perubahan nama, alamat, atau anggota keluarga
            diajukan ke pengurus RT.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 md:px-6 -mt-5 space-y-4">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Kepala keluarga</h2>
              <p className="text-[13px] text-slate-500 mt-0.5">{jumlahJiwa} jiwa dalam KK</p>
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">
              NIK terkunci
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1">NIK</p>
              <p className="font-mono text-lg font-semibold tracking-wide text-slate-900">{profilWarga.nik}</p>
              <p className="text-sm text-slate-600 mt-1">{teksAtauStrip(profilWarga.nama_lengkap)}</p>
            </div>
            <BarisData label="Tempat lahir" nilai={teksAtauStrip(profilWarga.tempat_lahir)} />
            <BarisData label="Tanggal lahir" nilai={formatTanggalLokal(profilWarga.tanggal_lahir)} />
            <BarisData label="Jenis kelamin" nilai={teksAtauStrip(profilWarga.jenis_kelamin)} />
            <BarisData label="Agama" nilai={teksAtauStrip(profilWarga.agama)} />
            <BarisData label="Pekerjaan" nilai={teksAtauStrip(profilWarga.pekerjaan)} />
            <BarisData label="WhatsApp" nilai={teksAtauStrip(profilWarga.no_whatsapp)} />
            <BarisData label="Status tinggal" nilai={teksAtauStrip(profilWarga.status_tinggal)} />
            <BarisData label="Alamat" nilai={teksAtauStrip(profilWarga.detail_alamat)} />
            <BarisData label="Pendapatan bulanan" nilai={teksAtauStrip(profilWarga.pendapatan_bulanan)} />
            <BarisData label="Daya listrik" nilai={teksAtauStrip(profilWarga.daya_listrik)} />
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Anggota keluarga</h2>
          {anggotaTampil.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada anggota keluarga tercatat selain kepala keluarga.</p>
          ) : (
            anggotaTampil.map((anggota) => (
              <article key={anggota.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-slate-900">{anggota.nama_lengkap}</p>
                    <p className="text-[13px] text-slate-500">{anggota.hubungan}</p>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">
                    {anggota.nikTampil}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <BarisData label="Tempat lahir" nilai={anggota.tempat_lahir} />
                  <BarisData label="Tanggal lahir" nilai={anggota.tanggal_lahir} />
                  <BarisData label="Jenis kelamin" nilai={anggota.jenis_kelamin} />
                  <BarisData label="Agama" nilai={anggota.agama} />
                  <BarisData label="Pekerjaan" nilai={anggota.pekerjaan} />
                </div>
              </article>
            ))
          )}
        </section>

        <PermohonanKeluargaClient
          riwayat={riwayat}
          tiketTerbuka={tiketTerbuka}
          aksiAjukan={aksiAjukanPerubahan}
        />
      </div>
    </div>
  );
}
