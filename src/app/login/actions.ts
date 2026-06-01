"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticateStaffUser } from "@/server/auth/staff-auth";
import { createSession, getSession } from "@/server/auth/session";
import { recordLogin } from "@/server/planner/service";
import { RequestSecurityError, getCurrentRequestIp } from "@/server/security/http";
import { clearRateLimit, consumeRateLimit } from "@/server/security/rate-limit";

const loginSchema = z.object({
  email: z.email("Ange en giltig e-postadress."),
  password: z.string().min(1, "Ange lösenord."),
});

export interface LoginActionState {
  error: string | null;
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const requestIp = (await getCurrentRequestIp()) ?? "unknown-ip";

  try {
    await consumeRateLimit({
      scope: "login-ip",
      key: requestIp,
      limit: 10,
      windowSeconds: 15 * 60,
      blockSeconds: 30 * 60,
      errorMessage:
        "För många inloggningsförsök från samma anslutning. Vänta en stund och försök igen.",
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return {
        error: error.message,
      };
    }

    return {
      error: "Säkerhetskontrollen misslyckades. Försök igen.",
    };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Kunde inte logga in.",
    };
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  try {
    await consumeRateLimit({
      scope: "login-email",
      key: `${requestIp}:${normalizedEmail}`,
      limit: 5,
      windowSeconds: 15 * 60,
      blockSeconds: 30 * 60,
      errorMessage:
        "För många inloggningsförsök för kontot. Vänta en stund och försök igen.",
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return {
        error: error.message,
      };
    }

    return {
      error: "Säkerhetskontrollen misslyckades. Försök igen.",
    };
  }

  const user = await authenticateStaffUser(
    normalizedEmail,
    parsed.data.password,
  );

  if (!user) {
    return {
      error: "Fel e-postadress eller lösenord.",
    };
  }

  await clearRateLimit("login-email", `${requestIp}:${normalizedEmail}`);
  await createSession(user);
  await recordLogin(user);
  redirect("/");
}

export async function redirectIfAuthenticated() {
  const session = await getSession();

  if (session) {
    redirect("/");
  }
}
