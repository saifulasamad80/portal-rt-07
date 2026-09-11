import "server-only";
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const UKURAN_OG = { width: 1200, height: 630 };
export const TIPE_KONTEN_OG = "image/png";

function potongTeks(teks: string, batas: number) {
  const bersih = String(teks || "").replace(/\s+/g, " ").trim();
  if (bersih.length <= batas) return bersih;
  return `${bersih.slice(0, Math.max(0, batas - 1)).trimEnd()}…`;
}

async function sumberLogoPengurus() {
  const data = await readFile(join(process.cwd(), "public/identitas/logo-pengurus-rt07.png"));
  return `data:image/png;base64,${data.toString("base64")}`;
}

export async function buatGambarOpenGraph(input: {
  kicker: string;
  judul: string;
  deskripsi?: string;
  catatan?: string;
}) {
  const logo = await sumberLogoPengurus();
  const kicker = potongTeks(input.kicker || "Portal Warga", 48);
  const judul = potongTeks(input.judul || "Portal Warga", 90);
  const deskripsi = potongTeks(input.deskripsi || "", 160);
  const catatan = potongTeks(input.catatan || "RT 07 / 09", 64);
  const ukuranJudul = judul.length > 48 ? 52 : 64;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0F241C",
          color: "#ffffff",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -90,
            top: -90,
            width: 380,
            height: 380,
            borderRadius: 999,
            background: "rgba(232,197,106,0.16)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 80,
            bottom: -100,
            width: 300,
            height: 300,
            borderRadius: 999,
            background: "rgba(16,185,129,0.14)",
            display: "flex",
          }}
        />
        <div style={{ width: 18, height: "100%", background: "#E8C56A", display: "flex" }} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "52px 60px 48px 52px",
            flex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                width: 108,
                height: 108,
                borderRadius: 999,
                background: "linear-gradient(135deg, #F3D27A 0%, #C4A35A 55%, #7a5a24 100%)",
                padding: 4,
              }}
            >
              <img
                src={logo}
                width={100}
                height={100}
                alt=""
                style={{ borderRadius: 999, background: "#ffffff" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 28 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 22,
                  letterSpacing: 5,
                  fontWeight: 700,
                  color: "#E8C56A",
                  textTransform: "uppercase",
                }}
              >
                {kicker}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#ffffff",
                  marginTop: 8,
                }}
              >
                {catatan}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
            <div
              style={{
                display: "flex",
                fontSize: ukuranJudul,
                fontWeight: 800,
                lineHeight: 1.12,
                color: "#ffffff",
                letterSpacing: -1,
              }}
            >
              {judul}
            </div>
            {deskripsi ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  color: "rgba(209,250,229,0.84)",
                  marginTop: 22,
                  lineHeight: 1.35,
                }}
              >
                {deskripsi}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 22, color: "rgba(232,197,106,0.92)", letterSpacing: 1 }}>
              wargaku-six.vercel.app
            </div>
            <div
              style={{
                display: "flex",
                background: "#C4A35A",
                color: "#0F241C",
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: 1.4,
                padding: "12px 22px",
                borderRadius: 14,
                textTransform: "uppercase",
              }}
            >
              Portal Warga
            </div>
          </div>
        </div>
      </div>
    ),
    { ...UKURAN_OG },
  );
}
