import "server-only";

import {
  SESSION_DURATION_SECONDS,
} from "@/lib/security-constants";

function shouldUseSecureCookies() {
  return process.env.NODE_ENV === "production";
}

function createBaseCookieOptions(expiresAt: Date) {
  return {
    sameSite: "strict" as const,
    secure: shouldUseSecureCookies(),
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_DURATION_SECONDS,
    priority: "high" as const,
  };
}

export function buildSessionCookieOptions(expiresAt: Date) {
  return {
    ...createBaseCookieOptions(expiresAt),
    httpOnly: true,
  };
}

export function buildCsrfCookieOptions(expiresAt: Date) {
  return {
    ...createBaseCookieOptions(expiresAt),
    httpOnly: false,
  };
}

export function buildExpiredCookieOptions(httpOnly: boolean) {
  return {
    sameSite: "strict" as const,
    secure: shouldUseSecureCookies(),
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    priority: "high" as const,
    httpOnly,
  };
}
