import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CLIENT_BY_NUMBER,
  isActivityId,
  isDepartmentId,
} from "@/lib/planner-config";
import type { ActivityId, DepartmentId } from "@/lib/planner-domain";
import { MAX_NOTE_LENGTH } from "@/lib/security-constants";
import { getSession } from "@/server/auth/session";
import {
  PlannerServiceError,
  createBooking,
  deleteBooking,
} from "@/server/planner/service";
import {
  RequestSecurityError,
  assertInternalApiRequest,
  buildPrivateResponseHeaders,
  getClientIpFromHeaders,
} from "@/server/security/http";
import { consumeRateLimit } from "@/server/security/rate-limit";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ogiltigt datum.");
const timeSchema = z.string().regex(
  /^([01]\d|2[0-3]):[0-5]\d$/,
  "Ogiltig tid.",
);
const idSchema = z.string().trim().min(1).max(120);

const bookingSchema = z.object({
  date: dateSchema,
  departmentId: z.custom<DepartmentId>((value) => {
    return typeof value === "string" && isDepartmentId(value);
  }, {
    message: "Ogiltig avdelning.",
  }),
  clientNumber: z.coerce.number().int().refine((value) => {
    return CLIENT_BY_NUMBER[value] != null;
  }, {
    message: "Ogiltigt klientnummer.",
  }),
  activityId: z.custom<ActivityId>((value) => {
    return typeof value === "string" && isActivityId(value);
  }, {
    message: "Ogiltig aktivitet.",
  }),
  startTime: timeSchema,
  endTime: timeSchema,
  source: z.enum(["staff", "tablet", "integration"]),
  note: z.string().trim().max(MAX_NOTE_LENGTH, "Anteckningen ar for lang."),
  requestId: idSchema.nullable().optional(),
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
    const payload = bookingSchema.parse(rawBody);
    const booking = await createBooking(
      {
        ...payload,
        requestId: payload.requestId ?? null,
      },
      session,
    );

    return NextResponse.json(
      { booking },
      { status: 201, headers: buildPrivateResponseHeaders() },
    );
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
        { error: error.issues[0]?.message ?? "Ogiltig bokning." },
        { status: 400, headers: buildPrivateResponseHeaders() },
      );
    }

    return NextResponse.json(
      { error: "Kunde inte skapa bokningen." },
      { status: 500, headers: buildPrivateResponseHeaders() },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Obehörig." },
      { status: 401, headers: buildPrivateResponseHeaders() },
    );
  }

  try {
    await assertInternalApiRequest(request, {
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

    const url = new URL(request.url);
    const bookingId = idSchema.parse(url.searchParams.get("bookingId"));

    if (!bookingId) {
      return NextResponse.json(
        { error: "bookingId saknas." },
        { status: 400, headers: buildPrivateResponseHeaders() },
      );
    }

    await deleteBooking(bookingId, session);
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
        { error: error.issues[0]?.message ?? "bookingId saknas." },
        { status: 400, headers: buildPrivateResponseHeaders() },
      );
    }

    return NextResponse.json(
      { error: "Kunde inte ta bort bokningen." },
      { status: 500, headers: buildPrivateResponseHeaders() },
    );
  }
}
