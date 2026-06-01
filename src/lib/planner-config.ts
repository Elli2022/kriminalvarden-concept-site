import {
  buildClientDirectory,
  type ActivityDefinition,
  type DepartmentDefinition,
} from "./planner-domain";

export const DEPARTMENTS: DepartmentDefinition[] = [
  { id: "5.1", label: "Avdelning 5.1", clientStart: 501, clientEnd: 513 },
  { id: "5.2", label: "Avdelning 5.2", clientStart: 514, clientEnd: 530 },
  { id: "5.3", label: "Avdelning 5.3", clientStart: 531, clientEnd: 545 },
  { id: "5.4", label: "Avdelning 5.4", clientStart: 546, clientEnd: 557 },
  { id: "6.1", label: "Avdelning 6.1", clientStart: 601, clientEnd: 611 },
  { id: "6.2", label: "Avdelning 6.2", clientStart: 612, clientEnd: 629 },
  { id: "6.3", label: "Avdelning 6.3", clientStart: 630, clientEnd: 646 },
  { id: "6.4", label: "Avdelning 6.4", clientStart: 647, clientEnd: 660 },
];

export const ACTIVITY_DEFINITIONS: ActivityDefinition[] = [
  {
    id: "training",
    label: "Träning",
    shortLabel: "Träning",
    requestable: true,
    colorToken: "var(--ink)",
  },
  {
    id: "shower",
    label: "Dusch",
    shortLabel: "Dusch",
    requestable: true,
    colorToken: "#3978a7",
  },
  {
    id: "newspaper",
    label: "Tidning",
    shortLabel: "Tidning",
    requestable: true,
    colorToken: "#546b2f",
  },
  {
    id: "lawyer-call",
    label: "Advokattelefon",
    shortLabel: "Advokat",
    requestable: false,
    colorToken: "#6b4fa1",
  },
  {
    id: "activation",
    label: "Aktivering",
    shortLabel: "Aktivering",
    requestable: true,
    colorToken: "#0f8862",
  },
  {
    id: "isolation-break",
    label: "Isoleringsbrytande",
    shortLabel: "Isobryt",
    requestable: true,
    colorToken: "#915d00",
  },
  {
    id: "walk",
    label: "Promenad",
    shortLabel: "Promenad",
    requestable: true,
    colorToken: "#006f6a",
  },
  {
    id: "healthcare",
    label: "Sjukvård",
    shortLabel: "Sjukvård",
    requestable: false,
    colorToken: "#ab3557",
  },
  {
    id: "visit",
    label: "Besök",
    shortLabel: "Besök",
    requestable: false,
    colorToken: "#926200",
  },
  {
    id: "interview",
    label: "Förhör",
    shortLabel: "Förhör",
    requestable: false,
    colorToken: "#3753a5",
  },
  {
    id: "trial",
    label: "Rättegång",
    shortLabel: "Rättegång",
    requestable: false,
    colorToken: "#7e3848",
  },
];

export const DEPARTMENT_BY_ID = Object.fromEntries(
  DEPARTMENTS.map((department) => [department.id, department]),
);
export const DEPARTMENT_IDS = DEPARTMENTS.map((department) => department.id);

export const ACTIVITY_BY_ID = Object.fromEntries(
  ACTIVITY_DEFINITIONS.map((activity) => [activity.id, activity]),
);
export const ACTIVITY_IDS = ACTIVITY_DEFINITIONS.map((activity) => activity.id);

export const CLIENT_DIRECTORY = buildClientDirectory(DEPARTMENTS);

export const CLIENT_BY_NUMBER = Object.fromEntries(
  CLIENT_DIRECTORY.map((client) => [client.clientNumber, client]),
);

export const DEFAULT_DEPARTMENT_ID = DEPARTMENTS[0].id;
export const DEFAULT_ACTIVITY_ID = ACTIVITY_DEFINITIONS[0].id;
export const TOTAL_CAPACITY = CLIENT_DIRECTORY.length;

export function isDepartmentId(value: string): value is (typeof DEPARTMENT_IDS)[number] {
  return DEPARTMENT_IDS.includes(value as (typeof DEPARTMENT_IDS)[number]);
}

export function isActivityId(value: string): value is (typeof ACTIVITY_IDS)[number] {
  return ACTIVITY_IDS.includes(value as (typeof ACTIVITY_IDS)[number]);
}
