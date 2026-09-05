import { NextResponse } from "next/server";
import { skemaBelumSiap, type ErrorSupabase } from "@/lib/arsip-warga";
import { otentikasiWargaAktif } from "@/lib/session-security";
import { buatKlienTerautentikasi } from "@/lib/supabase-server";

const PESAN_PUSH_BELUM_SIAP =
  "Fitur notifikasi belum aktif di server. Pengurus perlu menjalankan SQL wargaku-v2-push-ibu-soft-delete.sql di Supabase.";

function pesanError(err: unknown, fallback: string) {
  if (skemaBelumSiap(err as ErrorSupabase)) {
    return NextResponse.json({ error: PESAN_PUSH_BELUM_SIAP, code: "PUSH_SCHEMA_MISSING" }, { status: 503 });
  }
  console.error("Operasi langganan push gagal:", err instanceof Error ? err.message : err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const otentikasi = await otentikasiWargaAktif();
    if (!otentikasi.ok) return NextResponse.json({ error: otentikasi.message }, { status: 401 });
    const sesi = otentikasi.sesi;

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Format langganan push tidak valid." }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const keys = input.keys && typeof input.keys === "object" && !Array.isArray(input.keys)
      ? input.keys as Record<string, unknown>
      : null;
    const endpoint = typeof input.endpoint === "string" ? input.endpoint.trim() : "";
    const p256dh = keys && typeof keys.p256dh === "string" ? keys.p256dh.trim() : "";
    const auth = keys && typeof keys.auth === "string" ? keys.auth.trim() : "";
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Data langganan push tidak lengkap." }, { status: 400 });
    }
    if (endpoint.length > 2048 || p256dh.length > 256 || auth.length > 256) {
      return NextResponse.json({ error: "Data langganan push terlalu panjang." }, { status: 400 });
    }
    try {
      const endpointUrl = new URL(endpoint);
      if (endpointUrl.protocol !== "https:") throw new Error("protocol");
    } catch {
      return NextResponse.json({ error: "Endpoint push tidak valid." }, { status: 400 });
    }
    if (!/^[A-Za-z0-9_-]+$/.test(p256dh) || !/^[A-Za-z0-9_-]+$/.test(auth)) {
      return NextResponse.json({ error: "Kunci langganan push tidak valid." }, { status: 400 });
    }

    const supabase = await buatKlienTerautentikasi(sesi);
    const baris = {
      warga_id: sesi.id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 240) || null,
    };

    // Jangan memakai upsert(onConflict=endpoint): endpoint adalah nilai yang
    // bisa terlihat di browser, dan upsert tersebut memungkinkan warga A
    // memindahkan langganan milik warga B ke akunnya. Insert dulu; bila sudah
    // ada, hanya pemilik lama yang boleh memperbarui kunci perangkatnya.
    const hasilInsert = await supabase.from("push_langganan").insert([baris]);
    if (hasilInsert.error && hasilInsert.error.code !== "23505") throw hasilInsert.error;
    if (hasilInsert.error?.code === "23505") {
      const { data: diperbarui, error: errPerbarui } = await supabase
        .from("push_langganan")
        .update({ p256dh, auth, user_agent: baris.user_agent })
        .eq("endpoint", endpoint)
        .eq("warga_id", sesi.id)
        .select("id")
        .maybeSingle();
      if (errPerbarui) throw errPerbarui;
      if (!diperbarui) {
        return NextResponse.json({ error: "Endpoint push sudah terdaftar pada akun lain." }, { status: 409 });
      }
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return pesanError(err, "Gagal menyimpan langganan notifikasi.");
  }
}

export async function DELETE(request: Request) {
  try {
    const otentikasi = await otentikasiWargaAktif();
    if (!otentikasi.ok) return NextResponse.json({ error: otentikasi.message }, { status: 401 });
    const sesi = otentikasi.sesi;
    const body: unknown = await request.json().catch(() => ({}));
    const input = body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
    const endpoint = input && typeof input.endpoint === "string" ? input.endpoint.trim() : "";
    if (endpoint.length > 2048) {
      return NextResponse.json({ error: "Endpoint push terlalu panjang." }, { status: 400 });
    }
    if (endpoint) {
      try {
        if (new URL(endpoint).protocol !== "https:") throw new Error("protocol");
      } catch {
        return NextResponse.json({ error: "Endpoint push tidak valid." }, { status: 400 });
      }
    }
    const supabase = await buatKlienTerautentikasi(sesi);
    let query = supabase.from("push_langganan").delete().eq("warga_id", sesi.id);
    if (endpoint) query = query.eq("endpoint", endpoint);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return pesanError(err, "Gagal memutus langganan notifikasi.");
  }
}

export async function GET() {
  const publik = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  return NextResponse.json(
    { vapidPublicKey: publik, aktif: Boolean(publik) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
