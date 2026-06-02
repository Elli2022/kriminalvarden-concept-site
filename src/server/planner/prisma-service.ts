import "server-only";

import {
  AuditAction,
  BookingSource as PrismaBookingSource,
  TabletRequestStatus as PrismaTabletRequestStatus,
} from "@prisma/client";
import {
  ACTIVITY_BY_ID,
  DEFAULT_DEPARTMENT_ID,
  isActivityId,
  isDepartmentId,
} from "@/lib/planner-config";
import {
  minutesToTime,
  toTimeMinutes,
  type ActivityId,
  type AuthenticatedUser,
  type Booking,
  type BookingSource,
  type ClientRecord,
  type DepartmentId,
  type PlannerSnapshot,
  type TabletRequest,
  type TabletRequestStatus,
} from "@/lib/planner-domain";
import { prisma } from "@/server/db";
import {
  PlannerServiceError,
  type MutableBookingDraft,
} from "./service-types";

function mapBookingSource(source: PrismaBookingSource): BookingSource {
  switch (source) {
    case "TABLET":
      return "tablet";
    case "INTEGRATION":
      return "integration";
    default:
      return "staff";
  }
}

function mapRequestStatus(status: PrismaTabletRequestStatus): TabletRequestStatus {
  switch (status) {
    case "SCHEDULED":
      return "scheduled";
    case "DISMISSED":
      return "dismissed";
    default:
      return "open";
  }
}

function formatBooking(record: {
  id: string;
  dateKey: string;
  departmentId: string;
  activityTypeId: string;
  startMinute: number;
  endMinute: number;
  note: string;
  createdAt: Date;
  client: {
    clientNumber: number;
  };
  requestId: string | null;
  source: PrismaBookingSource;
}): Booking {
  return {
    id: record.id,
    date: record.dateKey,
    departmentId: record.departmentId as DepartmentId,
    clientNumber: record.client.clientNumber,
    activityId: record.activityTypeId as ActivityId,
    startTime: minutesToTime(record.startMinute),
    endTime: minutesToTime(record.endMinute),
    source: mapBookingSource(record.source),
    note: record.note,
    createdAt: record.createdAt.toISOString(),
    requestId: record.requestId,
  };
}

function formatTabletRequest(record: {
  id: string;
  dateKey: string;
  departmentId: string;
  note: string;
  preferredStartMinute: number | null;
  preferredEndMinute: number | null;
  submittedAt: Date;
  status: PrismaTabletRequestStatus;
  client: {
    clientNumber: number;
  };
  requestedActivities: Array<{
    activityTypeId: string;
  }>;
}): TabletRequest {
  return {
    id: record.id,
    date: record.dateKey,
    departmentId: record.departmentId as DepartmentId,
    clientNumber: record.client.clientNumber,
    requestedActivityIds: record.requestedActivities.map(
      (activity) => activity.activityTypeId as ActivityId,
    ),
    preferredWindow:
      record.preferredStartMinute !== null && record.preferredEndMinute !== null
        ? {
            startTime: minutesToTime(record.preferredStartMinute),
            endTime: minutesToTime(record.preferredEndMinute),
          }
        : null,
    note: record.note,
    submittedAt: record.submittedAt.toISOString(),
    status: mapRequestStatus(record.status),
  };
}

async function writeAuditLog(input: {
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: AuditAction;
  summary: string;
  payload?: string;
}) {
  await prisma.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary,
      payload: input.payload,
    },
  });
}

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

export async function getPlannerSnapshotFromPrisma(input: {
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

  const [departments, clients, bookings, requests] = await prisma.$transaction([
    prisma.department.findMany({
      orderBy: {
        sortOrder: "asc",
      },
      include: {
        clients: {
          select: {
            id: true,
          },
        },
        tabletRequests: {
          where: {
            dateKey: date,
            status: "OPEN",
          },
          select: {
            id: true,
          },
        },
      },
    }),
    prisma.client.findMany({
      where: {
        currentDepartmentId: departmentId,
        active: true,
      },
      orderBy: {
        clientNumber: "asc",
      },
    }),
    prisma.booking.findMany({
      where: {
        departmentId,
        dateKey: date,
        deletedAt: null,
      },
      include: {
        client: {
          select: {
            clientNumber: true,
          },
        },
      },
      orderBy: [
        { startMinute: "asc" },
        { createdAt: "asc" },
      ],
    }),
    prisma.tabletRequest.findMany({
      where: {
        departmentId,
        dateKey: date,
      },
      include: {
        client: {
          select: {
            clientNumber: true,
          },
        },
        requestedActivities: {
          orderBy: {
            sortOrder: "asc",
          },
          select: {
            activityTypeId: true,
          },
        },
      },
      orderBy: {
        submittedAt: "asc",
      },
    }),
  ]);

  const lastUpdatedCandidates = [
    ...bookings.map((booking) => booking.updatedAt.toISOString()),
    ...requests.map((request) => request.updatedAt.toISOString()),
  ].sort();

  return {
    date,
    departmentId,
    departments: departments.map((department) => ({
      id: department.id as DepartmentId,
      label: department.label,
      clientCount: department.clients.length,
      openRequestCount: department.tabletRequests.length,
    })),
    clients: clients.map<ClientRecord>((client) => ({
      clientNumber: client.clientNumber,
      departmentId: client.currentDepartmentId as DepartmentId,
      intakeNumber: client.intakeNumber,
      label: client.label,
    })),
    bookings: bookings.map(formatBooking),
    requests: requests.map(formatTabletRequest),
    lastUpdatedAt:
      lastUpdatedCandidates[lastUpdatedCandidates.length - 1] ?? null,
  };
}

export async function createBookingInPrisma(
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
    throw new PlannerServiceError("Sluttiden måste vara senare än starttiden.", 400);
  }

  const sourceMap: Record<BookingSource, PrismaBookingSource> = {
    staff: "STAFF",
    tablet: "TABLET",
    integration: "INTEGRATION",
  };

  const client = await prisma.client.findUnique({
    where: {
      clientNumber: draft.clientNumber,
    },
  });

  if (!client || client.currentDepartmentId !== departmentId) {
    throw new PlannerServiceError(
      "Klienten finns inte på den valda avdelningen.",
      400,
    );
  }

  const conflict = await prisma.booking.findFirst({
    where: {
      clientId: client.id,
      dateKey: draft.date,
      deletedAt: null,
      startMinute: {
        lt: endMinute,
      },
      endMinute: {
        gt: startMinute,
      },
    },
    include: {
      client: {
        select: {
          clientNumber: true,
        },
      },
    },
  });

  if (conflict) {
    throw new PlannerServiceError(
      `Klienten är redan bokad under delar av den tiden. Krockar med ${ACTIVITY_BY_ID[conflict.activityTypeId as ActivityId].label} ${minutesToTime(conflict.startMinute)}-${minutesToTime(conflict.endMinute)}.`,
      409,
    );
  }

  const createdBooking = await prisma.$transaction(async (transaction) => {
    let requestId: string | null = null;

    if (draft.requestId) {
      const request = await transaction.tabletRequest.findUnique({
        where: {
          id: draft.requestId,
        },
      });

      if (!request) {
        throw new PlannerServiceError("Padda-önskemålet hittades inte.", 404);
      }

      if (request.status === "DISMISSED") {
        throw new PlannerServiceError(
          "Önskemålet är redan avfärdat och kan inte bokas.",
          409,
        );
      }

      if (request.status === "SCHEDULED") {
        throw new PlannerServiceError("Önskemålet är redan schemalagt.", 409);
      }

      requestId = request.id;

      await transaction.tabletRequest.update({
        where: {
          id: request.id,
        },
        data: {
          status: "SCHEDULED",
        },
      });
    }

    const booking = await transaction.booking.create({
      data: {
        dateKey: draft.date,
        clientId: client.id,
        departmentId,
        activityTypeId: activityId,
        startMinute,
        endMinute,
        source: sourceMap[draft.source],
        note: draft.note.trim(),
        requestId,
        createdById: actor.id,
      },
      include: {
        client: {
          select: {
            clientNumber: true,
          },
        },
      },
    });

    await transaction.auditEvent.create({
      data: {
        actorId: actor.id,
        entityType: "booking",
        entityId: booking.id,
        action: "BOOKING_CREATED",
        summary: `Bokning skapad för klient ${client.clientNumber} ${minutesToTime(startMinute)}-${minutesToTime(endMinute)}.`,
      },
    });

    return booking;
  });

  return formatBooking(createdBooking);
}

export async function deleteBookingInPrisma(
  bookingId: string,
  actor: AuthenticatedUser,
) {
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
    include: {
      client: {
        select: {
          clientNumber: true,
        },
      },
    },
  });

  if (!booking || booking.deletedAt) {
    throw new PlannerServiceError("Bokningen hittades inte.", 404);
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (booking.requestId) {
      await transaction.tabletRequest.update({
        where: {
          id: booking.requestId,
        },
        data: {
          status: "OPEN",
        },
      });
    }

    await transaction.auditEvent.create({
      data: {
        actorId: actor.id,
        entityType: "booking",
        entityId: booking.id,
        action: "BOOKING_DELETED",
        summary: `Bokning borttagen för klient ${booking.client.clientNumber}.`,
      },
    });
  });
}

export async function dismissTabletRequestInPrisma(
  requestId: string,
  actor: AuthenticatedUser,
) {
  const request = await prisma.tabletRequest.findUnique({
    where: {
      id: requestId,
    },
    include: {
      client: {
        select: {
          clientNumber: true,
        },
      },
    },
  });

  if (!request) {
    throw new PlannerServiceError("Önskemålet hittades inte.", 404);
  }

  if (request.status === "SCHEDULED") {
    throw new PlannerServiceError("Önskemålet är redan schemalagt.", 409);
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.tabletRequest.update({
      where: {
        id: requestId,
      },
      data: {
        status: "DISMISSED",
        dismissedById: actor.id,
      },
    });

    await transaction.auditEvent.create({
      data: {
        actorId: actor.id,
        entityType: "tabletRequest",
        entityId: requestId,
        action: "REQUEST_DISMISSED",
        summary: `Önskemål avfärdat för klient ${request.client.clientNumber}.`,
      },
    });
  });
}

export async function recordLoginInPrisma(actor: AuthenticatedUser) {
  await writeAuditLog({
    actorId: actor.id,
    entityType: "session",
    entityId: actor.id,
    action: "LOGIN",
    summary: `Inloggning för ${actor.email}.`,
  });
}

export async function recordLogoutInPrisma(actor: AuthenticatedUser) {
  await writeAuditLog({
    actorId: actor.id,
    entityType: "session",
    entityId: actor.id,
    action: "LOGOUT",
    summary: `Utloggning för ${actor.email}.`,
  });
}
