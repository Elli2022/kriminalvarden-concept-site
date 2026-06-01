import "server-only";

import { cookies, headers as nextHeaders } from "next/headers";
import {
  CSRF_COOKIE_NAME,
  INTERNAL_API_CLIENT_HEADER,
  INTERNAL_API_CLIENT_VALUE,
} from "@/lib/security-constants";

export class RequestSecurityError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status = 403, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function normalizeOrigin(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function buildPrivateResponseHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  headers.set(
    "Cache-Control",
    "private, no-store, no-cache, max-age=0, must-revalidate",
  );
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("Vary", "Cookie");

  return headers;
}

export function getClientIpFromHeaders(headerStore: Headers) {
  const directIp = headerStore.get("x-nf-client-connection-ip");

  if (directIp) {
    return directIp.trim();
  }

  const forwardedFor = headerStore.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  const realIp = headerStore.get("x-real-ip");

  if (realIp) {
    return realIp.trim();
  }

  const cloudflareIp = headerStore.get("cf-connecting-ip");

  if (cloudflareIp) {
    return cloudflareIp.trim();
  }

  const forwarded = headerStore.get("forwarded");

  if (!forwarded) {
    return null;
  }

  const match = forwarded.match(/for="?([^;,\s"]+)/i);
  return match?.[1] ?? null;
}

export async function getCurrentRequestIp() {
  return getClientIpFromHeaders(await nextHeaders());
}

export async function assertInternalApiRequest(
  request: Request,
  options?: {
    requireJson?: boolean;
    requireCsrf?: boolean;
  },
) {
  const requireJson = options?.requireJson ?? false;
  const requireCsrf = options?.requireCsrf ?? false;

  if (
    request.headers.get(INTERNAL_API_CLIENT_HEADER) !==
    INTERNAL_API_CLIENT_VALUE
  ) {
    throw new RequestSecurityError("Otillåten begäran.", 403);
  }

  if (requireJson) {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      throw new RequestSecurityError("Begäran måste skickas som JSON.", 415);
    }
  }

  if (!requireCsrf) {
    return;
  }

  const requestOrigin = normalizeOrigin(request.url);
  const originHeader = normalizeOrigin(request.headers.get("origin"));

  if (!requestOrigin || !originHeader || requestOrigin !== originHeader) {
    throw new RequestSecurityError("Otillåten begäran.", 403);
  }

  const csrfHeader = request.headers.get("x-csrf-token");
  const csrfCookie = (await cookies()).get(CSRF_COOKIE_NAME)?.value;

  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    throw new RequestSecurityError("Säkerhetskontrollen misslyckades.", 403);
  }
}
