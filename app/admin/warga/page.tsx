import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import WargaAdminClient from "./WargaAdminClient";
import bcrypt from "bcryptjs";
import { prosesHapusAtauArsipWarga } from "@/lib/arsip-warga";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "super-secret-rt07-key-change-this-in-production");

const STATUS_VERIFIKASI_SAH = ["Disetujui", "Menunggu", "Ditolak"] as const;
const STATUS_TINGGAL_SAH = ["Warga Tetap", "Warga Kontrak", "Kontrak", "Kos", "Pendatang"] as const;
const JENIS_KELAMIN_SAH = ["Laki-laki", "Perempuan"] as const;
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATAS_BARIS_IMPORT = 1000;

type SesiAdmin = { nama?: string; role?: string; rt_id?: string };

function buatKlienAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Zero-Trust: JWT diverifikasi ulang di dalam setiap Server Action.
 *
 * Sengaja mengembalikan Result Object dan TIDAK melempar exception, karena
 * exception yang lolos dari Server Action dapat memicu crash React/Vercel
 * (digest error tanpa pesan yang bisa dibaca pengurus).
 */
async function otentikasiAdmin(): Promise<
  { ok: true; sesi: SesiAdmin } | { ok: false; message: string }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  if (!token) {
    return { ok: false, message: "Akses ditolak: sesi pengurus tidak ada atau telah berakhir. Silakan masuk kembali." };
  }
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { ok: true, sesi: payload as SesiAdmin };
  } catch {
    return { ok: false, message: "Akses ditolak: sesi tidak valid atau telah dimanipulasi. Silakan masuk kembali." };
  }
}

function validasiIdWarga(id: unknown): { ok: true; id: string } | { ok: false; message: string } {
  const bersih = String(id ?? "").trim();
  if (!bersih) return { ok: false, message: "ID warga wajib diisi." };
  if (!POLA_UUID.test(bersih)) return { ok: false, message: "ID warga tidak valid." };
  return { ok: true, id: bersih };
}

export default async function WargaAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;

  if (!token) redirect("/admin");

  try {
    await jwtVerify(token, JWT_SECRET);
  } catch {
    redirect("/admin");
  }

  const supabaseAdmin = buatKlienAdmin();

  const { data: wargaRes, error: errWarga } = await supabaseAdmin
    .from("warga")
    .select("*, anggota_keluarga(*)")
    .order("created_at", { ascending: false });

  if (errWarga) console.error("Gagal memuat buku induk warga:", errWarga.message);

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

      const supabase = buatKlienAdmin();
      return await prosesHapusAtauArsipWarga(supabase, idWarga.id, String(otentikasi.sesi.nama || "pengurus"));
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

      const supabase = buatKlienAdmin();

      // maybeSingle() dipakai agar baris yang sudah hilang mengembalikan data
      // null tanpa error PGRST116, sehingga error database yang sesungguhnya
      // tidak lagi tersamar menjadi "Data warga tidak ditemukan".
      const { data: target, error: errTarget } = await supabase
        .from("warga")
        .select("id, nama_lengkap")
        .eq("id", idWarga.id)
        .maybeSingle();

      if (errTarget) {
        return { success: false, message: `Gagal membaca data warga: ${errTarget.message}` };
      }
      if (!target) {
        return {
          success: false,
          message: "Data warga ini sudah tidak ada di database. Daftar akan disegarkan.",
        };
      }

      const { error } = await supabase
        .from("warga")
        .update({ status_verifikasi: statusBersih })
        .eq("id", idWarga.id);

      if (error) return { success: false, message: `Gagal menyimpan status: ${error.message}` };

      const { error: errAudit } = await supabase.from("audit_log").insert([
        {
          aktor: otentikasi.sesi.nama || "pengurus",
          aksi: `Mengubah Status Verifikasi: ${statusBersih}`,
          tabel_target: "warga",
          detail: `Warga: ${target.nama_lengkap || idWarga.id} diubah menjadi ${statusBersih}`,
        },
      ]);
      // Status utama sudah tersimpan; audit log hanya pelengkap.
      if (errAudit) console.error("Audit log ubah status gagal dicatat:", errAudit.message);

      return {
        success: true,
        message: `Status ${target.nama_lengkap || "warga"} berhasil diubah menjadi ${statusBersih}.`,
      };
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal server saat mengubah status.";
      return { success: false, message: pesan };
    }
  }

  async function importWargaMassal(dataWarga: any[]) {
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

      const rtId = otentikasi.sesi.rt_id;
      if (!rtId) {
        return {
          success: false,
          message: "Akses Ditolak: Gagal mengidentifikasi ID RT Anda.",
          hasil: { berhasil: 0, gagal: 0 },
        };
      }

      const supabase = buatKlienAdmin();
      const defaultPinHash = await bcrypt.hash("123456", 10);
      let berhasil = 0;
      let gagal = 0;

      for (const w of dataWarga) {
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
          aktor: otentikasi.sesi.nama || "pengurus",
          aksi: "Import Bulk CSV Warga",
          tabel_target: "warga",
          detail: `Sukses: ${berhasil} KK. Gagal/Duplikat: ${gagal} baris.`,
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

      const supabase = buatKlienAdmin();

      const { data: target, error: errTarget } = await supabase
        .from("warga")
        .select("id, nama_lengkap")
        .eq("id", idWarga.id)
        .maybeSingle();

      if (errTarget) {
        return { success: false, message: `Gagal membaca data warga: ${errTarget.message}` };
      }
      if (!target) {
        return {
          success: false,
          message: "Data warga ini sudah tidak ada di database. Daftar akan disegarkan.",
        };
      }

      const hashedPin = await bcrypt.hash(pinBersih, 10);

      const { error } = await supabase
        .from("warga")
        .update({
          pin: hashedPin,
          percobaan_gagal: 0,
          terkunci_sampai: null,
        })
        .eq("id", idWarga.id);

      if (error) return { success: false, message: `Gagal mereset PIN: ${error.message}` };

      const { error: errAudit } = await supabase.from("audit_log").insert([
        {
          aktor: otentikasi.sesi.nama || "pengurus",
          aksi: "Reset PIN & Cabut Lockdown Warga",
          tabel_target: "warga",
          detail: `Mereset paksa PIN & membuka kunci akses milik: ${target.nama_lengkap || idWarga.id}`,
        },
      ]);
      if (errAudit) console.error("Audit log reset PIN gagal dicatat:", errAudit.message);

      return { success: true, message: `PIN ${target.nama_lengkap || "warga"} berhasil direset.` };
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message : "Kegagalan internal server saat mereset PIN.";
      return { success: false, message: pesan };
    }
  }

  return (
    <WargaAdminClient
      wargaList={wargaRes || []}
      aksiHapus={hapusWarga}
      aksiUbahStatus={ubahStatusWarga}
      aksiImportMassal={importWargaMassal}
      aksiResetPin={resetPinWarga}
    />
  );
}
