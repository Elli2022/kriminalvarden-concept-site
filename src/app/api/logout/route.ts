import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/server/auth/session";
import { recordLogout } from "@/server/planner/service";
import {
  RequestSecurityError,
  assertInternalApiRequest,
  buildPrivateResponseHeaders,
} from "@/server/security/http";

export async function POST(request: Request) {
  try {
    await assertInternalApiRequest(request, {
      requireCsrf: true,
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: buildPrivateResponseHeaders() },
      );
    }

    return NextResponse.json(
      { error: "Kunde inte logga ut." },
      { status: 500, headers: buildPrivateResponseHeaders() },
    );
  }

  const session = await getSession();

  if (session) {
    await recordLogout(session);
  }

  await clearSession();
  return new NextResponse(null, {
    status: 204,
    headers: buildPrivateResponseHeaders(),
  });
}
