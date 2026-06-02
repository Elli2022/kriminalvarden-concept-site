import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { AuthenticatedUser, StaffRole } from "@/lib/planner-domain";
import {
  CSRF_COOKIE_NAME,
  SESSION_AUDIENCE,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  SESSION_ISSUER,
  generateCsrfToken,
} from "@/lib/security-constants";
import {
  buildCsrfCookieOptions,
  buildExpiredCookieOptions,
  buildSessionCookieOptions,
} from "@/server/security/cookies";

interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: StaffRole;
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.sub === "string" &&
    typeof payload.email === "string" &&
    typeof payload.name === "string" &&
    (payload.role === "officer" ||
      payload.role === "supervisor" ||
      payload.role === "admin")
  );
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  const developmentFallbackSecret = "dev-only-auth-secret-change-me-32-chars";

  if (secret) {
    if (secret.length >= 32) {
      return secret;
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET maste vara minst 32 tecken.");
    }

    return developmentFallbackSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return developmentFallbackSecret;
  }

  throw new Error("AUTH_SECRET saknas i produktionsmiljon.");
}

function getSigningKey() {
  return new TextEncoder().encode(getAuthSecret());
}

export async function createSession(user: AuthenticatedUser) {
  const cookieStore = await cookies();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
  const csrfToken = generateCsrfToken();

  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSigningKey());

  cookieStore.set(SESSION_COOKIE_NAME, token, buildSessionCookieOptions(expiresAt));
  cookieStore.set(CSRF_COOKIE_NAME, csrfToken, buildCsrfCookieOptions(expiresAt));
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", buildExpiredCookieOptions(true));
  cookieStore.set(CSRF_COOKIE_NAME, "", buildExpiredCookieOptions(false));
}

export async function getSession(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const result = await jwtVerify(token, getSigningKey(), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    const payload = result.payload;

    if (!isSessionPayload(payload)) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function requirePageSession(): Promise<AuthenticatedUser> {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}
