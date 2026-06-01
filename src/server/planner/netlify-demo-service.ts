import "server-only";

import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { getTodayDateKey } from "@/lib/date";
import {
  ACTIVITY_BY_ID,
  CLIENT_BY_NUMBER,
  CLIENT_DIRECTORY,
  DEFAULT_DEPARTMENT_ID,
  DEPARTMENTS,
  isActivityId,
  isDepartmentId,
} from "@/lib/planner-config";
import {
  overlaps,
  toTimeMinutes,
  type ActivityId,
  type AuthenticatedUser,
  type Booking,
  type DepartmentId,
  type PlannerDepartmentOverview,
  type PlannerSnapshot,
  type TabletRequest,
} from "@/lib/planner-domain";
import {
  PlannerServiceError,
  type MutableBookingDraft,
} from "./service-types";

type DemoAuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "BOOKING_CREATED"
  | "BOOKING_DELETED"
  | "REQUEST_DISMISSED";

interface DemoAuditEvent {
  id: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: DemoAuditAction;
  summary: string;
  payload?: string;
  createdAt: string;
}

interface DemoPlannerState {
  version: 1;
  seedDate: string;
  updatedAt: string | null;
  bookings: Booking[];
  requests: TabletRequest[];
  auditEvents: DemoAuditEvent[];
}

const STORE_NAME = "planner-demo";
const STATE_KEY = "state";

function ensureDepartmentId(value: string): DepartmentId {
  if (!isDepartmentId(value)) {
    throw new PlannerServiceError("Ogiltig avdelning.", 400);
  }

  return value;
}

function ensureActivityId(value: string): ActivityId {
  if (!isActivityId(value)) {
    throw new PlannerServiceError("Ogiltig aktivitet.", 400);
  }

  return value;
}

function isoOffset(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function createSeedRequests(date: string): TabletRequest[] {
  return [
    {
      id: "request-502-activation",
      date,
      departmentId: "5.1",
      clientNumber: 502,
      requestedActivityIds: ["activation", "walk"],
      preferredWindow: {
        startTime: "13:30",
        endTime: "14:15",
      },
      note: "Behöver personalens bekräftelse.",
      submittedAt: isoOffset(18),
      status: "scheduled",
    },
    {
      id: "request-506-isolation-break",
      date,
      departmentId: "5.1",
      clientNumber: 506,
      requestedActivityIds: ["isolation-break"],
      preferredWindow: {
        startTime: "07:30",
        endTime: "08:15",
      },
      note: "Intresse markerat på padda.",
      submittedAt: isoOffset(17),
      status: "open",
    },
    {
      id: "request-510-walk",
      date,
      departmentId: "5.1",
      clientNumber: 510,
      requestedActivityIds: ["walk", "shower"],
      preferredWindow: {
        startTime: "09:00",
        endTime: "09:45",
      },
      note: "Klienten önskar aktivitet före lunch.",
      submittedAt: isoOffset(16),
      status: "open",
    },
    {
      id: "request-518-training",
      date,
      departmentId: "5.2",
      clientNumber: 518,
      requestedActivityIds: ["training"],
      preferredWindow: {
        startTime: "08:00",
        endTime: "08:45",
      },
      note: "Önskemål inlagt under morgonrutin.",
      submittedAt: isoOffset(15),
      status: "open",
    },
    {
      id: "request-531-activation",
      date,
      departmentId: "5.3",
      clientNumber: 531,
      requestedActivityIds: ["activation"],
      preferredWindow: {
        startTime: "13:00",
        endTime: "13:45",
      },
      note: "Klienten vill ha uppföljning.",
      submittedAt: isoOffset(14),
      status: "open",
    },
    {
      id: "request-604-walk",
      date,
      departmentId: "6.1",
      clientNumber: 604,
      requestedActivityIds: ["walk"],
      preferredWindow: {
        startTime: "10:00",
        endTime: "10:45",
      },
      note: "Intresse för promenad markerat i padda-systemet.",
      submittedAt: isoOffset(13),
      status: "open",
    },
    {
      id: "request-648-isolation-break",
      date,
      departmentId: "6.4",
      clientNumber: 648,
      requestedActivityIds: ["isolation-break"],
      preferredWindow: {
        startTime: "11:00",
        endTime: "11:45",
      },
      note: "Intresse för isoleringsbrytande aktivitet.",
      submittedAt: isoOffset(12),
      status: "open",
    },
  ];
}

function createSeedBookings(date: string): Booking[] {
  return [
    {
      id: "booking-501-walk",
      date,
      departmentId: "5.1",
      clientNumber: 501,
      activityId: "walk",
      startTime: "08:15",
      endTime: "09:00",
      source: "staff",
      note: "Morgonrutin",
      createdAt: isoOffset(28),
      requestId: null,
    },
    {
      id: "booking-503-shower",
      date,
      departmentId: "5.1",
      clientNumber: 503,
      activityId: "shower",
      startTime: "07:20",
      endTime: "07:40",
      source: "staff",
      note: "",
      createdAt: isoOffset(27),
      requestId: null,
    },
    {
      id: "booking-512-visit",
      date,
      departmentId: "5.1",
      clientNumber: 512,
      activityId: "visit",
      startTime: "13:00",
      endTime: "14:00",
      source: "staff",
      note: "Bekräftat besök",
      createdAt: isoOffset(26),
      requestId: null,
    },
    {
      id: "booking-518-interview",
      date,
      departmentId: "5.2",
      clientNumber: 518,
      activityId: "interview",
      startTime: "10:00",
      endTime: "11:30",
      source: "integration",
      note: "Importerat från extern planering",
      createdAt: isoOffset(25),
      requestId: null,
    },
    {
      id: "booking-531-activation",
      date,
      departmentId: "5.3",
      clientNumber: 531,
      activityId: "activation",
      startTime: "09:10",
      endTime: "09:50",
      source: "staff",
      note: "",
      createdAt: isoOffset(24),
      requestId: null,
    },
    {
      id: "booking-604-healthcare",
      date,
      departmentId: "6.1",
      clientNumber: 604,
      activityId: "healthcare",
      startTime: "14:15",
      endTime: "15:00",
      source: "integration",
      note: "Tidsatt sjukvård",
      createdAt: isoOffset(23),
      requestId: null,
    },
    {
      id: "booking-648-isolation-break",
      date,
      departmentId: "6.4",
      clientNumber: 648,
      activityId: "isolation-break",
      startTime: "11:00",
      endTime: "11:45",
      source: "staff",
      note: "Planerad aktivitet",
      createdAt: isoOffset(22),
      requestId: null,
    },
    {
      id: "booking-502-activation",
      date,
      departmentId: "5.1",
      clientNumber: 502,
      activityId: "activation",
      startTime: "13:30",
      endTime: "14:15",
      source: "tablet",
      note: "Schemalagd från padda",
      createdAt: isoOffset(21),
      requestId: "request-502-activation",
    },
  ];
}

function createInitialState(date = getTodayDateKey()): DemoPlannerState {
  return {
    version: 1,
    seedDate: date,
    updatedAt: new Date().toISOString(),
    bookings: createSeedBookings(date),
    requests: createSeedRequests(date),
    auditEvents: [],
  };
}

function buildDepartmentOverviews(
  state: DemoPlannerState,
  date: string,
): PlannerDepartmentOverview[] {
  return DEPARTMENTS.map((department) => ({
    id: department.id,
    label: department.label,
    clientCount: department.clientEnd - department.clientStart + 1,
    openRequestCount: state.requests.filter(
      (request) =>
        request.departmentId === department.id &&
        request.date === date &&
        request.status === "open",
    ).length,
  }));
}

function appendAuditEvent(
  state: DemoPlannerState,
  input: {
    actorId?: string | null;
    entityType: string;
    entityId: string;
    action: DemoAuditAction;
    summary: string;
    payload?: string;
  },
) {
  state.auditEvents.unshift({
    id: randomUUID(),
    actorId: input.actorId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    summary: input.summary,
    payload: input.payload,
    createdAt: new Date().toISOString(),
  });

  state.auditEvents = state.auditEvents.slice(0, 200);
}

async function loadStateEntry() {
  const store = getStore(STORE_NAME);
  const entry = await store.getWithMetadata(STATE_KEY, { type: "json" });

  if (entry === null) {
    const initialState = createInitialState();
    const created = await store.setJSON(STATE_KEY, initialState, {
      onlyIfNew: true,
    });

    if (created.modified) {
      return {
        store,
        state: initialState,
        etag: created.etag ?? null,
      };
    }

    return loadStateEntry();
  }

  const state = entry.data as DemoPlannerState;
  const today = getTodayDateKey();

  if (state.seedDate !== today) {
    const refreshedState = createInitialState(today);
    const refreshed = await store.setJSON(STATE_KEY, refreshedState, {
      onlyIfMatch: entry.etag,
    });

    if (refreshed.modified) {
      return {
        store,
        state: refreshedState,
        etag: refreshed.etag ?? null,
      };
    }

    return loadStateEntry();
  }

  return {
    store,
    state,
    etag: entry.etag,
  };
}

async function updateState<T>(
  update: (state: DemoPlannerState) => T | Promise<T>,
) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const entry = await loadStateEntry();
    const nextState = structuredClone(entry.state);
    const result = await update(nextState);
    const saved = await entry.store.setJSON(STATE_KEY, nextState, {
      onlyIfMatch: entry.etag ?? undefined,
    });

    if (saved.modified) {
      return result;
    }
  }

  throw new PlannerServiceError(
    "Kunde inte spara ändringen just nu. Försök igen.",
    409,
  );
}

export async function getPlannerSnapshotFromNetlifyDemo(input: {
  departmentId?: string;
  date?: string;
}): Promise<PlannerSnapshot> {
  const departmentId = ensureDepartmentId(
    input.departmentId ?? DEFAULT_DEPARTMENT_ID,
  );
  const date = input.date ?? "";

  if (!date) {
    throw new PlannerServiceError("Datum saknas.", 400);
  }

  const { state } = await loadStateEntry();

  return {
    date,
    departmentId,
    departments: buildDepartmentOverviews(state, date),
    clients: CLIENT_DIRECTORY.filter(
      (client) => client.departmentId === departmentId,
    ),
    bookings: state.bookings.filter(
      (booking) => booking.departmentId === departmentId && booking.date === date,
    ),
    requests: state.requests.filter(
      (request) => request.departmentId === departmentId && request.date === date,
    ),
    lastUpdatedAt: state.updatedAt,
  };
}

export async function createBookingInNetlifyDemo(
  draft: MutableBookingDraft,
  actor: AuthenticatedUser,
): Promise<Booking> {
  const departmentId = ensureDepartmentId(draft.departmentId);
  const activityId = ensureActivityId(draft.activityId);
  const startMinute = toTimeMinutes(draft.startTime);
  const endMinute = toTimeMinutes(draft.endTime);

  if (!draft.date) {
    throw new PlannerServiceError("Datum saknas.", 400);
  }

  if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute)) {
    throw new PlannerServiceError("Tiderna måste vara giltiga.", 400);
  }

  if (endMinute <= startMinute) {
    throw new PlannerServiceError(
      "Sluttiden måste vara senare än starttiden.",
      400,
    );
  }

  const client = CLIENT_BY_NUMBER[draft.clientNumber];

  if (!client || client.departmentId !== departmentId) {
    throw new PlannerServiceError(
      "Klienten finns inte på den valda avdelningen.",
      400,
    );
  }

  return updateState((state) => {
    const conflict = state.bookings.find((booking) => {
      if (booking.clientNumber !== draft.clientNumber || booking.date !== draft.date) {
        return false;
      }

      return overlaps(
        toTimeMinutes(booking.startTime),
        toTimeMinutes(booking.endTime),
        startMinute,
        endMinute,
      );
    });

    if (conflict) {
      throw new PlannerServiceError(
        `Klienten är redan bokad under delar av den tiden. Krockar med ${ACTIVITY_BY_ID[conflict.activityId].label} ${conflict.startTime}-${conflict.endTime}.`,
        409,
      );
    }

    if (draft.requestId) {
      const request = state.requests.find((entry) => entry.id === draft.requestId);

      if (!request) {
        throw new PlannerServiceError("Padda-önskemålet hittades inte.", 404);
      }

      if (request.status === "dismissed") {
        throw new PlannerServiceError(
          "Önskemålet är redan avfärdat och kan inte bokas.",
          409,
        );
      }

      if (request.status === "scheduled") {
        throw new PlannerServiceError("Önskemålet är redan schemalagt.", 409);
      }

      request.status = "scheduled";
    }

    const booking: Booking = {
      id: randomUUID(),
      date: draft.date,
      departmentId,
      clientNumber: draft.clientNumber,
      activityId,
      startTime: draft.startTime,
      endTime: draft.endTime,
      source: draft.source,
      note: draft.note.trim(),
      createdAt: new Date().toISOString(),
      requestId: draft.requestId ?? null,
    };

    state.bookings.push(booking);
    state.updatedAt = booking.createdAt;
    appendAuditEvent(state, {
      actorId: actor.id,
      entityType: "booking",
      entityId: booking.id,
      action: "BOOKING_CREATED",
      summary: `Bokning skapad för klient ${booking.clientNumber} ${booking.startTime}-${booking.endTime}.`,
    });

    return booking;
  });
}

export async function deleteBookingInNetlifyDemo(
  bookingId: string,
  actor: AuthenticatedUser,
) {
  await updateState((state) => {
    const bookingIndex = state.bookings.findIndex((booking) => booking.id === bookingId);

    if (bookingIndex === -1) {
      throw new PlannerServiceError("Bokningen hittades inte.", 404);
    }

    const [booking] = state.bookings.splice(bookingIndex, 1);

    if (booking.requestId) {
      const request = state.requests.find((entry) => entry.id === booking.requestId);

      if (request) {
        request.status = "open";
      }
    }

    state.updatedAt = new Date().toISOString();
    appendAuditEvent(state, {
      actorId: actor.id,
      entityType: "booking",
      entityId: booking.id,
      action: "BOOKING_DELETED",
      summary: `Bokning borttagen för klient ${booking.clientNumber}.`,
    });
  });
}

export async function dismissTabletRequestInNetlifyDemo(
  requestId: string,
  actor: AuthenticatedUser,
) {
  await updateState((state) => {
    const request = state.requests.find((entry) => entry.id === requestId);

    if (!request) {
      throw new PlannerServiceError("Önskemålet hittades inte.", 404);
    }

    if (request.status === "scheduled") {
      throw new PlannerServiceError("Önskemålet är redan schemalagt.", 409);
    }

    request.status = "dismissed";
    state.updatedAt = new Date().toISOString();
    appendAuditEvent(state, {
      actorId: actor.id,
      entityType: "tabletRequest",
      entityId: request.id,
      action: "REQUEST_DISMISSED",
      summary: `Önskemål avfärdat för klient ${request.clientNumber}.`,
    });
  });
}

export async function recordLoginInNetlifyDemo(actor: AuthenticatedUser) {
  await updateState((state) => {
    appendAuditEvent(state, {
      actorId: actor.id,
      entityType: "session",
      entityId: actor.id,
      action: "LOGIN",
      summary: `Inloggning för ${actor.email}.`,
    });
  });
}

export async function recordLogoutInNetlifyDemo(actor: AuthenticatedUser) {
  await updateState((state) => {
    appendAuditEvent(state, {
      actorId: actor.id,
      entityType: "session",
      entityId: actor.id,
      action: "LOGOUT",
      summary: `Utloggning för ${actor.email}.`,
    });
  });
}
