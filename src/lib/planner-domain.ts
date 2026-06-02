export type DepartmentId =
  | "5.1"
  | "5.2"
  | "5.3"
  | "5.4"
  | "6.1"
  | "6.2"
  | "6.3"
  | "6.4";

export type ActivityId =
  | "training"
  | "shower"
  | "newspaper"
  | "lawyer-call"
  | "activation"
  | "isolation-break"
  | "walk"
  | "healthcare"
  | "visit"
  | "interview"
  | "trial";

export type BookingSource = "staff" | "tablet" | "integration";
export type TabletRequestStatus = "open" | "scheduled" | "dismissed";
export type StaffRole = "officer" | "supervisor" | "admin";

export interface DepartmentDefinition {
  id: DepartmentId;
  label: string;
  clientStart: number;
  clientEnd: number;
}

export interface ActivityDefinition {
  id: ActivityId;
  label: string;
  shortLabel: string;
  requestable: boolean;
  colorToken: string;
}

export interface ClientRecord {
  departmentId: DepartmentId;
  clientNumber: number;
  intakeNumber: string;
  label: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
}

export interface Booking {
  id: string;
  date: string;
  departmentId: DepartmentId;
  clientNumber: number;
  activityId: ActivityId;
  startTime: string;
  endTime: string;
  source: BookingSource;
  note: string;
  createdAt: string;
  requestId: string | null;
}

export interface BookingDraft {
  date: string;
  departmentId: DepartmentId;
  clientNumber: number;
  activityId: ActivityId;
  startTime: string;
  endTime: string;
  source: BookingSource;
  note: string;
  requestId: string | null;
}

export interface TimeWindow {
  startTime: string;
  endTime: string;
}

export interface TabletRequest {
  id: string;
  date: string;
  departmentId: DepartmentId;
  clientNumber: number;
  requestedActivityIds: ActivityId[];
  preferredWindow: TimeWindow | null;
  note: string;
  submittedAt: string;
  status: TabletRequestStatus;
}

export interface PlannerDepartmentOverview {
  id: DepartmentId;
  label: string;
  clientCount: number;
  openRequestCount: number;
}

export interface PlannerSnapshot {
  date: string;
  departmentId: DepartmentId;
  departments: PlannerDepartmentOverview[];
  clients: ClientRecord[];
  bookings: Booking[];
  requests: TabletRequest[];
  lastUpdatedAt: string | null;
}

export interface BookingValidationResult {
  ok: boolean;
  errors: string[];
  conflictingBooking: Booking | null;
}

export type CreateBookingResult =
  | {
      ok: true;
      booking: Booking;
    }
  | {
      ok: false;
      error: string;
      conflictingBooking: Booking | null;
    };

export function buildClientDirectory(
  departments: DepartmentDefinition[],
): ClientRecord[] {
  const clients: ClientRecord[] = [];

  const intakeNumberOverrides: Partial<Record<number, string>> = {
    505: "22/404",
  };

  function getIntakeNumber(clientNumber: number) {
    return (
      intakeNumberOverrides[clientNumber] ??
      `22/${String(clientNumber - 101).padStart(3, "0")}`
    );
  }

  for (const department of departments) {
    for (
      let clientNumber = department.clientStart;
      clientNumber <= department.clientEnd;
      clientNumber += 1
    ) {
      clients.push({
        departmentId: department.id,
        clientNumber,
        intakeNumber: getIntakeNumber(clientNumber),
        label: `Cell ${clientNumber}`,
      });
    }
  }

  return clients;
}

export function toTimeMinutes(time: string): number {
  const [rawHours, rawMinutes] = time.split(":");
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return Number.NaN;
  }

  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

export function overlaps(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): boolean {
  return firstStart < secondEnd && secondStart < firstEnd;
}

export function sortBookingsByTime(bookings: Booking[]): Booking[] {
  return [...bookings].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    const startDifference =
      toTimeMinutes(left.startTime) - toTimeMinutes(right.startTime);

    if (startDifference !== 0) {
      return startDifference;
    }

    return left.activityId.localeCompare(right.activityId);
  });
}

export function getBookingsForClientOnDate(
  bookings: Booking[],
  clientNumber: number,
  date: string,
): Booking[] {
  return sortBookingsByTime(
    bookings.filter(
      (booking) =>
        booking.clientNumber === clientNumber && booking.date === date,
    ),
  );
}

export function getBookingsForClientActivity(
  bookings: Booking[],
  clientNumber: number,
  activityId: ActivityId,
  date: string,
): Booking[] {
  return sortBookingsByTime(
    bookings.filter(
      (booking) =>
        booking.clientNumber === clientNumber &&
        booking.activityId === activityId &&
        booking.date === date,
    ),
  );
}

export function findConflictingBooking(
  draft: BookingDraft,
  existingBookings: Booking[],
): Booking | null {
  const startMinutes = toTimeMinutes(draft.startTime);
  const endMinutes = toTimeMinutes(draft.endTime);

  if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) {
    return null;
  }

  return (
    existingBookings.find((booking) => {
      if (
        booking.date !== draft.date ||
        booking.clientNumber !== draft.clientNumber
      ) {
        return false;
      }

      return overlaps(
        startMinutes,
        endMinutes,
        toTimeMinutes(booking.startTime),
        toTimeMinutes(booking.endTime),
      );
    }) ?? null
  );
}

export function validateBookingDraft(
  draft: BookingDraft,
  existingBookings: Booking[],
): BookingValidationResult {
  const errors: string[] = [];

  if (!draft.date) {
    errors.push("Välj ett datum.");
  }

  if (!Number.isInteger(draft.clientNumber)) {
    errors.push("Välj en klient.");
  }

  if (!draft.startTime || !draft.endTime) {
    errors.push("Ange både start- och sluttid.");
  }

  const startMinutes = toTimeMinutes(draft.startTime);
  const endMinutes = toTimeMinutes(draft.endTime);

  if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) {
    errors.push("Tiderna måste vara giltiga.");
  } else if (endMinutes <= startMinutes) {
    errors.push("Sluttiden måste vara senare än starttiden.");
  }

  const conflictingBooking =
    errors.length === 0 ? findConflictingBooking(draft, existingBookings) : null;

  if (conflictingBooking) {
    errors.push("Klienten är redan bokad under delar av den tiden.");
  }

  return {
    ok: errors.length === 0,
    errors,
    conflictingBooking,
  };
}

export function createBookingFromDraft(
  draft: BookingDraft,
  existingBookings: Booking[],
): CreateBookingResult {
  const validation = validateBookingDraft(draft, existingBookings);

  if (!validation.ok) {
    return {
      ok: false,
      error: validation.errors[0],
      conflictingBooking: validation.conflictingBooking,
    };
  }

  return {
    ok: true,
    booking: {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...draft,
    },
  };
}
