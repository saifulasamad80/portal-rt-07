import { redirect } from "next/navigation";
import WargaAdminClient from "./WargaAdminClient";
import bcrypt from "bcryptjs";
import { prosesHapusAtauArsipWarga } from "@/lib/arsip-warga";
import { tutupTiketPendaftaranWarga } from "@/lib/kebijakan-sensus";
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

const STATUS_VERIFIKASI_SAH = ["Disetujui", "Menunggu", "Ditolak"] as const;
const STATUS_TINGGAL_SAH = ["Warga Tetap", "Warga Kontrak", "Kontrak", "Kos", "Pendatang"] as const;
const JENIS_KELAMIN_SAH = ["Laki-laki", "Perempuan"] as const;
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATAS_BARIS_IMPORT = 1000;

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

  let queryWarga = supabaseAdmin
    .from("warga")
    .select(`
      id,
      nik,
      nama_lengkap,
      no_whatsapp,
      status_tinggal,
      detail_alamat,
      status_verifikasi,
      status_aktif,
      ktp_path,
      kk_path,
      created_at,
      rt_id,
      anggota_keluarga (id, nama_lengkap, hubungan_keluarga, rt_id)
    `);
  if (otentikasiHalaman.sesi.role !== "webmaster") {
    queryWarga = queryWarga.eq("rt_id", otentikasiHalaman.sesi.rtId);
  }
  const { data: wargaRes, error: errWarga } = await queryWarga.order("created_at", { ascending: false });

  if (errWarga) console.error("Gagal memuat buku induk warga:", errWarga.message);

  // RLS sudah membatasi relasi nested, tetapi baris warisan lintas tenant
  // tetap disaring sebelum daftar dikirim ke Client Component.
  const wargaListAman = (Array.isArray(wargaRes) ? wargaRes : []).map((warga: Record<string, unknown>) => {
    const rtIdWarga = String(warga.rt_id || "");
    const anggotaMentah = Array.isArray(warga.anggota_keluarga) ? warga.anggota_keluarga : [];
    const anggotaKeluarga = anggotaMentah
      .filter((anggota: { rt_id?: unknown }) => {
        const rtIdAnggota = String(anggota?.rt_id || "");
        if (rtIdAnggota === rtIdWarga) return true;
        console.error("Relasi anggota lintas RT disembunyikan dari daftar warga:", warga.id);
        return false;
      })
      .map((anggota: Record<string, unknown>) => {
        const { rt_id: _rtId, ...tanpaTenant } = anggota;
        void _rtId;
        return tanpaTenant;
      });

    return { ...warga, anggota_keluarga: anggotaKeluarga };
  });

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

      return await prosesHapusAtauArsipWarga(
        getSupabaseAdminClientDariSesi(otentikasi.sesi),
        target.sesi.id,
        otentikasi.sesi.nama
      );
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

      const statusBersih = String(status || "").trim();
      if (!STATUS_VERIFIKASI_SAH.includes(statusBersih as (typeof STATUS_VERIFIKASI_SAH)[number])) {
        return { success: false, message: `Status "${statusBersih}" tidak dikenali sistem.` };
      }

      const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
      const target = await otorisasiWargaUntukAdmin(supabase, otentikasi.sesi, idWarga.id);
      if (!target.ok) return { success: false, message: target.message };

      const wilayah = wilayahMutasiWarga(otentikasi.sesi, target.sesi.rtId);
      if (!wilayah.ok) return { success: false, message: wilayah.message };

      const { data: diperbarui, error } = await saringWargaTerotorisasi(
        supabase.from("warga").update({
          status_verifikasi: statusBersih,
          ...(wilayah.rtIdSaring ? {} : { rt_id: wilayah.rtIdTulis }),
        }),
        target.sesi,
        wilayah.rtIdSaring
      )
        .select("id")
        .maybeSingle();

      if (error) return { success: false, message: `Gagal menyimpan status: ${error.message}` };
      if (!diperbarui) return { success: false, message: "Data warga berubah; muat ulang halaman." };

      const { error: errAudit } = await supabase.from("audit_log").insert([
        {
          aktor: otentikasi.sesi.nama,
          aksi: `Mengubah Status Verifikasi: ${statusBersih}`,
          tabel_target: "warga",
          detail: `Warga: ${target.sesi.nama} diubah menjadi ${statusBersih}`,
          rt_id: wilayah.rtIdTulis,
        },
      ]);
      // Status utama sudah tersimpan; audit log hanya pelengkap.
      if (errAudit) console.error("Audit log ubah status gagal dicatat:", errAudit.message);

      const tiket = await tutupTiketPendaftaranWarga(supabase, idWarga.id, wilayah.rtIdTulis, statusBersih);
      if (tiket.error) console.error("Penutupan tiket pendaftaran gagal:", tiket.error);

      return {
        success: true,
        message: `Status ${target.sesi.nama} berhasil diubah menjadi ${statusBersih}.`,
      };
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

      if (!Array.isArray(dataWarga) || dataWarga.length === 0) {
        return { success: false, message: "Tidak ada baris data yang bisa diimpor.", hasil: { berhasil: 0, gagal: 0 } };
      }
      if (dataWarga.length > BATAS_BARIS_IMPORT) {
        return {
          success: false,
          message: `Terlalu banyak baris (${dataWarga.length}). Maksimal ${BATAS_BARIS_IMPORT} baris per impor.`,
          hasil: { berhasil: 0, gagal: 0 },
        };
      }

      const rtId = otentikasi.sesi.rtId;
      if (!rtId) {
        return {
          success: false,
          message: "Akses Ditolak: Gagal mengidentifikasi ID RT Anda.",
          hasil: { berhasil: 0, gagal: 0 },
        };
      }

      const supabase = await buatKlienTerautentikasi(otentikasi.sesi);
      const defaultPinHash = await bcrypt.hash("123456", 10);
      let berhasil = 0;
      let gagal = 0;

      for (const baris of dataWarga) {
        const w = baris && typeof baris === "object" ? baris as Record<string, unknown> : {};
        const nik = String(w?.nik ?? "").replace(/\D/g, "").trim();
        const namaLengkap = String(w?.nama_lengkap ?? "").trim();

        // Sanitasi Zero-Trust: NIK wajib 16 digit dan nama tidak boleh kosong,
        // agar baris CSV yang rusak tidak mengotori buku induk.
        if (nik.length !== 16 || !namaLengkap) {
          gagal++;
          continue;
        }

        const statusTinggal = String(w?.status_tinggal ?? "").trim();
        const jenisKelamin = String(w?.jenis_kelamin ?? "").trim();
        const tanggalLahir = String(w?.tanggal_lahir ?? "").trim();

        const payload = {
          nik,
          nama_lengkap: namaLengkap.slice(0, 150),
          no_whatsapp: String(w?.no_whatsapp ?? "").replace(/[^\d+]/g, "").trim(),
          status_tinggal: STATUS_TINGGAL_SAH.includes(statusTinggal as (typeof STATUS_TINGGAL_SAH)[number])
            ? statusTinggal
            : "Warga Tetap",
          detail_alamat: String(w?.detail_alamat ?? "").trim().slice(0, 300),
          tanggal_lahir: /^\d{4}-\d{2}-\d{2}$/.test(tanggalLahir) ? tanggalLahir : null,
          tempat_lahir: String(w?.tempat_lahir ?? "").trim().slice(0, 100),
          jenis_kelamin: JENIS_KELAMIN_SAH.includes(jenisKelamin as (typeof JENIS_KELAMIN_SAH)[number])
            ? jenisKelamin
            : "Laki-laki",
          pekerjaan: String(w?.pekerjaan ?? "").trim().slice(0, 100),
          status_verifikasi: "Disetujui",
          pin: defaultPinHash,
          rt_id: rtId,
        };

        const { error } = await supabase.from("warga").insert([payload]);
        if (error) {
          gagal++;
        } else {
          berhasil++;
        }
      }

      const { error: errAudit } = await supabase.from("audit_log").insert([
        {
          aktor: otentikasi.sesi.nama,
          aksi: "Import Bulk CSV Warga",
          tabel_target: "warga",
          detail: `Sukses: ${berhasil} KK. Gagal/Duplikat: ${gagal} baris.`,
          rt_id: rtId,
        },
      ]);
      if (errAudit) console.error("Audit log import gagal dicatat:", errAudit.message);

      return {
        success: true,
        message: `Impor selesai. Sukses ${berhasil} KK, gagal ${gagal} baris.`,
        hasil: { berhasil, gagal },
      };
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

      const hashedPin = await bcrypt.hash(pinBersih, 10);

      const { data: diperbarui, error } = await saringWargaTerotorisasi(
        supabase.from("warga").update({
          pin: hashedPin,
          percobaan_gagal: 0,
          terkunci_sampai: null,
          ...(wilayah.rtIdSaring ? {} : { rt_id: wilayah.rtIdTulis }),
        }),
        target.sesi,
        wilayah.rtIdSaring
      )
        .select("id")
        .maybeSingle();

      if (error) return { success: false, message: `Gagal mereset PIN: ${error.message}` };
      if (!diperbarui) return { success: false, message: "Data warga berubah; muat ulang halaman." };

      const { error: errAudit } = await supabase.from("audit_log").insert([
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

  return (
    <WargaAdminClient
      wargaList={wargaListAman}
      aksiHapus={hapusWarga}
      aksiUbahStatus={ubahStatusWarga}
      aksiImportMassal={importWargaMassal}
      aksiResetPin={resetPinWarga}
    />
  );
}
