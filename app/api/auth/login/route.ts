import { NextRequest, NextResponse } from "next/server";
import { validateCredentials, getAuthCookieName, getExpectedToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { login, password } = await req.json();

    if (!validateCredentials(login, password)) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(getAuthCookieName(), getExpectedToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
