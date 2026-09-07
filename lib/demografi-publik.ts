export type RekamanJiwa = {
  id?: string;
  rt_id?: string | null;
  tanggal_lahir: string | null;
  jenis_kelamin: string | null;
  agama: string | null;
  pekerjaan: string | null;
  anggota_keluarga?: RekamanJiwa[] | null;
};

export type RekapDemografi = {
  jiwa: number;
  jiwaDenganUsia: number;
  laki_c: number;
  laki_p: number;
  perempuan_c: number;
  perempuan_p: number;
  balita_c: number;
  balita_p: number;
  anak_c: number;
  anak_p: number;
  dewasa_c: number;
  dewasa_p: number;
  lansia_c: number;
  lansia_p: number;
  islam_c: number;
  islam_p: number;
  kristen_c: number;
  kristen_p: number;
  lainAgama_c: number;
  lainAgama_p: number;
  swasta_c: number;
  swasta_p: number;
  wirausaha_c: number;
  wirausaha_p: number;
  pns_c: number;
  pns_p: number;
  lainKerja_c: number;
  lainKerja_p: number;
};

export function hitungJiwa(daftarKk: RekamanJiwa[]) {
  return daftarKk.reduce((jumlah, kk) => jumlah + 1 + (kk.anggota_keluarga?.length || 0), 0);
}

function hitungUmur(tglLahir: string | null | undefined): number | null {
  if (!tglLahir || !String(tglLahir).trim()) return null;
  const birth = new Date(tglLahir);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}

function persen(val: number, total: number) {
  return total === 0 ? 0 : Math.round((val / total) * 100);
}

export function rekapDemografi(dataWarga: RekamanJiwa[]): RekapDemografi {
  let totalJiwa = 0;
  let jiwaDenganUsia = 0;
  let laki = 0;
  let perempuan = 0;
  let balita = 0;
  let anak = 0;
  let dewasa = 0;
  let lansia = 0;
  let islam = 0;
  let kristen = 0;
  let hinduBudhaLain = 0;
  let pns = 0;
  let swasta = 0;
  let wirausaha = 0;
  let lainPekerjaan = 0;

  const prosesIndividu = (p: RekamanJiwa) => {
    totalJiwa++;
    const jk = (p.jenis_kelamin || "").toLowerCase();
    if (jk.includes("laki") || jk === "l") laki++;
    else if (jk.includes("perempuan") || jk === "p") perempuan++;

    const umur = hitungUmur(p.tanggal_lahir);
    if (umur !== null) {
      jiwaDenganUsia++;
      if (umur <= 4) balita++;
      else if (umur <= 17) anak++;
      else if (umur <= 55) dewasa++;
      else lansia++;
    }

    const agm = (p.agama || "").toLowerCase();
    if (agm.includes("islam")) islam++;
    else if (agm.includes("kristen") || agm.includes("katolik") || agm.includes("katholik")) kristen++;
    else if (agm) hinduBudhaLain++;

    const pkj = (p.pekerjaan || "").toLowerCase();
    if (pkj.includes("pns") || pkj.includes("tni") || pkj.includes("polri") || pkj.includes("negeri")) pns++;
    else if (pkj.includes("karyawan") || pkj.includes("swasta") || pkj.includes("pegawai") || pkj.includes("buruh") || pkj.includes("guru") || pkj.includes("staff")) swasta++;
    else if (pkj.includes("wirausaha") || pkj.includes("wiraswasta") || pkj.includes("dagang") || pkj.includes("usaha") || pkj.includes("freelance")) wirausaha++;
    else lainPekerjaan++;
  };

  dataWarga.forEach((w) => {
    prosesIndividu(w);
    (w.anggota_keluarga || []).forEach(prosesIndividu);
  });

  return {
    jiwa: totalJiwa,
    jiwaDenganUsia,
    laki_c: laki,
    laki_p: persen(laki, totalJiwa),
    perempuan_c: perempuan,
    perempuan_p: persen(perempuan, totalJiwa),
    balita_c: balita,
    balita_p: persen(balita, jiwaDenganUsia),
    anak_c: anak,
    anak_p: persen(anak, jiwaDenganUsia),
    dewasa_c: dewasa,
    dewasa_p: persen(dewasa, jiwaDenganUsia),
    lansia_c: lansia,
    lansia_p: persen(lansia, jiwaDenganUsia),
    islam_c: islam,
    islam_p: persen(islam, totalJiwa),
    kristen_c: kristen,
    kristen_p: persen(kristen, totalJiwa),
    lainAgama_c: hinduBudhaLain,
    lainAgama_p: persen(hinduBudhaLain, totalJiwa),
    swasta_c: swasta,
    swasta_p: persen(swasta, totalJiwa),
    wirausaha_c: wirausaha,
    wirausaha_p: persen(wirausaha, totalJiwa),
    pns_c: pns,
    pns_p: persen(pns, totalJiwa),
    lainKerja_c: lainPekerjaan,
    lainKerja_p: persen(lainPekerjaan, totalJiwa),
  };
}
