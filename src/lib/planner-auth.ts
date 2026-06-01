import type { BookingSource, StaffRole } from "./planner-domain";

export function isPrivilegedPlannerRole(role: StaffRole) {
  return role === "admin" || role === "supervisor";
}

export function canDeleteBooking(role: StaffRole) {
  return isPrivilegedPlannerRole(role);
}

export function canDismissTabletRequest(role: StaffRole) {
  return isPrivilegedPlannerRole(role);
}

export function canUseBookingSource(role: StaffRole, source: BookingSource) {
  if (source === "integration") {
    return isPrivilegedPlannerRole(role);
  }

  return true;
}
