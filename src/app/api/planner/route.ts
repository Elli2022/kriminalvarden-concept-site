import { NextResponse } from "next/server";
import { getTodayDateKey } from "@/lib/date";
import { getSession } from "@/server/auth/session";
import {
  PlannerServiceError,
  getPlannerSnapshot,
} from "@/server/planner/service";
import {
  RequestSecurityError,
  assertInternalApiRequest,
  buildPrivateResponseHeaders,
  getClientIpFromHeaders,
} from "@/server/security/http";
import { consumeRateLimit } from "@/server/security/rate-limit";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Obehörig." },
      { status: 401, headers: buildPrivateResponseHeaders() },
    );
  }

  try {
    await assertInternalApiRequest(request);
    await consumeRateLimit({
      scope: "planner-read",
      key: `${session.id}:${getClientIpFromHeaders(request.headers) ?? "unknown-ip"}`,
      limit: 240,
      windowSeconds: 5 * 60,
      blockSeconds: 5 * 60,
      errorMessage:
        "For manga uppdateringar pa kort tid. Vanta en stund och forsok igen.",
    });

    const url = new URL(request.url);
    const snapshot = await getPlannerSnapshot({
      departmentId: url.searchParams.get("departmentId") ?? undefined,
      date: url.searchParams.get("date") ?? getTodayDateKey(),
    });

    return NextResponse.json(snapshot, {
      headers: buildPrivateResponseHeaders(),
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.status,
          headers: buildPrivateResponseHeaders(
            error.retryAfterSeconds
              ? { "Retry-After": String(error.retryAfterSeconds) }
              : undefined,
          ),
        },
      );
    }

    if (error instanceof PlannerServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: buildPrivateResponseHeaders() },
      );
    }

    return NextResponse.json(
      { error: "Kunde inte hämta planeringsdata." },
      { status: 500, headers: buildPrivateResponseHeaders() },
    );
  }
}
