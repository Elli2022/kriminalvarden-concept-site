"use client";

import Link from "next/link";
import {
  startTransition,
  useDeferredValue,
  useRef,
  useState,
} from "react";
import styles from "./planner-app.module.css";
import { formatSwedishDateTime, formatSwedishTime } from "@/lib/date";
import {
  canDeleteBooking,
  canDismissTabletRequest,
  canUseBookingSource,
} from "@/lib/planner-auth";
import {
  ACTIVITY_BY_ID,
  ACTIVITY_DEFINITIONS,
  DEFAULT_ACTIVITY_ID,
  TOTAL_CAPACITY,
} from "@/lib/planner-config";
import {
  CSRF_COOKIE_NAME,
  INTERNAL_API_CLIENT_HEADER,
  INTERNAL_API_CLIENT_VALUE,
  MAX_NOTE_LENGTH,
} from "@/lib/security-constants";
import {
  getBookingsForClientActivity,
  getBookingsForClientOnDate,
  sortBookingsByTime,
  validateBookingDraft,
  type ActivityId,
  type AuthenticatedUser,
  type BookingSource,
  type DepartmentId,
  type PlannerSnapshot,
  type TabletRequest,
} from "@/lib/planner-domain";

interface PlannerAppProps {
  session: AuthenticatedUser;
  initialSnapshot: PlannerSnapshot;
}

interface DraftState {
  clientNumber: string;
  activityId: ActivityId;
  startTime: string;
  endTime: string;
  source: BookingSource;
  note: string;
  requestId: string;
}

interface FeedbackState {
  tone: "success" | "error";
  text: string;
}

function createEmptyDraft(clientNumber?: number): DraftState {
  return {
    clientNumber: clientNumber ? String(clientNumber) : "",
    activityId: DEFAULT_ACTIVITY_ID,
    startTime: "08:00",
    endTime: "08:45",
    source: "staff",
    note: "",
    requestId: "",
  };
}

function getSourceLabel(source: BookingSource): string {
  switch (source) {
    case "tablet":
      return "Padda";
    case "integration":
      return "Import";
    default:
      return "Personal";
  }
}

function readCookieValue(name: string) {
  const cookies = document.cookie
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);

  const prefixedName = `${name}=`;
  const match = cookies.find((value) => value.startsWith(prefixedName));

  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(prefixedName.length));
}

async function fetchInternal(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const headers = new Headers(init?.headers);
  const method = (init?.method ?? "GET").toUpperCase();

  headers.set(INTERNAL_API_CLIENT_HEADER, INTERNAL_API_CLIENT_VALUE);

  if (method !== "GET" && method !== "HEAD") {
    const csrfToken = readCookieValue(CSRF_COOKIE_NAME);

    if (!csrfToken) {
      throw new Error("Säkerhetstoken saknas. Logga ut och in igen.");
    }

    headers.set("X-CSRF-Token", csrfToken);
  }

  return fetch(input, {
    ...init,
    headers,
    cache: init?.cache ?? "no-store",
    credentials: "same-origin",
    mode: "same-origin",
  });
}

export function PlannerApp({ session, initialSnapshot }: PlannerAppProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedDepartmentId, setSelectedDepartmentId] =
    useState<DepartmentId>(initialSnapshot.departmentId);
  const [selectedDate, setSelectedDate] = useState(initialSnapshot.date);
  const [selectedClientNumber, setSelectedClientNumber] = useState<number>(
    initialSnapshot.clients[0]?.clientNumber ?? 0,
  );
  const [searchValue, setSearchValue] = useState("");
  const [showOnlyBooked, setShowOnlyBooked] = useState(false);
  const [draft, setDraft] = useState<DraftState>(() =>
    createEmptyDraft(initialSnapshot.clients[0]?.clientNumber),
  );
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const deferredSearchValue = useDeferredValue(searchValue);
  const refreshSequenceRef = useRef(0);
  const canRemoveExistingBookings = canDeleteBooking(session.role);
  const canHandleTabletRequests = canDismissTabletRequest(session.role);
  const canScheduleIntegration = canUseBookingSource(
    session.role,
    "integration",
  );

  async function refreshSnapshot(departmentId: DepartmentId, date: string) {
    const requestSequence = refreshSequenceRef.current + 1;
    refreshSequenceRef.current = requestSequence;
    setIsRefreshing(true);

    try {
      const response = await fetchInternal(
        `/api/planner?departmentId=${encodeURIComponent(departmentId)}&date=${encodeURIComponent(date)}`,
      );

      const payload = (await response.json()) as PlannerSnapshot & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Kunde inte hämta planeringen.");
      }

      if (refreshSequenceRef.current !== requestSequence) {
        return;
      }

      setSnapshot(payload);

      const nextSelectedClientNumber = payload.clients.some(
        (client) => client.clientNumber === selectedClientNumber,
      )
        ? selectedClientNumber
        : payload.clients[0]?.clientNumber ?? 0;

      setSelectedClientNumber(nextSelectedClientNumber);
      setDraft((currentDraft) => {
        const draftClientNumber = Number(currentDraft.clientNumber);
        const draftClientStillVisible = payload.clients.some(
          (client) => client.clientNumber === draftClientNumber,
        );

        if (draftClientStillVisible) {
          return currentDraft;
        }

        return createEmptyDraft(nextSelectedClientNumber || undefined);
      });
    } catch (error) {
      if (refreshSequenceRef.current !== requestSequence) {
        return;
      }

      setFeedback({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Kunde inte hämta planeringsdata.",
      });
    } finally {
      if (refreshSequenceRef.current !== requestSequence) {
        return;
      }

      setIsRefreshing(false);
    }
  }

  const departmentClients = snapshot.clients;
  const requestFeed = snapshot.requests;
  const searchTerm = deferredSearchValue.trim().toLowerCase();

  const visibleClients = departmentClients.filter((client) => {
    const matchesSearch =
      searchTerm.length === 0 ||
      client.label.toLowerCase().includes(searchTerm) ||
      String(client.clientNumber).includes(searchTerm);

    if (!matchesSearch) {
      return false;
    }

    if (!showOnlyBooked) {
      return true;
    }

    const hasBooking =
      getBookingsForClientOnDate(
        snapshot.bookings,
        client.clientNumber,
        selectedDate,
      ).length > 0;
    const hasRequest = requestFeed.some(
      (request) =>
        request.clientNumber === client.clientNumber && request.status === "open",
    );

    return hasBooking || hasRequest;
  });

  const selectedDepartment = snapshot.departments.find(
    (department) => department.id === selectedDepartmentId,
  );
  const selectedClient =
    departmentClients.find(
      (client) => client.clientNumber === selectedClientNumber,
    ) ?? null;

  const selectedClientBookings = selectedClient
    ? getBookingsForClientOnDate(
        snapshot.bookings,
        selectedClient.clientNumber,
        selectedDate,
      )
    : [];

  const selectedClientRequests = requestFeed.filter(
    (request) => request.clientNumber === selectedClient?.clientNumber,
  );
  const activeRequestFeed = requestFeed.filter(
    (request) => request.status !== "dismissed",
  );
  const openRequests = requestFeed.filter((request) => request.status === "open");
  const bookedClientsCount = new Set(
    snapshot.bookings.map((booking) => booking.clientNumber),
  ).size;
  const departmentBookingsCount = snapshot.bookings.length;

  async function handleScheduleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const clientNumber = Number(draft.clientNumber);
    const validation = validateBookingDraft(
      {
        date: selectedDate,
        departmentId: selectedDepartmentId,
        clientNumber,
        activityId: draft.activityId,
        startTime: draft.startTime,
        endTime: draft.endTime,
        source: draft.source,
        note: draft.note.trim(),
        requestId: draft.requestId || null,
      },
      snapshot.bookings,
    );

    if (!validation.ok) {
      setFeedback({
        tone: "error",
        text: validation.errors[0] ?? "Kunde inte spara bokningen.",
      });
      return;
    }

    if (!canUseBookingSource(session.role, draft.source)) {
      setFeedback({
        tone: "error",
        text: "Du saknar behörighet att registrera extern import.",
      });
      return;
    }

    try {
      const response = await fetchInternal("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: selectedDate,
          departmentId: selectedDepartmentId,
          clientNumber,
          activityId: draft.activityId,
          startTime: draft.startTime,
          endTime: draft.endTime,
          source: draft.source,
          note: draft.note,
          requestId: draft.requestId || null,
        }),
      });

      const payload = (await response.json()) as {
        booking?: {
          activityId: ActivityId;
          clientNumber: number;
          startTime: string;
          endTime: string;
        };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Kunde inte skapa bokningen.");
      }

      if (!payload.booking) {
        throw new Error("Servern svarade utan bokningsdata.");
      }

      await refreshSnapshot(selectedDepartmentId, selectedDate);
      setSelectedClientNumber(clientNumber);
      setDraft(createEmptyDraft(clientNumber));
      setFeedback({
        tone: "success",
        text: `${ACTIVITY_BY_ID[payload.booking.activityId].label} bokad för klient ${payload.booking.clientNumber} ${payload.booking.startTime}-${payload.booking.endTime}.`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Kunde inte skapa bokningen.",
      });
    }
  }

  async function handleRemoveBooking(bookingId: string) {
    if (!canRemoveExistingBookings) {
      setFeedback({
        tone: "error",
        text: "Du saknar behörighet att ta bort bokningar.",
      });
      return;
    }

    try {
      const response = await fetchInternal(
        `/api/bookings?bookingId=${encodeURIComponent(bookingId)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Kunde inte ta bort bokningen.");
      }

      await refreshSnapshot(selectedDepartmentId, selectedDate);
      setFeedback({
        tone: "success",
        text: "Bokningen togs bort.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Kunde inte ta bort bokningen.",
      });
    }
  }

  async function handleDismissRequest(requestId: string) {
    if (!canHandleTabletRequests) {
      setFeedback({
        tone: "error",
        text: "Du saknar behörighet att markera önskemål som hanterade.",
      });
      return;
    }

    try {
      const response = await fetchInternal("/api/tablet-requests/dismiss", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Kunde inte avfärda önskemålet.");
      }

      await refreshSnapshot(selectedDepartmentId, selectedDate);
    } catch (error) {
      setFeedback({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Kunde inte avfärda önskemålet.",
      });
    }
  }

  async function handleLogout() {
    setIsSigningOut(true);

    try {
      await fetchInternal("/api/logout", {
        method: "POST",
      });
    } finally {
      window.location.assign("/login");
    }
  }

  function handleDepartmentSelect(departmentId: DepartmentId) {
    startTransition(() => {
      setSelectedDepartmentId(departmentId);
      setFeedback(null);
    });

    void refreshSnapshot(departmentId, selectedDate);
  }

  function handleClientSelect(clientNumber: number) {
    startTransition(() => {
      setSelectedClientNumber(clientNumber);
      setDraft((currentDraft) => ({
        ...currentDraft,
        clientNumber: String(clientNumber),
      }));
      setFeedback(null);
    });
  }

  function handleUseRequest(request: TabletRequest) {
    const firstActivity = request.requestedActivityIds[0] ?? DEFAULT_ACTIVITY_ID;

    startTransition(() => {
      setSelectedClientNumber(request.clientNumber);
      setDraft({
        clientNumber: String(request.clientNumber),
        activityId: firstActivity,
        startTime: request.preferredWindow?.startTime ?? "08:00",
        endTime: request.preferredWindow?.endTime ?? "08:45",
        source: "tablet",
        note: request.note,
        requestId: request.id,
      });
      setFeedback(null);
    });
  }

  function handleResetDepartmentView() {
    const nextClientNumber = departmentClients[0]?.clientNumber;

    startTransition(() => {
      setSearchValue("");
      setShowOnlyBooked(false);
      setFeedback(null);
      setSelectedClientNumber(nextClientNumber ?? 0);
      setDraft(createEmptyDraft(nextClientNumber));
    });
  }

  const boardLastUpdated = snapshot.lastUpdatedAt
    ? formatSwedishDateTime(snapshot.lastUpdatedAt)
    : "Ingen ändring ännu";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroTopbar}>
            <div className={styles.userBadge}>
              <span className={styles.userLabel}>Inloggad</span>
              <strong>{session.name}</strong>
              <span className={styles.userMeta}>{session.email}</span>
            </div>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={handleLogout}
              disabled={isSigningOut}
            >
              {isSigningOut ? "Loggar ut..." : "Logga ut"}
            </button>
          </div>

          <span className={styles.eyebrow}>Personalverktyg</span>
          <div className={styles.heroGrid}>
            <div>
              <h1 className={styles.heroTitle}>
                Robust planeringsyta för Kriminalvårdens vardagsflöde.
              </h1>
              <p className={styles.heroLead}>
                Planeringsytan är nu kopplad till riktig serverdata, intern
                inloggning och en första audit-kedja. Nästa steg blir att byta
                utvecklingsdatabasen mot driftad Postgres och ansluta padda-systemet.
              </p>
              <div className={styles.pillRow}>
                <span className={styles.pill}>Skyddad inloggning</span>
                <span className={styles.pill}>Databaskopplad planering</span>
                <span className={styles.pill}>Netlify-redo appgrund</span>
              </div>
            </div>
            <div className={styles.heroCards}>
              <div className={styles.heroCard}>
                <div className={styles.heroCardLabel}>Kapacitet</div>
                <div className={styles.heroCardValue}>{TOTAL_CAPACITY}</div>
                <p className={styles.heroCardCopy}>
                  registrerade klientnummer över åtta avdelningar
                </p>
              </div>
              <div className={styles.heroCard}>
                <div className={styles.heroCardLabel}>Serverläge</div>
                <p className={styles.heroCardCopy}>
                  Bokningar och önskemål kommer nu från servern i stället för att
                  sparas lokalt i webbläsaren.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.notice}>
          <div>
            <h2 className={styles.noticeTitle}>Var vi står just nu</h2>
            <p className={styles.noticeText}>
              Appen använder nu en intern utvecklingsdatabas för att vi ska kunna
              bygga och testa hela flödet på riktigt. Legacy-skissen finns fortfarande
              kvar under{" "}
              <Link
                className={styles.noticeLink}
                href="/legacy/html/kriminalvarden.html"
              >
                legacy-versionen
              </Link>
              .
            </p>
          </div>
        </section>

        <section className={styles.toolbar}>
          <div className={styles.tabRail}>
            {snapshot.departments.map((department) => (
              <button
                key={department.id}
                type="button"
                className={`${styles.tabButton} ${
                  department.id === selectedDepartmentId
                    ? styles.tabButtonActive
                    : ""
                }`}
                onClick={() => handleDepartmentSelect(department.id)}
              >
                <span className={styles.tabTitle}>{department.label}</span>
                <span className={styles.tabMeta}>
                  {department.clientCount} klienter
                  {department.openRequestCount > 0
                    ? ` • ${department.openRequestCount} önskemål`
                    : ""}
                </span>
              </button>
            ))}
          </div>

          <div className={styles.filterGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Datum</span>
              <input
                className={styles.input}
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  const nextDate = event.target.value;

                  startTransition(() => {
                    setSelectedDate(nextDate);
                    setFeedback(null);
                  });

                  void refreshSnapshot(selectedDepartmentId, nextDate);
                }}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Sök klient</span>
              <input
                className={styles.input}
                type="search"
                placeholder="Sök på klientnummer eller klient"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
            </label>

            <label className={styles.toggleCard}>
              <input
                type="checkbox"
                checked={showOnlyBooked}
                onChange={(event) => setShowOnlyBooked(event.target.checked)}
              />
              Visa bara klienter med aktivitet eller önskemål
            </label>
          </div>
        </section>

        <section className={styles.contentGrid}>
          <div className={styles.board}>
            <div className={styles.summaryRow}>
              <article className={styles.summaryCard}>
                <div className={styles.summaryValue}>{bookedClientsCount}</div>
                <div className={styles.summaryLabel}>
                  klienter med minst en bokning idag
                </div>
              </article>
              <article className={styles.summaryCard}>
                <div className={styles.summaryValue}>{departmentBookingsCount}</div>
                <div className={styles.summaryLabel}>
                  registrerade aktiviteter i vald avdelning
                </div>
              </article>
              <article className={styles.summaryCard}>
                <div className={styles.summaryValue}>{openRequests.length}</div>
                <div className={styles.summaryLabel}>
                  öppna önskemål från klientpaddor
                </div>
              </article>
            </div>

            <section className={styles.tablePanel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>
                    {selectedDepartment?.label ?? selectedDepartmentId}
                  </h2>
                  <p className={styles.panelMeta}>
                    Senast sparat: {boardLastUpdated}
                    {isRefreshing ? " • synkar" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleResetDepartmentView}
                >
                  Återställ vy
                </button>
              </div>

              {visibleClients.length === 0 ? (
                <div className={styles.emptyBoard}>
                  Inga klienter matchar den här filtreringen.
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.clientColumn}>Klient</th>
                        {ACTIVITY_DEFINITIONS.map((activity) => (
                          <th key={activity.id}>{activity.shortLabel}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleClients.map((client) => {
                        const hasOpenRequest = requestFeed.some(
                          (request) =>
                            request.clientNumber === client.clientNumber &&
                            request.status === "open",
                        );

                        return (
                          <tr
                            key={client.clientNumber}
                            className={`${client.clientNumber === selectedClientNumber ? styles.selectedRow : ""} ${
                              hasOpenRequest ? styles.requestRow : ""
                            }`}
                          >
                            <td className={styles.clientColumn}>
                              <button
                                type="button"
                                className={styles.clientButton}
                                onClick={() =>
                                  handleClientSelect(client.clientNumber)
                                }
                              >
                                <span className={styles.clientNumber}>
                                  {client.clientNumber}
                                </span>
                                <span className={styles.clientMeta}>
                                  {client.label}
                                </span>
                                {hasOpenRequest ? (
                                  <span className={styles.requestMarker}>
                                    Padda: nytt önskemål
                                  </span>
                                ) : null}
                              </button>
                            </td>

                            {ACTIVITY_DEFINITIONS.map((activity) => {
                              const bookings = getBookingsForClientActivity(
                                snapshot.bookings,
                                client.clientNumber,
                                activity.id,
                                selectedDate,
                              );

                              return (
                                <td
                                  key={`${client.clientNumber}-${activity.id}`}
                                  className={styles.activityCell}
                                >
                                  {bookings.length === 0 ? (
                                    <span className={styles.emptyCell}>-</span>
                                  ) : (
                                    <div className={styles.chips}>
                                      {bookings.map((booking) => (
                                        <div
                                          key={booking.id}
                                          className={styles.bookingChip}
                                        >
                                          <div className={styles.bookingTime}>
                                            {booking.startTime}-{booking.endTime}
                                          </div>
                                          <div className={styles.bookingSource}>
                                            <span
                                              className={styles.dot}
                                              style={{
                                                color:
                                                  ACTIVITY_BY_ID[booking.activityId]
                                                    .colorToken,
                                              }}
                                            />
                                            {getSourceLabel(booking.source)}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <aside className={styles.sidebar}>
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>Ny bokning</h2>
              <p className={styles.panelIntro}>
                Välj klient, aktivitet och tider. Servern blockerar dubbelbokning
                för samma klient även om flera användare arbetar samtidigt.
              </p>

              <form className={styles.form} onSubmit={handleScheduleSubmit}>
                <div className={styles.fieldGrid}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Klient</span>
                    <select
                      className={styles.select}
                      value={draft.clientNumber}
                      onChange={(event) =>
                        setDraft((currentDraft) => ({
                          ...currentDraft,
                          clientNumber: event.target.value,
                        }))
                      }
                    >
                      {departmentClients.map((client) => (
                        <option
                          key={client.clientNumber}
                          value={client.clientNumber}
                        >
                          {client.clientNumber}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Aktivitet</span>
                    <select
                      className={styles.select}
                      value={draft.activityId}
                      onChange={(event) =>
                        setDraft((currentDraft) => ({
                          ...currentDraft,
                          activityId: event.target.value as ActivityId,
                        }))
                      }
                    >
                      {ACTIVITY_DEFINITIONS.map((activity) => (
                        <option key={activity.id} value={activity.id}>
                          {activity.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className={styles.fieldGrid}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Starttid</span>
                    <input
                      className={styles.input}
                      type="time"
                      value={draft.startTime}
                      onChange={(event) =>
                        setDraft((currentDraft) => ({
                          ...currentDraft,
                          startTime: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Sluttid</span>
                    <input
                      className={styles.input}
                      type="time"
                      value={draft.endTime}
                      onChange={(event) =>
                        setDraft((currentDraft) => ({
                          ...currentDraft,
                          endTime: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Källa</span>
                  <select
                    className={styles.select}
                    value={draft.source}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        source: event.target.value as BookingSource,
                      }))
                    }
                  >
                    <option value="staff">Personal</option>
                    <option value="tablet">Padda/önskemål</option>
                    {canScheduleIntegration ? (
                      <option value="integration">Extern import</option>
                    ) : null}
                  </select>
                </label>

                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Anteckning</span>
                  <textarea
                    className={styles.textarea}
                    maxLength={MAX_NOTE_LENGTH}
                    placeholder="Valfri kommentar"
                    value={draft.note}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        note: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className={styles.buttonRow}>
                  <button className={styles.primaryButton} type="submit">
                    Spara bokning
                  </button>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => setDraft(createEmptyDraft(selectedClientNumber))}
                  >
                    Rensa formulär
                  </button>
                </div>
              </form>

              {feedback ? (
                <div
                  className={`${styles.feedback} ${
                    feedback.tone === "success"
                      ? styles.feedbackSuccess
                      : styles.feedbackError
                  }`}
                >
                  {feedback.text}
                </div>
              ) : null}
            </section>

            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>
                Aktiv klient {selectedClient ? selectedClient.clientNumber : ""}
              </h2>
              <p className={styles.panelIntro}>
                Tidslinjen visar vad som redan är lagt för klienten samma dag.
              </p>

              {selectedClientBookings.length === 0 ? (
                <p className={styles.emptyState}>
                  Ingen bokning ännu för vald klient på {selectedDate}.
                </p>
              ) : (
                <div className={styles.timeline}>
                  {sortBookingsByTime(selectedClientBookings).map((booking) => (
                    <article key={booking.id} className={styles.timelineItem}>
                      <div className={styles.timelineTop}>
                        <div className={styles.timelineTitle}>
                          {ACTIVITY_BY_ID[booking.activityId].label}
                        </div>
                        {canRemoveExistingBookings ? (
                          <button
                            type="button"
                            className={styles.dangerButton}
                            onClick={() => handleRemoveBooking(booking.id)}
                          >
                            Ta bort
                          </button>
                        ) : null}
                      </div>
                      <p className={styles.timelineText}>
                        {booking.startTime}-{booking.endTime} •{" "}
                        {getSourceLabel(booking.source)}
                        {booking.note ? ` • ${booking.note}` : ""}
                      </p>
                    </article>
                  ))}
                </div>
              )}

              {selectedClientRequests.length > 0 ? (
                <div className={styles.requestQueue}>
                  {selectedClientRequests.map((request) => (
                    <article key={request.id} className={styles.requestCard}>
                      <div className={styles.requestHeader}>
                        <div className={styles.requestClient}>
                          Paddans önskemål
                        </div>
                        <span
                          className={`${styles.requestStatus} ${
                            request.status === "scheduled"
                              ? styles.statusHandled
                              : request.status === "dismissed"
                                ? styles.statusMuted
                                : styles.statusOpen
                          }`}
                        >
                          {request.status === "scheduled"
                            ? "Planerad"
                            : request.status === "dismissed"
                              ? "Avfärdad"
                              : "Öppen"}
                        </span>
                      </div>
                      <div className={styles.requestBadges}>
                        {request.requestedActivityIds.map((activityId) => (
                          <span key={activityId} className={styles.requestBadge}>
                            {ACTIVITY_BY_ID[activityId].label}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>

            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>Önskemål från klientpaddor</h2>
              <p className={styles.panelIntro}>
                Här syns önskemål som har kommit in från det separata padda-flödet.
              </p>

              {activeRequestFeed.length === 0 ? (
                <p className={styles.emptyState}>
                  Inga öppna eller kvarvarande önskemål för vald avdelning.
                </p>
              ) : (
                <div className={styles.requestQueue}>
                  {activeRequestFeed.map((request) => (
                    <article key={request.id} className={styles.requestCard}>
                      <div className={styles.requestHeader}>
                        <div>
                          <div className={styles.requestClient}>
                            Klient {request.clientNumber}
                          </div>
                          <div className={styles.requestTime}>
                            Inlagt {formatSwedishTime(request.submittedAt)}
                          </div>
                        </div>
                        <span
                          className={`${styles.requestStatus} ${
                            request.status === "scheduled"
                              ? styles.statusHandled
                              : request.status === "dismissed"
                                ? styles.statusMuted
                                : styles.statusOpen
                          }`}
                        >
                          {request.status === "scheduled"
                            ? "Planerad"
                            : request.status === "dismissed"
                              ? "Avfärdad"
                              : "Öppen"}
                        </span>
                      </div>
                      <div className={styles.requestBadges}>
                        {request.requestedActivityIds.map((activityId) => (
                          <span key={activityId} className={styles.requestBadge}>
                            {ACTIVITY_BY_ID[activityId].label}
                          </span>
                        ))}
                      </div>
                      <p className={styles.requestNote}>
                        {request.preferredWindow
                          ? `${request.preferredWindow.startTime}-${request.preferredWindow.endTime} • `
                          : ""}
                        {request.note}
                      </p>

                      {request.status === "open" ? (
                        <div className={styles.buttonRow}>
                          <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => handleUseRequest(request)}
                          >
                            Fyll i bokning
                          </button>
                          {canHandleTabletRequests ? (
                            <button
                              type="button"
                              className={styles.ghostButton}
                              onClick={() => handleDismissRequest(request.id)}
                            >
                              Markera som hanterad
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
