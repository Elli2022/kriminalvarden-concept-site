import { NextResponse } from "next/server";
import { z } from "zod";
import { isActivityId, isDepartmentId } from "@/lib/planner-config";
import type { ActivityId, DepartmentId } from "@/lib/planner-domain";
import { getSession } from "@/server/auth/session";
import {
  PlannerServiceError,
  createBooking,
  deleteBooking,
} from "@/server/planner/service";

const bookingSchema = z.object({
  date: z.string().min(1),
  departmentId: z.custom<DepartmentId>((value) => {
    return typeof value === "string" && isDepartmentId(value);
  }, {
    message: "Ogiltig avdelning.",
  }),
  clientNumber: z.coerce.number().int(),
  activityId: z.custom<ActivityId>((value) => {
    return typeof value === "string" && isActivityId(value);
  }, {
    message: "Ogiltig aktivitet.",
  }),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  source: z.enum(["staff", "tablet", "integration"]),
  note: z.string(),
  requestId: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const rawBody = await request.json();
    const payload = bookingSchema.parse(rawBody);
    const booking = await createBooking(
      {
        ...payload,
        requestId: payload.requestId ?? null,
      },
      session,
    );

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    if (error instanceof PlannerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Ogiltig bokning." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Kunde inte skapa bokningen." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const bookingId = url.searchParams.get("bookingId");

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId saknas." }, { status: 400 });
    }

    await deleteBooking(bookingId, session);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof PlannerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Kunde inte ta bort bokningen." },
      { status: 500 },
    );
  }
}
