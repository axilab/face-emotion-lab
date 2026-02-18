import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "fel-auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow auth API routes and login page
  if (pathname.includes("/api/auth/") || pathname.includes("/login")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    // Redirect to login for pages, return 401 for API routes
    if (pathname.includes("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const loginUrl = new URL(`${basePath}/login`, req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
