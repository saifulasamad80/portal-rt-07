import Link from "next/link";
import RegisterClient from "./RegisterClient";
import { aksiRegister, type HasilRegister } from "./actions";
import { tetapkanRtRegistrasi } from "@/lib/registrasi-tenant";

function RegisterWilayahTertutup({ pesan }: { pesan: string }) {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 flex flex-col items-center py-10 font-sans">
      <div className="w-full max-w-xl mb-4 text-left">
        <Link href="/login" className="text-blue-600 font-bold hover:underline inline-flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
          <span>&larr;</span> Kembali ke Login
        </Link>
      </div>
      <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg w-full max-w-xl border-t-[8px] border-t-rose-600">
        <h1 className="text-2xl font-black text-slate-800 mb-3">Pendaftaran belum bisa dibuka</h1>
        <p className="text-sm text-slate-600 leading-relaxed">{pesan}</p>
        <p className="text-xs text-slate-500 mt-4 leading-relaxed">
          Minta tautan rujukan resmi dari pengurus RT, berbentuk <span className="font-mono font-bold">/register?rt=kode</span>.
          Formulir publik tidak boleh mengirim data tanpa wilayah RT.
        </p>
        <p className="text-xs text-slate-500 mt-3">
          <Link href="/kebijakan-privasi" className="text-blue-700 font-semibold hover:underline">Kebijakan Privasi</Link>
        </p>
      </div>
    </div>
  );
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ alasan?: string; rt?: string }>;
}) {
  const { alasan, rt } = await searchParams;
  const wilayah = await tetapkanRtRegistrasi(rt);
  if (!wilayah.ok) return <RegisterWilayahTertutup pesan={wilayah.message} />;

  const namaWilayah = [wilayah.wilayah.namaRt, wilayah.wilayah.namaRw].filter(Boolean).join(" / ");
  const rtIdTerikat = wilayah.wilayah.rtId;

  async function daftar(payloadKepala: unknown, anggotaPayload: unknown, persetujuan: unknown): Promise<HasilRegister> {
    "use server";
    return aksiRegister(rtIdTerikat, payloadKepala, anggotaPayload, persetujuan);
  }

  return (
    <RegisterClient
      aksiRegister={daftar}
      alasan={alasan}
      namaWilayah={namaWilayah}
    />
  );
}
