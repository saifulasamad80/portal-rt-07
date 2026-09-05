import { notFound } from "next/navigation";

/**
 * Rekam kesehatan individu tidak boleh disajikan kepada akun warga biasa.
 * Akses kader/pengurus akan dibuka melalui boundary admin terpisah setelah
 * otorisasi subjek dan kebijakan tenant tersedia.
 */
export default function PosyanduBalitaPage() {
  notFound();
}
