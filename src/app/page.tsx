import { PlannerApp } from "@/components/planner-app";
import { getTodayDateKey } from "@/lib/date";
import { DEFAULT_DEPARTMENT_ID } from "@/lib/planner-config";
import { requirePageSession } from "@/server/auth/session";
import { getPlannerSnapshot } from "@/server/planner/service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await requirePageSession();
  const initialSnapshot = await getPlannerSnapshot({
    departmentId: DEFAULT_DEPARTMENT_ID,
    date: getTodayDateKey(),
  });

  return <PlannerApp session={session} initialSnapshot={initialSnapshot} />;
}
