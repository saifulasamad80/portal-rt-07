import { NextResponse } from "next/server";
import { skemaBelumSiap, type ErrorSupabase } from "@/lib/arsip-warga";
import { bacaMuatanLanggananPush } from "@/lib/notifikasi-push";
import { otentikasiAdminAktif } from "@/lib/session-security";
import { getSupabaseAdminClientDariSesi } from "@/lib/supabase-server";

const PESAN_PUSH_BELUM_SIAP =
  "Fitur notifikasi pengurus belum aktif di database. Jalankan SQL push-langganan-pengurus.sql di Supabase.";

function pesanError(err: unknown, fallback: string) {
  if (skemaBelumSiap(err as ErrorSupabase)) {
    return NextResponse.json({ error: PESAN_PUSH_BELUM_SIAP, code: "PUSH_SCHEMA_MISSING" }, { status: 503 });
  }
  console.error("Operasi langganan push pengurus gagal:", err instanceof Error ? err.message : err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const otentikasi = await otentikasiAdminAktif();
    if (!otentikasi.ok) return NextResponse.json({ error: otentikasi.message }, { status: 401 });
    const sesi = otentikasi.sesi;

    const muatan = bacaMuatanLanggananPush(await request.json());
    if (!muatan.ok) return NextResponse.json({ error: muatan.message }, { status: 400 });
    const { endpoint, p256dh, auth } = muatan.data;
    const userAgent = request.headers.get("user-agent")?.slice(0, 240) || null;

    const supabase = getSupabaseAdminClientDariSesi(sesi);
    const baris = {
      pengurus_id: sesi.id,
      rt_id: sesi.rtId,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
    };

    const hasilInsert = await supabase.from("push_langganan").insert([baris]);
    if (hasilInsert.error && hasilInsert.error.code !== "23505") throw hasilInsert.error;
    if (hasilInsert.error?.code === "23505") {
      const { data: existing, error: errExisting } = await supabase
        .from("push_langganan")
        .select("id, rt_id, pengurus_id")
        .eq("endpoint", endpoint)
        .maybeSingle();
      if (errExisting) throw errExisting;
      if (!existing) {
        return NextResponse.json({ error: "Langganan push tidak ditemukan setelah konflik." }, { status: 409 });
      }
      if (String(existing.rt_id) !== sesi.rtId) {
        return NextResponse.json({ error: "Endpoint push sudah terdaftar pada wilayah RT lain." }, { status: 409 });
      }
      if (existing.pengurus_id && String(existing.pengurus_id) !== sesi.id) {
        return NextResponse.json({ error: "Endpoint push sudah terdaftar pada akun pengurus lain." }, { status: 409 });
      }
      const { data: diperbarui, error: errPerbarui } = await supabase
        .from("push_langganan")
        .update({ pengurus_id: sesi.id, p256dh, auth, user_agent: userAgent })
        .eq("id", existing.id)
        .eq("rt_id", sesi.rtId)
        .select("id")
        .maybeSingle();
      if (errPerbarui) throw errPerbarui;
      if (!diperbarui) {
        return NextResponse.json({ error: "Endpoint push sudah terdaftar pada akun lain." }, { status: 409 });
      }
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return pesanError(err, "Gagal menyimpan langganan notifikasi pengurus.");
  }
}

export async function DELETE(request: Request) {
  try {
    const otentikasi = await otentikasiAdminAktif();
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

    const supabase = getSupabaseAdminClientDariSesi(sesi);
    let query = supabase
      .from("push_langganan")
      .select("id, warga_id, endpoint")
      .eq("pengurus_id", sesi.id)
      .eq("rt_id", sesi.rtId);
    if (endpoint) query = query.eq("endpoint", endpoint);
    const { data: daftar, error: errDaftar } = await query;
    if (errDaftar) throw errDaftar;

    for (const row of daftar || []) {
      if (row.warga_id) {
        const { error } = await supabase
          .from("push_langganan")
          .update({ pengurus_id: null })
          .eq("id", row.id)
          .eq("rt_id", sesi.rtId)
          .eq("pengurus_id", sesi.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("push_langganan")
          .delete()
          .eq("id", row.id)
          .eq("rt_id", sesi.rtId)
          .eq("pengurus_id", sesi.id);
        if (error) throw error;
      }
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return pesanError(err, "Gagal memutus langganan notifikasi pengurus.");
  }
}
