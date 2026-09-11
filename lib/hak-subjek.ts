import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  JUDUL_PERMINTAAN_HAPUS_DATA,
  VERSI_KEBIJAKAN_PRIVASI,
} from "@/lib/kebijakan-privasi";
import { samarkanNik, STATUS_TIKET_TERBUKA } from "@/lib/kebijakan-sensus";
import { kirimNotifikasiKePengurus } from "@/lib/notifikasi-push";
import { terapkanPenarikanIzin } from "@/lib/persetujuan-data";
import { ambilProfilKartuKkRumahTangga, type IdentitasRumahTangga } from "@/lib/rumah-tangga-warga";
import { POLA_UUID } from "@/lib/uuid-tenant";

type HasilHak = { success: boolean; message: string; berkas?: { nama: string; isi: string } };

function teks(nilai: unknown) {
  return String(nilai ?? "").trim();
}

export async function buatSalinanRumahTangga(
  supabase: SupabaseClient,
  sesi: IdentitasRumahTangga
): Promise<HasilHak> {
  const kartu = await ambilProfilKartuKkRumahTangga(sesi);
  if (kartu.error || !kartu.profil) {
    return { success: false, message: "Salinan rumah tangga belum dapat disusun." };
  }
  if (kartu.rumah.adalahTanggungan) {
    return { success: false, message: "Salinan rumah tangga diunduh kepala keluarga." };
  }

  const profil = kartu.profil as Record<string, unknown>;
  const anggotaMentah = Array.isArray(profil.anggota_keluarga) ? profil.anggota_keluarga : [];
  const salinan = {
    versi_naskah: VERSI_KEBIJAKAN_PRIVASI,
    dicatat_pada: new Date().toISOString(),
    kepala: {
      nama_lengkap: teks(profil.nama_lengkap),
      nik: teks(profil.nik),
      no_kk: teks(profil.no_kk),
      tempat_lahir: teks(profil.tempat_lahir),
      tanggal_lahir: teks(profil.tanggal_lahir),
      jenis_kelamin: teks(profil.jenis_kelamin),
      agama: teks(profil.agama),
      pekerjaan: teks(profil.pekerjaan),
      pendidikan: teks(profil.pendidikan),
      no_whatsapp: teks(profil.no_whatsapp),
      status_tinggal: teks(profil.status_tinggal),
      detail_alamat: teks(profil.detail_alamat),
      pendapatan_bulanan: teks(profil.pendapatan_bulanan) || null,
      daya_listrik: teks(profil.daya_listrik) || null,
    },
    anggota: anggotaMentah.map((baris) => {
      const item = (baris || {}) as Record<string, unknown>;
      return {
        nama_lengkap: teks(item.nama_lengkap),
        nik: teks(item.nik),
        hubungan_keluarga: teks(item.hubungan_keluarga),
        tanggal_lahir: teks(item.tanggal_lahir),
        tempat_lahir: teks(item.tempat_lahir),
        jenis_kelamin: teks(item.jenis_kelamin),
        agama: teks(item.agama),
        pekerjaan: teks(item.pekerjaan),
        pendidikan: teks(item.pendidikan),
      };
    }),
  };

  const { error } = await supabase.from("audit_log").insert([{
    aktor: "Portal warga",
    aksi: "Unduh salinan data rumah tangga",
    tabel_target: "warga",
    detail: `warga_id=${sesi.id}; jiwa=${1 + salinan.anggota.length}`,
    rt_id: sesi.rtId,
  }]);
  if (error) {
    console.error("Jejak unduh salinan gagal:", error.message);
    return { success: false, message: "Salinan belum dapat dicatat." };
  }

  return {
    success: true,
    message: "Salinan rumah tangga siap diunduh.",
    berkas: {
      nama: `salinan-rumah-tangga-${sesi.id.slice(0, 8)}.json`,
      isi: JSON.stringify(salinan, null, 2),
    },
  };
}

export async function tarikIzinPortal(
  supabase: SupabaseClient,
  sesi: IdentitasRumahTangga,
  payload: unknown,
  adalahTanggungan: boolean
): Promise<HasilHak> {
  if (adalahTanggungan) {
    return { success: false, message: "Penarikan izin diisi kepala keluarga." };
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "Permintaan penarikan tidak valid." };
  }
  const sumber = payload as Record<string, unknown>;
  return terapkanPenarikanIzin(supabase, {
    wargaId: sesi.id,
    rtId: sesi.rtId,
    tarikKeuangan: sumber.tarik_keuangan === true,
    tarikKesehatan: sumber.tarik_kesehatan === true,
    aktor: "Portal warga",
  }).then((hasil) =>
    hasil.ok ? { success: true, message: hasil.message } : { success: false, message: hasil.message }
  );
}

export async function ajukanHapusAkunPortal(
  supabase: SupabaseClient,
  sesi: IdentitasRumahTangga,
  adalahTanggungan: boolean
): Promise<HasilHak> {
  if (adalahTanggungan) {
    return { success: false, message: "Penghapusan akun diajukan kepala keluarga." };
  }
  if (!POLA_UUID.test(sesi.id) || !POLA_UUID.test(sesi.rtId)) {
    return { success: false, message: "Identitas sesi tidak valid." };
  }

  const { data: tiketAda, error: errAda } = await supabase
    .from("laporan_warga")
    .select("id")
    .eq("warga_id", sesi.id)
    .eq("rt_id", sesi.rtId)
    .eq("judul_laporan", JUDUL_PERMINTAAN_HAPUS_DATA)
    .in("status", [...STATUS_TIKET_TERBUKA])
    .limit(1)
    .maybeSingle();
  if (errAda) return { success: false, message: "Status permintaan hapus belum dapat dicek." };
  if (tiketAda?.id) {
    return { success: false, message: "Permintaan penghapusan sudah masuk antrean pengurus." };
  }

  const { error } = await supabase.from("laporan_warga").insert([{
    warga_id: sesi.id,
    rt_id: sesi.rtId,
    judul_laporan: JUDUL_PERMINTAAN_HAPUS_DATA,
    deskripsi:
      "Kepala keluarga menarik data operasional dari portal. Proses lewat kotak sampah 30 hari. Jangan tulis NIK di tanggapan publik.",
    status: "Menunggu",
  }]);
  if (error) {
    console.error("Tiket hapus data gagal:", error.message);
    return { success: false, message: "Permintaan hapus belum dapat dikirim." };
  }

  await supabase.from("audit_log").insert([{
    aktor: "Portal warga",
    aksi: "Ajukan hapus data pribadi",
    tabel_target: "laporan_warga",
    detail: `warga_id=${sesi.id}; nik=${samarkanNik(sesi.nik)}`,
    rt_id: sesi.rtId,
  }]);

  try {
    await kirimNotifikasiKePengurus(
      {
        title: "Permintaan hapus data",
        body: "Ada warga mengajukan penghapusan data pribadi. Buka menu Lapor.",
        url: "/admin/lapor",
        tag: "pdp-hapus-data",
      },
      { rtId: sesi.rtId }
    );
  } catch (pushErr) {
    console.error("Tiket hapus tercatat, namun notifikasi pengurus gagal:", pushErr);
  }

  return {
    success: true,
    message: "Permintaan hapus tercatat. Pengurus akan memproses; data operasional masuk kotak sampah 30 hari.",
  };
}
