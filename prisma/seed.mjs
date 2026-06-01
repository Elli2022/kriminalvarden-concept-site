import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const departments = [
  { id: "5.1", label: "Avdelning 5.1", sortOrder: 1, clientStart: 501, clientEnd: 513 },
  { id: "5.2", label: "Avdelning 5.2", sortOrder: 2, clientStart: 514, clientEnd: 530 },
  { id: "5.3", label: "Avdelning 5.3", sortOrder: 3, clientStart: 531, clientEnd: 545 },
  { id: "5.4", label: "Avdelning 5.4", sortOrder: 4, clientStart: 546, clientEnd: 557 },
  { id: "6.1", label: "Avdelning 6.1", sortOrder: 5, clientStart: 601, clientEnd: 611 },
  { id: "6.2", label: "Avdelning 6.2", sortOrder: 6, clientStart: 612, clientEnd: 629 },
  { id: "6.3", label: "Avdelning 6.3", sortOrder: 7, clientStart: 630, clientEnd: 646 },
  { id: "6.4", label: "Avdelning 6.4", sortOrder: 8, clientStart: 647, clientEnd: 660 },
];

const activityTypes = [
  { id: "training", label: "Träning", shortLabel: "Träning", requestable: true, colorToken: "var(--ink)", sortOrder: 1 },
  { id: "shower", label: "Dusch", shortLabel: "Dusch", requestable: true, colorToken: "#3978a7", sortOrder: 2 },
  { id: "newspaper", label: "Tidning", shortLabel: "Tidning", requestable: true, colorToken: "#546b2f", sortOrder: 3 },
  { id: "lawyer-call", label: "Advokattelefon", shortLabel: "Advokat", requestable: false, colorToken: "#6b4fa1", sortOrder: 4 },
  { id: "activation", label: "Aktivering", shortLabel: "Aktivering", requestable: true, colorToken: "#0f8862", sortOrder: 5 },
  { id: "isolation-break", label: "Isoleringsbrytande", shortLabel: "Isobryt", requestable: true, colorToken: "#915d00", sortOrder: 6 },
  { id: "walk", label: "Promenad", shortLabel: "Promenad", requestable: true, colorToken: "#006f6a", sortOrder: 7 },
  { id: "healthcare", label: "Sjukvård", shortLabel: "Sjukvård", requestable: false, colorToken: "#ab3557", sortOrder: 8 },
  { id: "visit", label: "Besök", shortLabel: "Besök", requestable: false, colorToken: "#926200", sortOrder: 9 },
  { id: "interview", label: "Förhör", shortLabel: "Förhör", requestable: false, colorToken: "#3753a5", sortOrder: 10 },
  { id: "trial", label: "Rättegång", shortLabel: "Rättegång", requestable: false, colorToken: "#7e3848", sortOrder: 11 },
];

function getTodayDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
  }).format(new Date());
}

async function main() {
  const today = getTodayDateKey();
  const passwordHash = await bcrypt.hash("demo-anstalt-2026", 10);

  await prisma.auditEvent.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.tabletRequestActivity.deleteMany();
  await prisma.tabletRequest.deleteMany();
  await prisma.client.deleteMany();
  await prisma.activityType.deleteMany();
  await prisma.department.deleteMany();
  await prisma.staffUser.deleteMany();

  await prisma.staffUser.createMany({
    data: [
      {
        email: "admin@kriminalvarden.local",
        name: "Administratör",
        role: "ADMIN",
        passwordHash,
      },
      {
        email: "arbetsledare@kriminalvarden.local",
        name: "Arbetsledare",
        role: "SUPERVISOR",
        passwordHash,
      },
    ],
  });

  await prisma.department.createMany({
    data: departments.map(({ clientStart, clientEnd, ...department }) => department),
  });

  await prisma.activityType.createMany({
    data: activityTypes,
  });

  await prisma.client.createMany({
    data: departments.flatMap((department) => {
      const clients = [];

      for (
        let clientNumber = department.clientStart;
        clientNumber <= department.clientEnd;
        clientNumber += 1
      ) {
        clients.push({
          clientNumber,
          label: `Klient ${clientNumber}`,
          currentDepartmentId: department.id,
        });
      }

      return clients;
    }),
  });

  const clients = await prisma.client.findMany();
  const clientByNumber = new Map(clients.map((client) => [client.clientNumber, client]));
  const admin = await prisma.staffUser.findUniqueOrThrow({
    where: { email: "admin@kriminalvarden.local" },
  });

  const request501 = await prisma.tabletRequest.create({
    data: {
      dateKey: today,
      clientId: clientByNumber.get(502).id,
      departmentId: "5.1",
      note: "Behöver personalens bekräftelse.",
      preferredStartMinute: 810,
      preferredEndMinute: 855,
      requestedActivities: {
        create: [
          { activityTypeId: "activation", sortOrder: 1 },
          { activityTypeId: "walk", sortOrder: 2 },
        ],
      },
    },
  });

  await prisma.tabletRequest.create({
    data: {
      dateKey: today,
      clientId: clientByNumber.get(506).id,
      departmentId: "5.1",
      note: "Intresse markerat på padda.",
      preferredStartMinute: 450,
      preferredEndMinute: 495,
      requestedActivities: {
        create: [{ activityTypeId: "isolation-break", sortOrder: 1 }],
      },
    },
  });

  await prisma.tabletRequest.create({
    data: {
      dateKey: today,
      clientId: clientByNumber.get(510).id,
      departmentId: "5.1",
      note: "Klienten önskar aktivitet före lunch.",
      preferredStartMinute: 540,
      preferredEndMinute: 585,
      requestedActivities: {
        create: [
          { activityTypeId: "walk", sortOrder: 1 },
          { activityTypeId: "shower", sortOrder: 2 },
        ],
      },
    },
  });

  await prisma.tabletRequest.create({
    data: {
      dateKey: today,
      clientId: clientByNumber.get(518).id,
      departmentId: "5.2",
      note: "Önskemål inlagt under morgonrutin.",
      preferredStartMinute: 480,
      preferredEndMinute: 525,
      requestedActivities: {
        create: [{ activityTypeId: "training", sortOrder: 1 }],
      },
    },
  });

  await prisma.tabletRequest.create({
    data: {
      dateKey: today,
      clientId: clientByNumber.get(531).id,
      departmentId: "5.3",
      note: "Klienten vill ha uppföljning.",
      preferredStartMinute: 780,
      preferredEndMinute: 825,
      requestedActivities: {
        create: [{ activityTypeId: "activation", sortOrder: 1 }],
      },
    },
  });

  await prisma.tabletRequest.create({
    data: {
      dateKey: today,
      clientId: clientByNumber.get(604).id,
      departmentId: "6.1",
      note: "Intresse för promenad markerat i padda-systemet.",
      preferredStartMinute: 600,
      preferredEndMinute: 645,
      requestedActivities: {
        create: [{ activityTypeId: "walk", sortOrder: 1 }],
      },
    },
  });

  await prisma.tabletRequest.create({
    data: {
      dateKey: today,
      clientId: clientByNumber.get(648).id,
      departmentId: "6.4",
      note: "Intresse för isoleringsbrytande aktivitet.",
      preferredStartMinute: 660,
      preferredEndMinute: 705,
      requestedActivities: {
        create: [{ activityTypeId: "isolation-break", sortOrder: 1 }],
      },
    },
  });

  await prisma.booking.createMany({
    data: [
      {
        dateKey: today,
        clientId: clientByNumber.get(501).id,
        departmentId: "5.1",
        activityTypeId: "walk",
        startMinute: 495,
        endMinute: 540,
        source: "STAFF",
        note: "Morgonrutin",
        createdById: admin.id,
      },
      {
        dateKey: today,
        clientId: clientByNumber.get(503).id,
        departmentId: "5.1",
        activityTypeId: "shower",
        startMinute: 440,
        endMinute: 460,
        source: "STAFF",
        note: "",
        createdById: admin.id,
      },
      {
        dateKey: today,
        clientId: clientByNumber.get(512).id,
        departmentId: "5.1",
        activityTypeId: "visit",
        startMinute: 780,
        endMinute: 840,
        source: "STAFF",
        note: "Bekräftat besök",
        createdById: admin.id,
      },
      {
        dateKey: today,
        clientId: clientByNumber.get(518).id,
        departmentId: "5.2",
        activityTypeId: "interview",
        startMinute: 600,
        endMinute: 690,
        source: "INTEGRATION",
        note: "Importerat från extern planering",
        createdById: admin.id,
      },
      {
        dateKey: today,
        clientId: clientByNumber.get(531).id,
        departmentId: "5.3",
        activityTypeId: "activation",
        startMinute: 550,
        endMinute: 590,
        source: "STAFF",
        note: "",
        createdById: admin.id,
      },
      {
        dateKey: today,
        clientId: clientByNumber.get(604).id,
        departmentId: "6.1",
        activityTypeId: "healthcare",
        startMinute: 855,
        endMinute: 900,
        source: "INTEGRATION",
        note: "Tidsatt sjukvård",
        createdById: admin.id,
      },
      {
        dateKey: today,
        clientId: clientByNumber.get(648).id,
        departmentId: "6.4",
        activityTypeId: "isolation-break",
        startMinute: 660,
        endMinute: 705,
        source: "STAFF",
        note: "Planerad aktivitet",
        createdById: admin.id,
      },
      {
        dateKey: today,
        clientId: clientByNumber.get(502).id,
        departmentId: "5.1",
        activityTypeId: "activation",
        startMinute: 810,
        endMinute: 855,
        source: "TABLET",
        note: "Schemalagd från padda",
        createdById: admin.id,
        requestId: request501.id,
      },
    ],
  });

  await prisma.tabletRequest.update({
    where: { id: request501.id },
    data: { status: "SCHEDULED" },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
