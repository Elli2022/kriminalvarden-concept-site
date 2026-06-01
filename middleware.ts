import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  generateCsrfToken,
} from "@/lib/security-constants";

function buildMiddlewareCsrfCookieOptions(expiresAt: Date) {
  return {
    httpOnly: false,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_DURATION_SECONDS,
    priority: "high" as const,
  };
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  const hasCsrfCookie = request.cookies.has(CSRF_COOKIE_NAME);

  if (hasSessionCookie && !hasCsrfCookie) {
    response.cookies.set(
      CSRF_COOKIE_NAME,
      generateCsrfToken(),
      buildMiddlewareCsrfCookieOptions(
        new Date(Date.now() + SESSION_DURATION_SECONDS * 1000),
      ),
    );
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
