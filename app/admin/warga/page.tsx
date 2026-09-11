import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import WargaAdminClient from "./WargaAdminClient";
import bcrypt from "bcryptjs";
import { prosesHapusAtauArsipWarga } from "@/lib/arsip-warga";
import {
  buatKlienTerautentikasi,
  getSupabaseAdminClientDariSesi,
} from "@/lib/supabase-server";
import {
  otentikasiAdminAktif as otentikasiAdmin,
  otorisasiWargaUntukAdmin,
  saringWargaTerotorisasi,
  wilayahMutasiWarga,
} from "@/lib/session-security";
import { prosesValidasiAkunWarga } from "@/lib/validasi-akun-warga";
import { POLA_UUID } from "@/lib/uuid-tenant";
import { siapkanBukuIndukWarga } from "@/lib/cari-jiwa-warga";
import {
  ISI_PENGUMUMAN_PDP,
  JUDUL_PENGUMUMAN_PDP,
  PESAN_IMPOR_CSV_DITOLAK,
} from "@/lib/kebijakan-privasi";
import { hitungInventoriPdp, kosongkanDataSpesifikLewatTenggat, catatJejakEksporBukuInduk } from "@/lib/persetujuan-data";

function validasiIdWarga(id: unknown): { ok: true; id: string } | { ok: false; message: string } {
  const bersih = String(id ?? "").trim();
  if (!bersih) return { ok: false, message: "ID warga wajib diisi." };
  if (!POLA_UUID.test(bersih)) return { ok: false, message: "ID warga tidak valid." };
  return { ok: true, id: bersih };
}

export default async function WargaAdminPage() {
  const otentikasiHalaman = await otentikasiAdmin();
  if (!otentikasiHalaman.ok) redirect("/admin");

  const supabaseAdmin = await buatKlienTerautentikasi(otentikasiHalaman.sesi);
  const rtIdSesi = otentikasiHalaman.sesi.rtId;

  // Jiwa tanggungan diambil kueri terpisah. Embed nested PostgREST sering
  // pulang kosong di bawah RLS pengurus, sehingga cari "Giyanti" seolah
  // tidak ada padahal istri itu tercatat di kartu KK.
  const [{ data: wargaRes, error: errWarga }, { data: anggotaRes, error: errAnggota }, inventoriPdp] = await Promise.all([
    supabaseAdmin
      .from("warga")
      .select(`
        id,
        nik,
        nama_lengkap,
        no_whatsapp,
        status_tinggal,
        detail_alamat,
        no_kk,
        pendidikan,
        hubungan_kk,
        status_verifikasi,
        status_validasi,
        status_aktif,
        ktp_path,
        kk_path,
        created_at,
        rt_id
      `)
      .eq("status_validasi", "Disetujui")
      .neq("status_aktif", false)
      .eq("rt_id", rtIdSesi)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("anggota_keluarga")
      .select("id, nik, nama_lengkap, hubungan_keluarga, rt_id, warga_id")
      .eq("rt_id", rtIdSesi),
    hitungInventoriPdp(supabaseAdmin, rtIdSesi),
  ]);

  if (errWarga) console.error("Gagal memuat buku induk warga:", errWarga.message);
  if (errAnggota) console.error("Gagal memuat tanggungan buku induk:", errAnggota.message);

  const wargaListAman = siapkanBukuIndukWarga(
    Array.isArray(wargaRes) ? wargaRes : [],
    Array.isArray(anggotaRes) ? anggotaRes : [],
    rtIdSesi
  );

  async function hapusWarga(id: string) {
    "use server";
    // Alur utama: coba hapus permanen. Jika warga terikat constraint IMMUTABLE
    // tabel partisipasi_pemilihan, prosesHapusAtauArsipWarga otomatis
    // melakukan fallback soft-delete (nonaktifkan akun + lepas data personal)
    // tanpa menghapus baris indeks pemilih, demi menjaga integritas surat
    // suara e-voting. Fungsi tersebut selalu mengembalikan Result Object.
    try {
      const otentikasi = await otentikasiAdmin();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };

      const idWarga = validasiIdWarga(id);
      if (!idWarga.ok) return { success: false, message: idWarga.message };

      const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
      const target = await otorisasiWargaUntukAdmin(supabase, otentikasi.sesi, idWarga.id);
      if (!target.ok) return { success: false, message: target.message };

      const hasil = await prosesHapusAtauArsipWarga(
        getSupabaseAdminClientDariSesi(otentikasi.sesi),
        target.sesi.id,
        otentikasi.sesi.nama
      );
      if (hasil.success) revalidatePath("/");
      return hasil;
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal server saat menghapus.";
      return { success: false, message: pesan };
    }
  }

  async function ubahStatusWarga(id: string, status: string) {
    "use server";
    try {
      const otentikasi = await otentikasiAdmin();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };

      const idWarga = validasiIdWarga(id);
      if (!idWarga.ok) return { success: false, message: idWarga.message };

      const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
      const hasil = await prosesValidasiAkunWarga(
        supabase,
        otentikasi.sesi,
        idWarga.id,
        status,
        "Mengubah Status Verifikasi"
      );
      if (hasil.success) revalidatePath("/");
      return hasil;
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal server saat mengubah status.";
      return { success: false, message: pesan };
    }
  }

  async function importWargaMassal(dataWarga: unknown[]) {
    "use server";
    try {
      const otentikasi = await otentikasiAdmin();
      if (!otentikasi.ok) {
        return { success: false, message: otentikasi.message, hasil: { berhasil: 0, gagal: 0 } };
      }
      void dataWarga;
      const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
      const { error: errAudit } = await supabase.from("audit_log").insert([
        {
          aktor: otentikasi.sesi.nama,
          aksi: "Impor CSV NIK ditolak",
          tabel_target: "warga",
          detail: "Percobaan impor massal NIK ditolak karena tidak ada dasar dan pemberitahuan ke subjek.",
          rt_id: otentikasi.sesi.rtId,
        },
      ]);
      if (errAudit) console.error("Audit penolakan impor gagal dicatat:", errAudit.message);
      return { success: false, message: PESAN_IMPOR_CSV_DITOLAK, hasil: { berhasil: 0, gagal: 0 } };
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal server saat mengimpor.";
      return { success: false, message: pesan, hasil: { berhasil: 0, gagal: 0 } };
    }
  }

  async function resetPinWarga(idTarget: string, pinBaru: string) {
    "use server";
    try {
      const otentikasi = await otentikasiAdmin();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };

      const idWarga = validasiIdWarga(idTarget);
      if (!idWarga.ok) return { success: false, message: idWarga.message };

      const pinBersih = String(pinBaru ?? "").replace(/\D/g, "");
      if (pinBersih.length !== 6) {
        return { success: false, message: "PIN harus terdiri dari tepat 6 angka." };
      }

      const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
      const target = await otorisasiWargaUntukAdmin(supabase, otentikasi.sesi, idWarga.id);
      if (!target.ok) return { success: false, message: target.message };

      const wilayah = wilayahMutasiWarga(otentikasi.sesi, target.sesi.rtId);
      if (!wilayah.ok) return { success: false, message: wilayah.message };

      const privileged = getSupabaseAdminClientDariSesi(otentikasi.sesi);

      const hashedPin = await bcrypt.hash(pinBersih, 10);

      const { data: diperbarui, error } = await saringWargaTerotorisasi(
        privileged.from("warga").update({
          pin: hashedPin,
          percobaan_gagal: 0,
          terkunci_sampai: null,
        }),
        target.sesi,
        wilayah.rtIdSaring
      )
        .select("id")
        .maybeSingle();

      if (error) return { success: false, message: `Gagal mereset PIN: ${error.message}` };
      if (!diperbarui) return { success: false, message: "Data warga berubah; muat ulang halaman." };

      const { error: errAudit } = await privileged.from("audit_log").insert([
        {
          aktor: otentikasi.sesi.nama,
          aksi: "Reset PIN & Cabut Lockdown Warga",
          tabel_target: "warga",
          detail: `Mereset paksa PIN & membuka kunci akses milik: ${target.sesi.nama}`,
          rt_id: wilayah.rtIdTulis,
        },
      ]);
      if (errAudit) console.error("Audit log reset PIN gagal dicatat:", errAudit.message);

      return { success: true, message: `PIN ${target.sesi.nama} berhasil direset.` };
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal server saat mereset PIN.";
      return { success: false, message: pesan };
    }
  }

  async function siarkanPemberitahuanPdp() {
    "use server";
    try {
      const otentikasi = await otentikasiAdmin();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };
      const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
      const { data: ada } = await supabase
        .from("pengumuman_rt")
        .select("id")
        .eq("rt_id", otentikasi.sesi.rtId)
        .eq("judul", JUDUL_PENGUMUMAN_PDP)
        .limit(1)
        .maybeSingle();
      if (ada?.id) {
        return { success: true, message: "Pemberitahuan PDP sudah tersiar. Tidak dibuat ulang." };
      }
      const { error } = await supabase.from("pengumuman_rt").insert([{
        judul: JUDUL_PENGUMUMAN_PDP,
        deskripsi: ISI_PENGUMUMAN_PDP,
        rt_id: otentikasi.sesi.rtId,
      }]);
      if (error) return { success: false, message: "Pemberitahuan belum dapat disiarkan." };
      await supabase.from("audit_log").insert([{
        aktor: otentikasi.sesi.nama,
        aksi: "Siarkan pemberitahuan PDP",
        tabel_target: "pengumuman_rt",
        detail: `Judul: ${JUDUL_PENGUMUMAN_PDP}`,
        rt_id: otentikasi.sesi.rtId,
      }]);
      revalidatePath("/");
      return { success: true, message: "Pemberitahuan PDP tersiar di portal dan beranda." };
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Pemberitahuan belum dapat disiarkan.";
      return { success: false, message: pesan };
    }
  }

  async function jalankanTenggatPdp() {
    "use server";
    try {
      const otentikasi = await otentikasiAdmin();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };
      const hasil = await kosongkanDataSpesifikLewatTenggat(
        getSupabaseAdminClientDariSesi(otentikasi.sesi),
        { rtId: otentikasi.sesi.rtId, aktor: otentikasi.sesi.nama }
      );
      if (!hasil.ok) return { success: false, message: hasil.message };
      revalidatePath("/");
      return {
        success: true,
        message: `Tenggat dijalankan. Pendapatan dikosongkan di ${hasil.pendapatan} KK, foto KK di ${hasil.fotoKk} KK. NIK dan buku induk tidak dihapus.`,
      };
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Tenggat belum dapat dijalankan.";
      return { success: false, message: pesan };
    }
  }

  async function jejakEksporBukuInduk(jumlahKk: number) {
    "use server";
    try {
      const otentikasi = await otentikasiAdmin();
      if (!otentikasi.ok) return { success: false, message: otentikasi.message };
      const jumlah = Math.max(0, Math.floor(Number(jumlahKk) || 0));
      const hasil = await catatJejakEksporBukuInduk(
        getSupabaseAdminClientDariSesi(otentikasi.sesi),
        { rtId: otentikasi.sesi.rtId, aktor: otentikasi.sesi.nama, jumlahKk: jumlah }
      );
      if (!hasil.ok) return { success: false, message: hasil.message };
      return { success: true, message: "Jejak ekspor tercatat." };
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Jejak ekspor belum tercatat.";
      return { success: false, message: pesan };
    }
  }

  return (
    <WargaAdminClient
      wargaList={wargaListAman}
      inventoriPdp={inventoriPdp.ok ? inventoriPdp.data : null}
      aksiHapus={hapusWarga}
      aksiUbahStatus={ubahStatusWarga}
      aksiImportMassal={importWargaMassal}
      aksiResetPin={resetPinWarga}
      aksiSiarkanPdp={siarkanPemberitahuanPdp}
      aksiTenggatPdp={jalankanTenggatPdp}
      aksiJejakEkspor={jejakEksporBukuInduk}
    />
  );
}
// Validasi Keamanan: Fungsi mendelegasikan pengecekan ke wilayahMutasiWarga dan saringWargaTerotorisasi di layer service.
