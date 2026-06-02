import { describe, expect, it } from "vitest";
import {
  buildClientDirectory,
  createBookingFromDraft,
  findConflictingBooking,
  toTimeMinutes,
  validateBookingDraft,
  type Booking,
  type DepartmentDefinition,
} from "./planner-domain";

describe("buildClientDirectory", () => {
  it("creates every client number across configured departments", () => {
    const departments: DepartmentDefinition[] = [
      { id: "5.1", label: "Avdelning 5.1", clientStart: 501, clientEnd: 503 },
      { id: "5.2", label: "Avdelning 5.2", clientStart: 514, clientEnd: 515 },
    ];

    const clients = buildClientDirectory(departments);

    expect(clients).toHaveLength(5);
    expect(clients[0]?.clientNumber).toBe(501);
    expect(clients[0]?.intakeNumber).toBe("22/400");
    expect(clients[0]?.label).toBe("Cell 501");
    expect(clients.at(-1)?.clientNumber).toBe(515);
  });

  it("keeps explicit intake overrides for known cells", () => {
    const departments: DepartmentDefinition[] = [
      { id: "5.1", label: "Avdelning 5.1", clientStart: 505, clientEnd: 505 },
    ];

    const clients = buildClientDirectory(departments);

    expect(clients[0]?.intakeNumber).toBe("22/404");
  });
});

describe("time helpers", () => {
  it("parses valid times to minutes", () => {
    expect(toTimeMinutes("08:30")).toBe(510);
  });

  it("rejects invalid times", () => {
    expect(Number.isNaN(toTimeMinutes("25:90"))).toBe(true);
  });
});

describe("booking conflicts", () => {
  const existingBooking: Booking = {
    id: "booking-1",
    date: "2026-06-01",
    departmentId: "5.1",
    clientNumber: 501,
    activityId: "walk",
    startTime: "09:00",
    endTime: "09:45",
    source: "staff",
    note: "",
    createdAt: "2026-06-01T07:00:00.000Z",
    requestId: null,
  };

  it("finds an overlapping booking for the same client", () => {
    const conflict = findConflictingBooking(
      {
        date: "2026-06-01",
        departmentId: "5.1",
        clientNumber: 501,
        activityId: "visit",
        startTime: "09:30",
        endTime: "10:15",
        source: "staff",
        note: "",
        requestId: null,
      },
      [existingBooking],
    );

    expect(conflict?.id).toBe(existingBooking.id);
  });

  it("allows back-to-back bookings", () => {
    const validation = validateBookingDraft(
      {
        date: "2026-06-01",
        departmentId: "5.1",
        clientNumber: 501,
        activityId: "visit",
        startTime: "09:45",
        endTime: "10:15",
        source: "staff",
        note: "",
        requestId: null,
      },
      [existingBooking],
    );

    expect(validation.ok).toBe(true);
  });

  it("creates a booking only when validation passes", () => {
    const result = createBookingFromDraft(
      {
        date: "2026-06-01",
        departmentId: "5.1",
        clientNumber: 501,
        activityId: "visit",
        startTime: "10:00",
        endTime: "10:30",
        source: "staff",
        note: "",
        requestId: null,
      },
      [existingBooking],
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.booking.activityId).toBe("visit");
    }
  });
});
