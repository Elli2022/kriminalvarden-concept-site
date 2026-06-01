import { NextResponse } from "next/server";
import { getTodayDateKey } from "@/lib/date";
import { getSession } from "@/server/auth/session";
import {
  PlannerServiceError,
  getPlannerSnapshot,
} from "@/server/planner/service";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Obehörig." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const snapshot = await getPlannerSnapshot({
      departmentId: url.searchParams.get("departmentId") ?? undefined,
      date: url.searchParams.get("date") ?? getTodayDateKey(),
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof PlannerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Kunde inte hämta planeringsdata." },
      { status: 500 },
    );
  }
}
