import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL("/login", request.url);
  const response = NextResponse.redirect(url);
  response.cookies.set("warga_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
