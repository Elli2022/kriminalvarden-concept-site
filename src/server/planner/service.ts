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
  PlannerServiceError,
  type MutableBookingDraft,
} from "./service-types";

export { PlannerServiceError };

async function loadPrismaPlannerService() {
  return import("./prisma-service");
}

export async function getPlannerSnapshot(input: {
  departmentId?: string;
  date?: string;
}): Promise<PlannerSnapshot> {
  if (isNetlifyDemoMode()) {
    return getPlannerSnapshotFromNetlifyDemo(input);
  }

  const { getPlannerSnapshotFromPrisma } = await loadPrismaPlannerService();
  return getPlannerSnapshotFromPrisma(input);
}

export async function createBooking(
  draft: MutableBookingDraft,
  actor: AuthenticatedUser,
): Promise<Booking> {
  if (isNetlifyDemoMode()) {
    return createBookingInNetlifyDemo(draft, actor);
  }

  const { createBookingInPrisma } = await loadPrismaPlannerService();
  return createBookingInPrisma(draft, actor);
}

export async function deleteBooking(bookingId: string, actor: AuthenticatedUser) {
  if (isNetlifyDemoMode()) {
    return deleteBookingInNetlifyDemo(bookingId, actor);
  }

  const { deleteBookingInPrisma } = await loadPrismaPlannerService();
  return deleteBookingInPrisma(bookingId, actor);
}

export async function dismissTabletRequest(
  requestId: string,
  actor: AuthenticatedUser,
) {
  if (isNetlifyDemoMode()) {
    return dismissTabletRequestInNetlifyDemo(requestId, actor);
  }

  const { dismissTabletRequestInPrisma } = await loadPrismaPlannerService();
  return dismissTabletRequestInPrisma(requestId, actor);
}

export async function recordLogin(actor: AuthenticatedUser) {
  if (isNetlifyDemoMode()) {
    return recordLoginInNetlifyDemo(actor);
  }

  const { recordLoginInPrisma } = await loadPrismaPlannerService();
  return recordLoginInPrisma(actor);
}

export async function recordLogout(actor: AuthenticatedUser) {
  if (isNetlifyDemoMode()) {
    return recordLogoutInNetlifyDemo(actor);
  }

  const { recordLogoutInPrisma } = await loadPrismaPlannerService();
  return recordLogoutInPrisma(actor);
}
