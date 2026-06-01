import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/server/auth/session";
import { recordLogout } from "@/server/planner/service";

export async function POST() {
  const session = await getSession();

  if (session) {
    await recordLogout(session);
  }

  await clearSession();
  return new NextResponse(null, { status: 204 });
}
