"use client";

import { useState } from "react";
import {
  susunIsianDariOcr,
  type HasilOcrIdentitas,
  type IsianAnggotaOcr,
  type IsianKepalaOcr,
} from "@/lib/ocr-dokumen-identitas";
import { bacaFotoIdentitasDiPerangkat } from "@/lib/ocr-tesseract-klien";

const TIPE_GAMBAR_SAH = new Set(["image/jpeg", "image/png", "image/webp"]);

export type TerapanOcrIdentitas = {
  kepala: IsianKepalaOcr;
  anggota: IsianAnggotaOcr[];
};

function ringkasJiwa(nama: string, nik: string) {
  const namaTampil = nama || "Tanpa nama";
  const nikTampil = nik ? `${nik.slice(0, 6)}••••${nik.slice(-2)}` : "NIK kosong";
  return `${namaTampil} · ${nikTampil}`;
}

export default function BacaFotoIdentitas({
  berkasUtama = null,
  nikTerkunci = "",
  onTerapkan,
}: {
  berkasUtama?: File | null;
  nikTerkunci?: string;
  onTerapkan: (isian: TerapanOcrIdentitas) => void;
}) {
  const [berkasLokal, setBerkasLokal] = useState<File | null>(null);
  const [status, setStatus] = useState<"diam" | "membaca" | "siap" | "gagal">("diam");
  const [persen, setPersen] = useState(0);
  const [hasil, setHasil] = useState<HasilOcrIdentitas | null>(null);
  const [pesan, setPesan] = useState("");

  const berkas = berkasLokal || berkasUtama;
  const susunan = hasil ? susunIsianDariOcr(hasil, { nikTerkunci: nikTerkunci || undefined }) : null;

  const jalankan = async () => {
    if (!berkas) {
      setStatus("gagal");
      setPesan("Pilih foto KTP atau KK terlebih dahulu.");
      return;
    }
    if (!TIPE_GAMBAR_SAH.has(berkas.type.toLowerCase())) {
      setStatus("gagal");
      setPesan("Hanya JPEG, PNG, atau WEBP.");
      return;
    }
    setStatus("membaca");
    setPersen(0);
    setPesan("");
    setHasil(null);
    try {
      const dibaca = await bacaFotoIdentitasDiPerangkat(berkas, setPersen);
      setHasil(dibaca);
      const cek = susunIsianDariOcr(dibaca, { nikTerkunci: nikTerkunci || undefined });
      setStatus(cek.bisaDiterapkan ? "siap" : "gagal");
      setPesan(cek.peringatan[0] || (cek.bisaDiterapkan ? "" : "Tidak ada data yang bisa diterapkan."));
    } catch (error) {
      setStatus("gagal");
      setHasil(null);
      const mentah = error instanceof Error && error.message ? error.message : "";
      setPesan(
        /failed to fetch|network|csp|security/i.test(mentah)
          ? "Mesin baca gagal dimuat. Isi formulir manual. Foto tidak dikirim ke server OCR."
          : "Foto gagal dibaca. Ambil ulang dengan cahaya rata, atau isi manual.",
      );
    }
  };

  const terapkan = () => {
    if (!susunan?.bisaDiterapkan) return;
    onTerapkan({ kepala: susunan.kepala, anggota: susunan.anggota });
    setPesan("Isian formulir diisi dari foto. Cek NIK dan nama sebelum kirim — OCR bisa salah.");
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-indigo-900">Baca foto KTP / KK di HP</p>
        <p className="text-[11px] text-indigo-800 mt-1 leading-relaxed">
          Teks dibaca di perangkat Anda, lalu ditawarkan ke formulir. Bukan ditulis langsung ke buku induk.
          Foto tidak dikirim ke mesin OCR di internet. NIK, WhatsApp, dan PIN tetap tidak masuk draf peramban.
        </p>
      </div>

      <label className="block">
        <span className="sr-only">Pilih foto identitas untuk dibaca</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="w-full text-xs text-slate-800"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            setBerkasLokal(file);
            setHasil(null);
            setStatus("diam");
            setPesan("");
          }}
        />
      </label>
      {berkasUtama && !berkasLokal ? (
        <p className="text-[11px] font-bold text-indigo-700">Memakai foto yang sudah dilampirkan di formulir.</p>
      ) : null}

      <button
        type="button"
        onClick={() => void jalankan()}
        disabled={status === "membaca" || !berkas}
        className="w-full rounded-lg bg-indigo-700 text-white font-black uppercase tracking-widest text-xs py-3 disabled:bg-slate-400"
      >
        {status === "membaca" ? `Membaca foto… ${persen}%` : "Baca teks dari foto"}
      </button>

      {susunan && status !== "membaca" ? (
        <div className="rounded-lg border border-indigo-100 bg-white p-3 space-y-2 text-sm text-slate-800">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Usulan isian</p>
          {susunan.kepala.nama_lengkap || susunan.kepala.nik || susunan.kepala.no_kk ? (
            <p>
              <span className="font-semibold">Kepala / pemegang kartu:</span>{" "}
              {ringkasJiwa(susunan.kepala.nama_lengkap, susunan.kepala.nik)}
              {susunan.kepala.no_kk ? ` · KK ${susunan.kepala.no_kk.slice(0, 6)}••••${susunan.kepala.no_kk.slice(-2)}` : ""}
            </p>
          ) : null}
          {susunan.anggota.length > 0 ? (
            <ul className="list-disc pl-4 text-[13px] space-y-0.5">
              {susunan.anggota.map((item, indeks) => (
                <li key={`${item.nik || "kosong"}-${indeks}`}>{ringkasJiwa(item.nama_lengkap, item.nik)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-slate-500">Anggota keluarga tidak terurai dari tabel KK.</p>
          )}
          {susunan.peringatan.length > 0 ? (
            <ul className="text-[11px] text-amber-800 space-y-1">
              {susunan.peringatan.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            onClick={terapkan}
            disabled={!susunan.bisaDiterapkan}
            className="w-full rounded-lg bg-emerald-700 text-white font-black uppercase tracking-widest text-[11px] py-2.5 disabled:bg-slate-400"
          >
            Terapkan ke formulir
          </button>
        </div>
      ) : null}

      {pesan ? <p className="text-[11px] font-semibold text-slate-700 leading-relaxed">{pesan}</p> : null}
    </div>
  );
}
