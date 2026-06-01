"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticateStaffUser } from "@/server/auth/staff-auth";
import { createSession, getSession } from "@/server/auth/session";
import { recordLogin } from "@/server/planner/service";

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
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Kunde inte logga in.",
    };
  }

  const user = await authenticateStaffUser(
    parsed.data.email,
    parsed.data.password,
  );

  if (!user) {
    return {
      error: "Fel e-postadress eller lösenord.",
    };
  }

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
