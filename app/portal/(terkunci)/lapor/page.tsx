import { redirect } from "next/navigation";

/**
 * Menu lapor bebas ditutup. Tiket hanya dibuat dari Ajukan perubahan
 * di /portal/keluarga. URL lama diarahkan ke dasbor.
 */
export default function LaporRTPage() {
  redirect("/portal");
}
