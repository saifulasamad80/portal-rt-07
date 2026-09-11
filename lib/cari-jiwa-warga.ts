export type AnggotaKartu = {
  id?: string;
  nama_lengkap?: string | null;
  nik?: string | null;
  hubungan_keluarga?: string | null;
  punya_akun_portal?: boolean;
};

export type HasilCariKk = {
  warga: Record<string, unknown> & { id: string; anggota_keluarga?: AnggotaKartu[] | null };
  cocokKk: boolean;
  tanggunganCocok: AnggotaKartu[];
};

export function teksCari(nilai: unknown) {
  return String(nilai ?? "").trim().toLowerCase();
}

export function cocokKunci(nilai: unknown, kunci: string) {
  if (!kunci) return false;
  const teks = String(nilai ?? "");
  if (teks.toLowerCase().includes(kunci)) return true;
  const digitKunci = kunci.replace(/\D/g, "");
  if (digitKunci.length < 4) return false;
  return teks.replace(/\D/g, "").includes(digitKunci);
}

export function susunHasilCari(daftar: unknown[], kunci: string): HasilCariKk[] {
  const sumber = Array.isArray(daftar) ? daftar : [];
  return sumber.flatMap((mentah) => {
    const warga = (mentah && typeof mentah === "object" ? mentah : {}) as HasilCariKk["warga"];
    if (!warga.id) return [];
    const tanggungan = Array.isArray(warga.anggota_keluarga) ? warga.anggota_keluarga : [];
    if (!kunci) return [{ warga, cocokKk: false, tanggunganCocok: [] }];
    const cocokKk =
      cocokKunci(warga.nama_lengkap, kunci) ||
      cocokKunci(warga.nik, kunci) ||
      cocokKunci(warga.no_kk, kunci);
    const tanggunganCocok = tanggungan.filter(
      (ak) => cocokKunci(ak?.nama_lengkap, kunci) || cocokKunci(ak?.nik, kunci)
    );
    if (!cocokKk && tanggunganCocok.length === 0) return [];
    return [{ warga, cocokKk, tanggunganCocok }];
  });
}

export function tempelAnggotaKeKartuKk(
  daftarKk: unknown[],
  daftarAnggota: unknown[],
  rtIdSesi: string
): Record<string, unknown>[] {
  const anggotaPerKk = new Map<string, AnggotaKartu[]>();
  for (const mentah of Array.isArray(daftarAnggota) ? daftarAnggota : []) {
    const anggota = mentah && typeof mentah === "object" ? (mentah as Record<string, unknown>) : {};
    const wargaId = String(anggota.warga_id || "");
    const rtIdAnggota = String(anggota.rt_id || "");
    if (!wargaId || rtIdAnggota !== rtIdSesi) continue;
    const kartu: AnggotaKartu = {
      id: anggota.id == null ? undefined : String(anggota.id),
      nama_lengkap: anggota.nama_lengkap == null ? null : String(anggota.nama_lengkap),
      nik: anggota.nik == null ? null : String(anggota.nik),
      hubungan_keluarga: anggota.hubungan_keluarga == null ? null : String(anggota.hubungan_keluarga),
    };
    const daftar = anggotaPerKk.get(wargaId) ?? [];
    daftar.push(kartu);
    anggotaPerKk.set(wargaId, daftar);
  }

  return (Array.isArray(daftarKk) ? daftarKk : []).flatMap((mentah) => {
    const warga = mentah && typeof mentah === "object" ? (mentah as Record<string, unknown>) : {};
    if (!warga.id) return [];
    const rtIdWarga = String(warga.rt_id || "");
    if (rtIdWarga !== rtIdSesi) return [];
    return [{ ...warga, anggota_keluarga: anggotaPerKk.get(String(warga.id)) ?? [] }];
  });
}

function nikEnamBelas(baris: unknown): string {
  if (!baris || typeof baris !== "object") return "";
  const nik = String((baris as { nik?: unknown }).nik ?? "").replace(/\D/g, "");
  return nik.length === 16 ? nik : "";
}

/**
 * Buku induk menampilkan satu kartu per rumah tangga. Jiwa yang sudah menempel
 * di anggota_keluarga (istri/anak) tidak boleh tampil lagi sebagai kartu
 * terpisah meski akun portal-nya diaktifkan.
 */
export function siapkanBukuIndukWarga(
  daftarWargaAktif: unknown[],
  daftarAnggota: unknown[],
  rtIdSesi: string
): Record<string, unknown>[] {
  const nikPortal = new Set<string>();
  for (const baris of Array.isArray(daftarWargaAktif) ? daftarWargaAktif : []) {
    const nik = nikEnamBelas(baris);
    if (nik) nikPortal.add(nik);
  }

  const nikMenempelDiKk = new Set<string>();
  for (const baris of Array.isArray(daftarAnggota) ? daftarAnggota : []) {
    const nik = nikEnamBelas(baris);
    if (nik) nikMenempelDiKk.add(nik);
  }

  return tempelAnggotaKeKartuKk(daftarWargaAktif, daftarAnggota, rtIdSesi).flatMap((kartu) => {
    const nikKartu = nikEnamBelas(kartu);
    if (nikKartu && nikMenempelDiKk.has(nikKartu)) return [];
    const tanggungan = Array.isArray(kartu.anggota_keluarga) ? kartu.anggota_keluarga : [];
    return [
      {
        ...kartu,
        anggota_keluarga: tanggungan.map((ak) => {
          const nikAnggota = nikEnamBelas(ak);
          return {
            ...ak,
            punya_akun_portal: Boolean(nikAnggota && nikPortal.has(nikAnggota)),
          };
        }),
      },
    ];
  });
}
