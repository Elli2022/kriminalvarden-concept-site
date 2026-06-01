import "server-only";

import type { AuthenticatedUser, Booking, PlannerSnapshot } from "@/lib/planner-domain";
import { isNetlifyDemoMode } from "@/server/runtime";
import {
  createBookingInNetlifyDemo,
  deleteBookingInNetlifyDemo,
  dismissTabletRequestInNetlifyDemo,
  getPlannerSnapshotFromNetlifyDemo,
  recordLoginInNetlifyDemo,
  recordLogoutInNetlifyDemo,
} from "./netlify-demo-service";
import {
  createBookingInPrisma,
  deleteBookingInPrisma,
  dismissTabletRequestInPrisma,
  getPlannerSnapshotFromPrisma,
  recordLoginInPrisma,
  recordLogoutInPrisma,
} from "./prisma-service";
import {
  PlannerServiceError,
  type MutableBookingDraft,
} from "./service-types";

export { PlannerServiceError };

export async function getPlannerSnapshot(input: {
  departmentId?: string;
  date?: string;
}): Promise<PlannerSnapshot> {
  if (isNetlifyDemoMode()) {
    return getPlannerSnapshotFromNetlifyDemo(input);
  }

  return getPlannerSnapshotFromPrisma(input);
}

export async function createBooking(
  draft: MutableBookingDraft,
  actor: AuthenticatedUser,
): Promise<Booking> {
  if (isNetlifyDemoMode()) {
    return createBookingInNetlifyDemo(draft, actor);
  }

  return createBookingInPrisma(draft, actor);
}

export async function deleteBooking(bookingId: string, actor: AuthenticatedUser) {
  if (isNetlifyDemoMode()) {
    return deleteBookingInNetlifyDemo(bookingId, actor);
  }

  return deleteBookingInPrisma(bookingId, actor);
}

export async function dismissTabletRequest(
  requestId: string,
  actor: AuthenticatedUser,
) {
  if (isNetlifyDemoMode()) {
    return dismissTabletRequestInNetlifyDemo(requestId, actor);
  }

  return dismissTabletRequestInPrisma(requestId, actor);
}

export async function recordLogin(actor: AuthenticatedUser) {
  if (isNetlifyDemoMode()) {
    return recordLoginInNetlifyDemo(actor);
  }

  return recordLoginInPrisma(actor);
}

export async function recordLogout(actor: AuthenticatedUser) {
  if (isNetlifyDemoMode()) {
    return recordLogoutInNetlifyDemo(actor);
  }

  return recordLogoutInPrisma(actor);
}
