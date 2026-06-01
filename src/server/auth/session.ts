import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { AuthenticatedUser, StaffRole } from "@/lib/planner-domain";

const SESSION_COOKIE = "kv_planner_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

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

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    return "dev-only-auth-secret-change-me";
  }

  throw new Error("AUTH_SECRET saknas i produktionsmiljon.");
}

function getSigningKey() {
  return new TextEncoder().encode(getAuthSecret());
}

export async function createSession(user: AuthenticatedUser) {
  const cookieStore = await cookies();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSigningKey());

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const result = await jwtVerify(token, getSigningKey());
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
