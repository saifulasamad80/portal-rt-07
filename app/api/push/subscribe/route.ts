import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

async function sesiWarga() {
  const cookieStore = await cookies();
  const token = cookieStore.get("warga_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { id: string };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const sesi = await sesiWarga();
    if (!sesi?.id) return NextResponse.json({ error: "Sesi warga tidak valid." }, { status: 401 });

    const body = await request.json();
    const endpoint = String(body?.endpoint || "");
    const p256dh = String(body?.keys?.p256dh || "");
    const auth = String(body?.keys?.auth || "");
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Data langganan push tidak lengkap." }, { status: 400 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await supabase.from("push_langganan").upsert(
      {
        warga_id: sesi.id,
        endpoint,
        p256dh,
        auth,
        user_agent: request.headers.get("user-agent")?.slice(0, 240) || null,
      },
      { onConflict: "endpoint" }
    );
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Gagal menyimpan langganan notifikasi." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const sesi = await sesiWarga();
    if (!sesi?.id) return NextResponse.json({ error: "Sesi warga tidak valid." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const endpoint = String(body?.endpoint || "");
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    let query = supabase.from("push_langganan").delete().eq("warga_id", sesi.id);
    if (endpoint) query = query.eq("endpoint", endpoint);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Gagal memutus langganan notifikasi." }, { status: 500 });
  }
}

export async function GET() {
  const publik = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  return NextResponse.json({ vapidPublicKey: publik, aktif: Boolean(publik) });
}
