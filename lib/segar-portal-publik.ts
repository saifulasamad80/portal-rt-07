import { revalidatePath } from "next/cache";

/** Segarkan beranda publik setelah pengurus mengubah data yang tampil di sana. */
export function segarKanPortalPublik() {
  revalidatePath("/", "layout");
  revalidatePath("/pengumuman");
  revalidatePath("/api/public/etalase");
}
