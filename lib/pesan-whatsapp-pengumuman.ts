const BATAS_RINGKASAN_WA = 400;

export function ringkasTeksPengumuman(teks: string, batas = BATAS_RINGKASAN_WA): string {
  const bersih = String(teks || "").replace(/\r\n/g, "\n").trim();
  if (bersih.length <= batas) return bersih;
  const potong = bersih.slice(0, batas);
  const terakhirSpasi = potong.lastIndexOf(" ");
  const isi = (terakhirSpasi > Math.floor(batas * 0.7) ? potong.slice(0, terakhirSpasi) : potong).trimEnd();
  return `${isi}…`;
}

export function tautanPengumumanPublik(asal: string, id: string): string {
  const dasar = String(asal || "").replace(/\/$/, "");
  const idBersih = String(id || "").trim();
  if (!dasar || !idBersih) return dasar || "";
  return `${dasar}/pengumuman/${idBersih}`;
}

export function susunPesanWhatsAppPengumuman(input: {
  judul: string;
  deskripsi: string;
  tautan: string;
  namaRt?: string;
}): string {
  const namaRt = String(input.namaRt || "RT").trim() || "RT";
  const judul = String(input.judul || "").trim() || "Pengumuman";
  const tautan = String(input.tautan || "").trim();
  const ringkasan = ringkasTeksPengumuman(input.deskripsi);
  const baris = [`📢 *Pengumuman ${namaRt}*`, "", `*${judul}*`];
  if (ringkasan) {
    baris.push("", ringkasan);
  }
  if (tautan) {
    baris.push("", "Selengkapnya di mading portal:", tautan);
  }
  return baris.join("\n");
}
