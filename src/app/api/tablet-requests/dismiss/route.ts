import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import {
  PlannerServiceError,
  dismissTabletRequest,
} from "@/server/planner/service";

const dismissSchema = z.object({
  requestId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const rawBody = await request.json();
    const payload = dismissSchema.parse(rawBody);

    await dismissTabletRequest(payload.requestId, session);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof PlannerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Ogiltigt önskemål." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Kunde inte avfärda önskemålet." },
      { status: 500 },
    );
  }
}
