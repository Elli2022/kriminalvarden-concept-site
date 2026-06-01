import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import {
  PlannerServiceError,
  dismissTabletRequest,
} from "@/server/planner/service";
import {
  RequestSecurityError,
  assertInternalApiRequest,
  buildPrivateResponseHeaders,
  getClientIpFromHeaders,
} from "@/server/security/http";
import { consumeRateLimit } from "@/server/security/rate-limit";

const dismissSchema = z.object({
  requestId: z.string().trim().min(1).max(120),
});

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Obehörig." },
      { status: 401, headers: buildPrivateResponseHeaders() },
    );
  }

  try {
    await assertInternalApiRequest(request, {
      requireJson: true,
      requireCsrf: true,
    });
    await consumeRateLimit({
      scope: "planner-write",
      key: `${session.id}:${getClientIpFromHeaders(request.headers) ?? "unknown-ip"}`,
      limit: 60,
      windowSeconds: 5 * 60,
      blockSeconds: 5 * 60,
      errorMessage: "For manga andringar pa kort tid. Vanta lite och forsok igen.",
    });

    const rawBody = await request.json();
    const payload = dismissSchema.parse(rawBody);

    await dismissTabletRequest(payload.requestId, session);
    return new NextResponse(null, {
      status: 204,
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

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Ogiltigt önskemål." },
        { status: 400, headers: buildPrivateResponseHeaders() },
      );
    }

    return NextResponse.json(
      { error: "Kunde inte avfärda önskemålet." },
      { status: 500, headers: buildPrivateResponseHeaders() },
    );
  }
}
