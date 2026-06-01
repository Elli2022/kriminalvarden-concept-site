import "server-only";

import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import type { AuthenticatedUser, StaffRole } from "@/lib/planner-domain";
import { prisma } from "@/server/db";

function mapRole(role: UserRole): StaffRole {
  switch (role) {
    case "ADMIN":
      return "admin";
    case "SUPERVISOR":
      return "supervisor";
    default:
      return "officer";
  }
}

export async function authenticateStaffUser(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const user = await prisma.staffUser.findUnique({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: mapRole(user.role),
  };
}
