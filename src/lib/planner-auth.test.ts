import { describe, expect, it } from "vitest";
import {
  canDeleteBooking,
  canDismissTabletRequest,
  canUseBookingSource,
  isPrivilegedPlannerRole,
} from "./planner-auth";

describe("planner authorization helpers", () => {
  it("treats supervisors and admins as privileged roles", () => {
    expect(isPrivilegedPlannerRole("supervisor")).toBe(true);
    expect(isPrivilegedPlannerRole("admin")).toBe(true);
    expect(isPrivilegedPlannerRole("officer")).toBe(false);
  });

  it("allows officers to create ordinary bookings but not external imports", () => {
    expect(canUseBookingSource("officer", "staff")).toBe(true);
    expect(canUseBookingSource("officer", "tablet")).toBe(true);
    expect(canUseBookingSource("officer", "integration")).toBe(false);
  });

  it("limits destructive actions to privileged roles", () => {
    expect(canDeleteBooking("officer")).toBe(false);
    expect(canDismissTabletRequest("officer")).toBe(false);
    expect(canDeleteBooking("admin")).toBe(true);
    expect(canDismissTabletRequest("supervisor")).toBe(true);
  });
});
