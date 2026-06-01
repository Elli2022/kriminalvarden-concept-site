import "server-only";

import type { AuthenticatedUser } from "@/lib/planner-domain";

export const DEMO_PASSWORD = "demo-anstalt-2026";

export const DEMO_STAFF_USERS: AuthenticatedUser[] = [
  {
    id: "demo-admin",
    email: "admin@kriminalvarden.local",
    name: "Administratör",
    role: "admin",
  },
  {
    id: "demo-supervisor",
    email: "arbetsledare@kriminalvarden.local",
    name: "Arbetsledare",
    role: "supervisor",
  },
];
