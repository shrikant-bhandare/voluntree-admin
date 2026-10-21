"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  TabType,
  NGO,
  NgoStatus,
  EventItem,
  EventStatusValue,
  SafetyReport,
  PaymentTransaction,
  PlatformUser,
  AttendanceLog,
  BroadcastNotification,
  AdminStats,
  FeedName,
  FeedHealth,
  LIST_PAGE_SIZE,
} from "../types";
import {
  API_BASE_URL,
  DEV_OTP_VISIBLE,
  REQUEST_TIMEOUT_MS,
} from "../config/constants";
import {
  AdminEventAction,
  findEventAction,
  oneLine,
} from "../utils/eventStatus";
import { FeedError, describeFeedError } from "../components/common/FeedStatus";
import { Sidebar } from "../components/layout/Sidebar";
import { Header } from "../components/layout/Header";
import { AuthModal } from "../components/modals/AuthModal";
import { EventDetailsModal } from "../components/modals/EventDetailsModal";

import { OverviewTab } from "../components/tabs/OverviewTab";
import { AnalyticsTab } from "../components/tabs/AnalyticsTab";
import { NgosTab } from "../components/tabs/NgosTab";
import { EventsTab } from "../components/tabs/EventsTab";
import { SafetyReportsTab } from "../components/tabs/SafetyReportsTab";
import { PaymentsTab } from "../components/tabs/PaymentsTab";
import { UsersTab } from "../components/tabs/UsersTab";
import { BroadcastTab } from "../components/tabs/BroadcastTab";
import { AttendanceTab } from "../components/tabs/AttendanceTab";
import { SettingsTab } from "../components/tabs/SettingsTab";

/**
 * Reads an error response defensively: a proxy can hand back an HTML page
 * (res.json() throws) and class-validator returns `message` as an array.
 */
async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    const m = (data as { message?: unknown })?.message;
    if (Array.isArray(m)) return m.join(", ");
    if (typeof m === "string" && m) return m;
  } catch {
    // non-JSON body — fall through to the generic message
  }
  return `${fallback} (HTTP ${res.status})`;
}

/** One list feed from the API. `ok: false` keeps the previous state on screen. */
interface Feed {
  ok: boolean;
  /** HTTP status; 0 = network error, -1 = timed out. */
  status: number;
  rows: Record<string, unknown>[];
  payload: unknown;
  nextCursor: string | null;
}

/** Rows fetched with "Load more" beyond the polled first page. */
interface MorePages<T> {
  rows: T[];
  cursor: string | null;
}

type PagedFeed = "users" | "reports" | "payments";

const FEED_NAMES: FeedName[] = [
  "stats",
  "events",
  "reports",
  "payments",
  "ngos",
  "users",
  "attendance",
  "broadcasts",
];

const FEED_LABELS: Record<FeedName, string> = {
  stats: "Stats",
  events: "Events",
  reports: "Reports",
  payments: "Payments",
  ngos: "NGOs",
  users: "Users",
  attendance: "Attendance",
  broadcasts: "Broadcasts",
};

/** Feeds a tab cannot honestly render without (NGOs/broadcasts handle their own). */
const FEEDS_BY_TAB: Partial<Record<TabType, FeedName[]>> = {
  dashboard: ["stats", "events"],
  analytics: ["stats", "events", "attendance", "payments"],
  events: ["events"],
  moderation: ["reports"],
  payments: ["payments"],
  users: ["users"],
  attendance: ["attendance"],
};

const initialFeedHealth = (): Record<FeedName, FeedHealth> =>
  FEED_NAMES.reduce(
    (acc, name) => {
      acc[name] = { loaded: false, lastErrorStatus: null, nextCursor: null };
      return acc;
    },
    {} as Record<FeedName, FeedHealth>
  );

const timeoutSignal = () => AbortSignal.timeout(REQUEST_TIMEOUT_MS);

const isTimeout = (err: unknown) =>
  err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");

// List endpoints return { data, nextCursor }. Older ones returned a bare
// array; accept both so a partially deployed API does not blank the screen.
function toList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload;
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: Record<string, unknown>[] }).data;
  }
  return [];
}

function cursorOf(payload: unknown): string | null {
  const c = (payload as { nextCursor?: unknown } | null)?.nextCursor;
  return typeof c === "string" && c ? c : null;
}

/** GET with the admin token, bounded by a timeout. Never throws. */
async function getFeed(path: string, token: string): Promise<Feed> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: timeoutSignal(),
    });
    if (!res.ok) {
      return { ok: false, status: res.status, rows: [], payload: null, nextCursor: null };
    }
    const payload = await res.json();
    return {
      ok: true,
      status: res.status,
      rows: toList(payload),
      payload,
      nextCursor: cursorOf(payload),
    };
  } catch (err) {
    return {
      ok: false,
      status: isTimeout(err) ? -1 : 0,
      rows: [],
      payload: null,
      nextCursor: null,
    };
  }
}

/** Appends `more` to `first`, skipping ids already present. */
function mergeById<T extends { id: string }>(first: T[], more: T[]): T[] {
  const seen = new Set(first.map(r => r.id));
  return [...first, ...more.filter(r => !seen.has(r.id))];
}

const fmtDate = (value: unknown) =>
  value ? new Date(value as string).toLocaleDateString() : "";

const usersPath = (q: string) =>
  `/auth/users?limit=${LIST_PAGE_SIZE}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
const REPORTS_PATH = `/reports?limit=${LIST_PAGE_SIZE}`;
const PAYMENTS_PATH = `/payments?limit=${LIST_PAGE_SIZE}`;

/** GET /ngos?status= (falls back to /ngos/pending on an API without it). */
async function getNgoFeed(status: NgoStatus, token: string): Promise<Feed> {
  const feed = await getFeed(`/ngos?status=${status}&limit=${LIST_PAGE_SIZE}`, token);
  if (!feed.ok && feed.status === 404 && status === "PENDING") {
    return getFeed(`/ngos/pending?limit=${LIST_PAGE_SIZE}`, token);
  }
  return feed;
}

function mapReport(rep: any): SafetyReport {
  const targetType: "EVENT" | "USER" =
    rep.targetType === "USER" || (!rep.eventId && rep.targetUser) ? "USER" : "EVENT";
  return {
    id: rep.id,
    targetType,
    eventId: rep.eventId ?? rep.event?.id ?? null,
    eventName: rep.event?.title || (targetType === "USER" ? "" : "Reported Drive"),
    eventStatus: rep.event?.status,
    organizerName: rep.event?.organizer?.fullName,
    organizerEmail: rep.event?.organizer?.email,
    targetUser: rep.targetUser ?? null,
    messageId: rep.messageId ?? null,
    category: rep.category,
    reporter: rep.reporter?.fullName || "Platform User",
    reporterEmail: rep.reporter?.email,
    reason: rep.reason,
    resolved: rep.resolved,
    date: fmtDate(rep.createdAt),
  };
}

function mapEvent(evt: any, reportsCount = 0): EventItem {
  return {
    id: evt.id,
    name: evt.title,
    description: evt.description,
    organizer: evt.organizer?.fullName || "Host Organization",
    organizerId: evt.organizer?.id,
    organizerEmail: evt.organizer?.email || "N/A",
    isOrganizerVerified: Boolean(evt.isOrganizerVerified),
    category: evt.category,
    location: evt.address,
    volunteersApplied: evt.applicationCount ?? 0,
    approvedCount: evt.approvedCount ?? 0,
    volunteersNeeded: evt.volunteersNeeded,
    minAge: evt.minAge ?? 16,
    isPaid: evt.isPaid || false,
    compensationDetails: evt.compensationDetails,
    startTime: evt.startTime ? new Date(evt.startTime).toLocaleString() : undefined,
    endTime: evt.endTime ? new Date(evt.endTime).toLocaleString() : undefined,
    status: evt.status as EventStatusValue,
    openPositions: evt.openPositions || [],
    perks: evt.perks || [],
    bannerUrl: evt.bannerUrl,
    applications: undefined,
    attendanceLog: [],
    reports: [],
    reportsCount,
    hoursLoggedTotal: evt.hoursLoggedTotal ?? 0,
    attendanceCount: evt.attendanceCount ?? 0,
  };
}

function mapPayment(tx: any): PaymentTransaction {
  return {
    id: tx.id,
    donor: tx.user?.fullName || "Deleted account",
    type: tx.type,
    amount: tx.amount,
    currency: tx.currency,
    status: tx.status,
    txRef: tx.txRef,
    date: fmtDate(tx.createdAt),
    eventName: tx.event?.title,
  };
}

function mapNgo(ngo: any): NGO {
  return {
    id: ngo.id,
    name: ngo.ngoName,
    contactName: ngo.user?.fullName || "Unknown applicant",
    email: ngo.user?.email || "No Email",
    phone: ngo.user?.phoneNumber || "No Phone",
    contactDetails: ngo.contactDetails || "",
    registrationDocs: ngo.registrationDocs || "",
    identityProof: ngo.identityProof || "",
    status: ngo.status,
    submittedAt: fmtDate(ngo.createdAt),
    updatedAt: fmtDate(ngo.updatedAt ?? ngo.createdAt),
    verifiedAt: fmtDate(ngo.verifiedAt),
  };
}

function mapUser(u: any): PlatformUser {
  return {
    id: u.id,
    email: u.email,
    phoneNumber: u.phoneNumber,
    fullName: u.fullName,
    userType: u.userType,
    isBanned: u.isBanned,
    createdAt: fmtDate(u.createdAt),
    profile: u.profile,
  };
}

/** Upper bound of broadcast recipients from /admin/stats (banned are excluded server-side). */
function audienceSize(
  stats: AdminStats | null,
  role: "ALL" | "VOLUNTEER" | "ORGANIZER"
): number | null {
  if (!stats) return null;
  if (role === "VOLUNTEER") return stats.users.volunteers;
  if (role === "ORGANIZER") return stats.users.organizers;
  return stats.users.total;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  // Auth States
  const [token, setToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<any | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Login Form States
  const [authStep, setAuthStep] = useState<"identifier" | "otp">("identifier");
  const [identifier, setIdentifier] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real-time Data States
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [ngos, setNgos] = useState<NGO[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [usersList, setUsersList] = useState<PlatformUser[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [broadcastHistory, setBroadcastHistory] = useState<
    BroadcastNotification[]
  >([]);

  // Sync health. A feed that fails keeps its previous rows on screen and is
  // named here, instead of silently rendering as "no data".
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  // At least one sync has been attempted (not: succeeded).
  const [hasLoaded, setHasLoaded] = useState(false);
  // Per feed: has it ever loaded, last failure, cursor for page 2.
  const [feedHealth, setFeedHealth] = useState(initialFeedHealth);

  // "Load more" pages beyond the polled first page. null = none loaded.
  const [usersMore, setUsersMore] = useState<MorePages<PlatformUser> | null>(null);
  const [reportsMore, setReportsMore] = useState<MorePages<SafetyReport> | null>(null);
  const [paymentsMore, setPaymentsMore] =
    useState<MorePages<PaymentTransaction> | null>(null);
  const [loadingMore, setLoadingMore] = useState<Record<PagedFeed, boolean>>({
    users: false,
    reports: false,
    payments: false,
  });
  // Mirrors "has extra pages" for the poll, which must not drop rows that
  // slid out of page 1 while later pages are on screen.
  const morePagesRef = useRef<Record<PagedFeed, boolean>>({
    users: false,
    reports: false,
    payments: false,
  });

  // Users search (server-side, debounced).
  const [userSearch, setUserSearch] = useState("");
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const userQueryRef = useRef("");

  // NGO verification status tab.
  const [ngoStatus, setNgoStatus] = useState<NgoStatus>("PENDING");
  const [ngosLoading, setNgosLoading] = useState(false);
  const ngoStatusRef = useRef<NgoStatus>("PENDING");
  // Outcome of the last moderation action that did not succeed.
  const [actionError, setActionError] = useState("");

  // Broadcast Form State
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastTargetRole, setBroadcastTargetRole] = useState<
    "ALL" | "VOLUNTEER" | "ORGANIZER"
  >("ALL");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  // State updates are async; this blocks a second submit in the same frame.
  const broadcastInFlightRef = useRef(false);

  // Console Settings State. Eight requests per tick against a 120/min limit
  // means anything under 10s (or two open tabs at 5s) gets rate limited.
  const [autoSyncSeconds, setAutoSyncSeconds] = useState(10);

  // Restore the session after mount. localStorage is unavailable while the
  // static shell is rendered, so this cannot move into a state initialiser.
  // Deferred a tick so the first paint is not a synchronous re-render.
  useEffect(() => {
    const restore = () => {
      // A corrupted admin_user (partial write, manual edit) must not strand
      // the app on the loading screen — drop the session and show login.
      try {
        const savedToken = localStorage.getItem("admin_token");
        const savedUser = localStorage.getItem("admin_user");
        if (savedToken && savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setToken(savedToken);
          setAdminUser(parsedUser);
        }
      } catch {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
      } finally {
        setIsAuthLoading(false);
      }
    };
    const id = window.setTimeout(restore, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Real-Time Auto Sync & Data Polling States
  const [lastSyncTime, setLastSyncTime] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Poll-race guards: a slow older poll must never overwrite newer state
  // (it would resurrect a just-approved NGO or un-ban a user for a cycle),
  // and a tick must not stack on one still in flight. Every successful
  // mutation also bumps the sequence so an in-flight poll that started
  // before the change is discarded.
  const syncSeqRef = useRef(0);
  const syncBusyRef = useRef(false);
  // Per-action in-flight guard, so a double click cannot send two requests.
  const busyRef = useRef(new Set<string>());
  // Latest reports, for deriving per-event flag counts when the report feed
  // itself failed on this tick.
  const reportsRef = useRef<SafetyReport[]>([]);

  // An expired/invalid token means every authed call 401s forever; without
  // this the dashboard would poll uselessly instead of asking to sign in.
  const expireSession = useCallback(
    (message = "Your session has expired. Please sign in again.") => {
      syncSeqRef.current++;
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      setToken(null);
      setAdminUser(null);
      setStats(null);
      setHasLoaded(false);
      setFeedHealth(initialFeedHealth());
      setAuthStep("identifier");
      setAuthError(message);
    },
    []
  );

  /** Records one feed's outcome: loaded stays true once it has ever succeeded. */
  const recordFeed = useCallback((name: FeedName, feed: Feed) => {
    setFeedHealth(prev => ({
      ...prev,
      [name]: {
        loaded: prev[name].loaded || feed.ok,
        lastErrorStatus: feed.ok ? null : feed.status,
        nextCursor: feed.ok ? feed.nextCursor : prev[name].nextCursor,
      },
    }));
  }, []);

  const fetchDashboardData = useCallback(
    async (currentToken: string) => {
      if (!currentToken) return;
      if (syncBusyRef.current) return;
      syncBusyRef.current = true;
      const seq = ++syncSeqRef.current;
      let sessionExpired = false;
      let forbidden = false;
      setIsSyncing(true);

      // Snapshot the query/filter this poll uses; if the admin changes them
      // while it is in flight, that feed's result is stale and is dropped.
      const usedUserQuery = userQueryRef.current;
      const usedNgoStatus = ngoStatusRef.current;

      const authed = async (feedPromise: Promise<Feed>): Promise<Feed> => {
        const feed = await feedPromise;
        if (feed.status === 401) sessionExpired = true;
        if (feed.status === 403) forbidden = true;
        return feed;
      };

      try {
        const [
          statsFeed,
          eventFeed,
          reportFeed,
          paymentFeed,
          ngoFeed,
          userFeed,
          attendanceFeed,
          broadcastFeed,
        ] = await Promise.all([
          // Exact platform-wide counts — the lists below are one page each.
          authed(getFeed("/admin/stats", currentToken)),
          // Admin listing: includes suspended/draft/completed events and the
          // organizer's email — the public /events hides both.
          authed(getFeed(`/events/admin/all?limit=${LIST_PAGE_SIZE}`, currentToken)),
          authed(getFeed(REPORTS_PATH, currentToken)),
          // Platform-wide ledger. /payments/history is only the caller's own.
          authed(getFeed(PAYMENTS_PATH, currentToken)),
          authed(getNgoFeed(usedNgoStatus, currentToken)),
          authed(getFeed(usersPath(usedUserQuery), currentToken)),
          authed(getFeed(`/attendance/admin/all?limit=${LIST_PAGE_SIZE}`, currentToken)),
          authed(getFeed(`/notifications/history?limit=${LIST_PAGE_SIZE}`, currentToken)),
        ]);

        if (sessionExpired) {
          expireSession();
          return;
        }
        // Every feed is admin-only: a 403 means this token belongs to a
        // non-admin account (e.g. planted in localStorage), not a glitch.
        if (forbidden) {
          expireSession("This account does not have administrator access.");
          return;
        }
        // A newer sync (or a logout / mutation) started while this one was
        // in flight — its data is stale; drop it.
        if (seq !== syncSeqRef.current) return;

        const userFeedCurrent = userQueryRef.current === usedUserQuery;
        const ngoFeedCurrent = ngoStatusRef.current === usedNgoStatus;

        const failures: string[] = [];
        const feeds: [FeedName, Feed, boolean][] = [
          ["stats", statsFeed, true],
          ["events", eventFeed, true],
          ["reports", reportFeed, true],
          ["payments", paymentFeed, true],
          ["ngos", ngoFeed, ngoFeedCurrent],
          ["users", userFeed, userFeedCurrent],
          ["attendance", attendanceFeed, true],
          ["broadcasts", broadcastFeed, true],
        ];
        for (const [name, feed, current] of feeds) {
          if (!current) continue;
          recordFeed(name, feed);
          if (!feed.ok) {
            failures.push(`${FEED_LABELS[name]} (${describeFeedError(feed.status)})`);
          }
        }

        if (statsFeed.ok) setStats(statsFeed.payload as AdminStats);

        let currentReports = reportsRef.current;
        if (reportFeed.ok) {
          const page1 = reportFeed.rows.map(mapReport);
          currentReports = morePagesRef.current.reports
            ? mergeById(page1, reportsRef.current)
            : page1;
          reportsRef.current = currentReports;
          setReports(currentReports);
        }

        if (eventFeed.ok) {
          // The public event list no longer carries reports or applicant
          // details — those leaked volunteer emails. Report counts are derived
          // from the admin-only reports feed instead, and applicants load on
          // demand.
          const reportsByEvent = currentReports
            .filter(rep => !rep.resolved && rep.eventId)
            .reduce((acc: Record<string, number>, rep) => {
              const key = rep.eventId as string;
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            }, {});

          setEvents(
            eventFeed.rows.map((evt: any) => mapEvent(evt, reportsByEvent[evt.id] || 0))
          );
        }

        if (paymentFeed.ok) {
          const page1 = paymentFeed.rows.map(mapPayment);
          setTransactions(prev =>
            morePagesRef.current.payments ? mergeById(page1, prev) : page1
          );
        }

        if (ngoFeed.ok && ngoFeedCurrent) {
          setNgos(ngoFeed.rows.map(mapNgo));
          setNgosLoading(false);
        }

        if (userFeed.ok && userFeedCurrent) {
          const page1 = userFeed.rows.map(mapUser);
          setUsersList(prev =>
            morePagesRef.current.users ? mergeById(page1, prev) : page1
          );
        }

        if (attendanceFeed.ok) {
          setAttendanceLogs(attendanceFeed.rows as unknown as AttendanceLog[]);
        }
        if (broadcastFeed.ok) {
          setBroadcastHistory(
            broadcastFeed.rows as unknown as BroadcastNotification[]
          );
        }

        setSyncErrors(failures);
        if (failures.length === 0) {
          setLastSyncTime(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.error("Error syncing live dashboard data:", err);
        setSyncErrors(["Unexpected error while syncing"]);
      } finally {
        syncBusyRef.current = false;
        setIsSyncing(false);
        setHasLoaded(true);
      }
    },
    [expireSession, recordFeed]
  );

  /**
   * Applicant details are loaded only when an admin opens a specific event.
   * They used to arrive with the public event list, which exposed every
   * volunteer's email address to anonymous callers.
   */
  const handleSelectEvent = useCallback(
    async (event: EventItem | null) => {
      setSelectedEvent(
        event ? { ...event, applications: undefined, applicationsError: undefined } : null
      );
      if (!event || !token) return;

      const patch = (update: Partial<EventItem>) =>
        setSelectedEvent(current =>
          current && current.id === event.id ? { ...current, ...update } : current
        );

      try {
        const res = await fetch(
          `${API_BASE_URL}/applications/event/${event.id}?limit=${LIST_PAGE_SIZE}`,
          { headers: { Authorization: `Bearer ${token}` }, signal: timeoutSignal() }
        );
        if (res.status === 401) {
          expireSession();
          return;
        }
        if (!res.ok) {
          patch({
            applications: [],
            applicationsError: await readApiError(
              res,
              "Could not load the applicant roster"
            ),
          });
          return;
        }

        const payload = await res.json();
        const applications = Array.isArray(payload)
          ? payload
          : payload?.data ?? [];
        patch({ applications, applicationsError: undefined });
      } catch (err) {
        console.error("Could not load applicants for this event:", err);
        patch({
          applications: [],
          applicationsError: isTimeout(err)
            ? "Could not load the applicant roster — the request timed out."
            : "Could not load the applicant roster — network error.",
        });
      }
    },
    [token, expireSession]
  );

  /** First page of users for a search query (outside the poll cadence). */
  const refreshUsers = useCallback(
    async (q: string) => {
      if (!token) return;
      setIsSearchingUsers(true);
      const feed = await getFeed(usersPath(q), token);
      if (userQueryRef.current !== q) return; // superseded by a newer query
      setIsSearchingUsers(false);
      if (feed.status === 401) {
        expireSession();
        return;
      }
      recordFeed("users", feed);
      if (feed.ok) {
        setUsersList(feed.rows.map(mapUser));
      } else {
        setActionError(`User search failed (${describeFeedError(feed.status)}).`);
      }
    },
    [token, expireSession, recordFeed]
  );

  // Debounced server-side search: GET /auth/users?q=
  useEffect(() => {
    if (!token) return;
    const id = window.setTimeout(() => {
      const q = userSearch.trim();
      if (q === userQueryRef.current) return;
      userQueryRef.current = q;
      morePagesRef.current.users = false;
      setUsersMore(null);
      void refreshUsers(q);
    }, 400);
    return () => window.clearTimeout(id);
  }, [userSearch, token, refreshUsers]);

  /** Switching the NGO status tab loads that list immediately. */
  const handleNgoStatusChange = useCallback(
    async (status: NgoStatus) => {
      if (!token || status === ngoStatusRef.current) return;
      ngoStatusRef.current = status;
      setNgoStatus(status);
      setNgos([]);
      setNgosLoading(true);
      setFeedHealth(prev => ({
        ...prev,
        ngos: { loaded: false, lastErrorStatus: null, nextCursor: null },
      }));
      const feed = await getNgoFeed(status, token);
      if (ngoStatusRef.current !== status) return;
      if (feed.status === 401) {
        expireSession();
        return;
      }
      recordFeed("ngos", feed);
      setNgosLoading(false);
      if (feed.ok) setNgos(feed.rows.map(mapNgo));
    },
    [token, expireSession, recordFeed]
  );

  /** "Load more" for Users, Safety Reports and Payments via nextCursor. */
  const handleLoadMore = async (kind: PagedFeed) => {
    if (!token || loadingMore[kind]) return;
    const more =
      kind === "users" ? usersMore : kind === "reports" ? reportsMore : paymentsMore;
    const cursor = more ? more.cursor : feedHealth[kind].nextCursor;
    if (!cursor) return;
    const base =
      kind === "users"
        ? usersPath(userQueryRef.current)
        : kind === "reports"
        ? REPORTS_PATH
        : PAYMENTS_PATH;
    const usedQuery = userQueryRef.current;

    setLoadingMore(prev => ({ ...prev, [kind]: true }));
    const feed = await getFeed(`${base}&cursor=${encodeURIComponent(cursor)}`, token);
    setLoadingMore(prev => ({ ...prev, [kind]: false }));

    if (feed.status === 401) {
      expireSession();
      return;
    }
    if (!feed.ok) {
      setActionError(
        `Could not load more ${kind} (${describeFeedError(feed.status)}).`
      );
      return;
    }
    morePagesRef.current[kind] = true;
    if (kind === "users") {
      if (userQueryRef.current !== usedQuery) return;
      const rows = feed.rows.map(mapUser);
      setUsersMore(prev => ({ rows: [...(prev?.rows ?? []), ...rows], cursor: feed.nextCursor }));
    } else if (kind === "reports") {
      const rows = feed.rows.map(mapReport);
      setReportsMore(prev => ({ rows: [...(prev?.rows ?? []), ...rows], cursor: feed.nextCursor }));
    } else {
      const rows = feed.rows.map(mapPayment);
      setPaymentsMore(prev => ({ rows: [...(prev?.rows ?? []), ...rows], cursor: feed.nextCursor }));
    }
  };

  // Polling setup. The first fetch is deferred a tick so its setIsSyncing(true)
  // does not run synchronously inside the effect and cascade a re-render.
  // Polling pauses while the tab is hidden; a hidden tab's requests still
  // count against the API rate limit.
  useEffect(() => {
    if (!token) return;

    const initial = window.setTimeout(() => {
      void fetchDashboardData(token);
    }, 0);

    const interval = window.setInterval(() => {
      if (document.hidden) return;
      void fetchDashboardData(token);
    }, autoSyncSeconds * 1000);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [token, autoSyncSeconds, fetchDashboardData]);

  // Auth Operations
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = identifier.trim();
    if (!id) return;
    setAuthError("");
    setAuthMsg("");
    setDevOtp("");
    setIsSubmitting(true);

    try {
      const isEmail = id.includes("@");
      const body = isEmail ? { email: id } : { phoneNumber: id };

      const res = await fetch(`${API_BASE_URL}/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: timeoutSignal(),
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, "Failed to request OTP code."));
      }
      const data = await res.json();

      setAuthStep("otp");
      setAuthMsg("If this address belongs to an administrator, a code has been sent.");
      // Only for a local API in a non-production build (WEB-21).
      if (DEV_OTP_VISIBLE && typeof data.otpInDev === "string") {
        setDevOtp(data.otpInDev);
      }
    } catch (err: any) {
      setAuthError(
        isTimeout(err)
          ? "The API did not respond in time. Try again."
          : err.message || "An authentication error occurred."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = identifier.trim();
    const code = otpCode.trim();
    if (!code) return;
    setAuthError("");
    setAuthMsg("");
    setIsSubmitting(true);

    try {
      const isEmail = id.includes("@");
      const body = isEmail
        ? { email: id, code }
        : { phoneNumber: id, code };

      const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: timeoutSignal(),
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, "Invalid OTP verification code."));
      }
      const data = await res.json();

      if (data.user?.userType !== "ADMIN") {
        throw new Error("Access Denied: Account lacks Administrator role privileges.");
      }

      setToken(data.accessToken);
      setAdminUser(data.user);
      localStorage.setItem("admin_token", data.accessToken);
      localStorage.setItem("admin_user", JSON.stringify(data.user));
      // The polling effect owns the first fetch — calling it here too fired
      // two identical request bursts that could interleave.
    } catch (err: any) {
      setAuthError(
        isTimeout(err)
          ? "The API did not respond in time. Try again."
          : err.message || "Authentication failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    syncSeqRef.current++; // discard any in-flight sync
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    setToken(null);
    setAdminUser(null);
    setStats(null);
    setHasLoaded(false);
    setFeedHealth(initialFeedHealth());
    morePagesRef.current = { users: false, reports: false, payments: false };
    setUsersMore(null);
    setReportsMore(null);
    setPaymentsMore(null);
    userQueryRef.current = "";
    setUserSearch("");
    ngoStatusRef.current = "PENDING";
    setNgoStatus("PENDING");
    setSyncErrors([]);
    setActionError("");
    setAuthStep("identifier");
    setIdentifier("");
    setOtpCode("");
    setDevOtp("");
    setAuthMsg("");
    setAuthError("");
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = broadcastTitle.trim();
    const body = broadcastBody.trim();
    if (!title || !body || !token) return;
    if (broadcastInFlightRef.current) return;

    // A broadcast is a push + inbox entry for every recipient and cannot be
    // recalled — spell out who receives what before sending (WEB-19).
    const audience = audienceSize(stats, broadcastTargetRole);
    const audienceLabel =
      broadcastTargetRole === "ALL"
        ? "all users"
        : broadcastTargetRole === "VOLUNTEER"
        ? "volunteers"
        : "organizers";
    if (
      !window.confirm(
        `Send this broadcast to ${
          audience === null ? "every account" : `up to ${audience.toLocaleString("en-IN")} accounts`
        } (${audienceLabel})? Banned accounts are excluded.\n\nTitle: ${oneLine(title, 120)}\n\n${body.slice(0, 500)}\n\nIt is pushed to devices and placed in each recipient's inbox. It cannot be recalled.`
      )
    ) {
      return;
    }

    broadcastInFlightRef.current = true;
    setIsBroadcasting(true);
    setBroadcastMsg("");

    try {
      const res = await fetch(`${API_BASE_URL}/notifications/broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          body,
          targetRole: broadcastTargetRole,
        }),
        signal: timeoutSignal(),
      });

      if (res.status === 401) {
        expireSession();
        return;
      }
      if (!res.ok) {
        throw new Error(await readApiError(res, "Failed to dispatch broadcast"));
      }
      const data = await res.json();

      setBroadcastMsg(`✓ ${data.message || "Broadcast dispatched successfully!"}`);
      setBroadcastTitle("");
      setBroadcastBody("");
      syncSeqRef.current++;
      if (token) void fetchDashboardData(token);
    } catch (err: any) {
      setBroadcastMsg(
        isTimeout(err)
          ? "⚠️ Error: the request timed out. Check the Sent Notifications Log before retrying — it may have been delivered."
          : `⚠️ Error: ${err.message}`
      );
    } finally {
      broadcastInFlightRef.current = false;
      setIsBroadcasting(false);
    }
  };

  /**
   * Shared path for every moderation action: one request per key at a time,
   * 401 ends the session, any other failure is shown to the admin (the old
   * handlers logged to the console and left the row unchanged with no hint),
   * and success bumps the poll sequence so a stale poll cannot undo it.
   */
  const runAction = useCallback(
    async (
      key: string,
      request: (authToken: string) => Promise<Response>,
      fallback: string
    ): Promise<any | null> => {
      if (!token) return null;
      if (busyRef.current.has(key)) return null;
      busyRef.current.add(key);
      try {
        const res = await request(token);
        if (res.status === 401) {
          expireSession();
          return null;
        }
        if (!res.ok) {
          setActionError(await readApiError(res, fallback));
          return null;
        }
        syncSeqRef.current++;
        setActionError("");
        try {
          return await res.json();
        } catch {
          return {};
        }
      } catch (err) {
        setActionError(
          isTimeout(err)
            ? `${fallback} — the request timed out. Refresh to check whether it was applied.`
            : `${fallback} — network error.`
        );
        return null;
      } finally {
        busyRef.current.delete(key);
      }
    },
    [token, expireSession]
  );

  const patchJson = (authToken: string, path: string, body?: unknown) =>
    fetch(`${API_BASE_URL}${path}`, {
      method: "PATCH",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${authToken}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeoutSignal(),
    });

  const decrementPendingNgos = () =>
    setStats(prev =>
      prev ? { ...prev, ngos: { pending: Math.max(0, prev.ngos.pending - 1) } } : prev
    );

  // Moderation Actions
  const handleApproveNGO = async (id: string) => {
    const ngo = ngos.find(n => n.id === id);
    if (
      !window.confirm(
        `Approve "${oneLine(ngo?.name ?? "this organization")}"?\n\nThe account becomes an ORGANIZER and can publish drives, review applicants and receive donations.`
      )
    ) {
      return;
    }
    const data = await runAction(
      `ngo:${id}`,
      t => patchJson(t, `/ngos/${id}/verify`, { status: "APPROVED" }),
      "Could not approve the organization"
    );
    if (data) {
      setNgos(prev => prev.filter(n => n.id !== id));
      decrementPendingNgos();
    }
  };

  const handleRejectNGO = async (id: string) => {
    const ngo = ngos.find(n => n.id === id);
    if (
      !window.confirm(
        `Reject "${oneLine(ngo?.name ?? "this organization")}"?\n\nIf the account is currently an organizer it is demoted to volunteer and every one of its upcoming drives is CANCELLED. This cannot be undone from the console.`
      )
    ) {
      return;
    }
    const data = await runAction(
      `ngo:${id}`,
      t => patchJson(t, `/ngos/${id}/verify`, { status: "REJECTED" }),
      "Could not reject the organization"
    );
    if (data) {
      setNgos(prev => prev.filter(n => n.id !== id));
      decrementPendingNgos();
    }
  };

  /** APPROVED → REJECTED: demotes the organizer and cancels their drives. */
  const handleRevokeNGO = async (id: string) => {
    const ngo = ngos.find(n => n.id === id);
    if (
      !window.confirm(
        `Revoke verification for "${oneLine(ngo?.name ?? "this organization")}"?\n\nThe account is demoted to volunteer and ALL of the organizer's upcoming drives are CANCELLED — every pending and approved volunteer on those drives is notified. This cannot be undone from the console.`
      )
    ) {
      return;
    }
    const data = await runAction(
      `ngo:${id}`,
      t => patchJson(t, `/ngos/${id}/verify`, { status: "REJECTED" }),
      "Could not revoke the verification"
    );
    if (data) {
      setNgos(prev => prev.filter(n => n.id !== id));
    }
  };

  /** Applies a mapping to page-1 and "load more" report rows alike. */
  const updateReports = (fn: (rep: SafetyReport) => SafetyReport) => {
    setReports(prev => {
      const next = prev.map(fn);
      reportsRef.current = next;
      return next;
    });
    setReportsMore(prev => (prev ? { ...prev, rows: prev.rows.map(fn) } : prev));
  };

  const applyEventStatus = async (id: string, next: EventStatusValue) => {
    const data = await runAction(
      `event:${id}`,
      t => patchJson(t, `/events/${id}/status`, { status: next }),
      "Could not update the event status"
    );
    if (data) {
      setEvents(prev => prev.map(e => (e.id === id ? { ...e, status: next } : e)));
      setSelectedEvent(cur => (cur && cur.id === id ? { ...cur, status: next } : cur));
      updateReports(rep => (rep.eventId === id ? { ...rep, eventStatus: next } : rep));
    }
    return Boolean(data);
  };

  /** Feature / Unfeature / Suspend / Reinstate / Cancel (WEB-15). */
  const handleEventAction = async (id: string, action: AdminEventAction) => {
    const target =
      events.find(e => e.id === id) ??
      (selectedEvent && selectedEvent.id === id ? selectedEvent : undefined);
    if (!target) return;

    const def = findEventAction(target.status, action);
    if (!def) {
      setActionError(
        `"${oneLine(target.name)}" is ${target.status}; that action is not available for it.`
      );
      return;
    }
    if (def.confirm && !window.confirm(def.confirm(target.name))) {
      return;
    }
    await applyEventStatus(id, def.next);
  };

  const resolveReport = async (reportId: string) => {
    const data = await runAction(
      `report:${reportId}`,
      t =>
        fetch(`${API_BASE_URL}/reports/${reportId}/resolve`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${t}` },
          signal: timeoutSignal(),
        }),
      "Could not resolve the report"
    );
    if (data) {
      updateReports(rep => (rep.id === reportId ? { ...rep, resolved: true } : rep));
      setStats(prev =>
        prev
          ? {
              ...prev,
              reports: {
                open: Math.max(0, prev.reports.open - 1),
                resolved: prev.reports.resolved + 1,
              },
            }
          : prev
      );
    }
  };

  const allReports = useMemo(
    () => mergeById(reports, reportsMore?.rows ?? []),
    [reports, reportsMore]
  );

  const handleDismissReport = async (reportId: string) => {
    const rep = allReports.find(r => r.id === reportId);
    const subject =
      rep?.targetType === "USER"
        ? rep.targetUser?.fullName ?? "this account"
        : rep?.eventName || "this drive";
    if (
      !window.confirm(
        `Dismiss this flag against "${oneLine(subject)}" and mark it resolved without taking action?\n\nResolved reports cannot be reopened from the console.`
      )
    ) {
      return;
    }
    await resolveReport(reportId);
  };

  const handleSuspendReportedEvent = async (reportId: string) => {
    const rep = allReports.find(r => r.id === reportId);
    if (!rep?.eventId) return;
    const eventId = rep.eventId;
    const target = events.find(e => e.id === eventId);
    const status = target?.status ?? rep.eventStatus;
    const name = target?.name ?? rep.eventName ?? "the reported drive";

    if (status === "SUSPENDED") {
      if (
        window.confirm(
          `"${oneLine(name)}" is already suspended. Mark this report resolved?`
        )
      ) {
        await resolveReport(reportId);
      }
      return;
    }
    if (status && !findEventAction(status, "SUSPEND")) {
      setActionError(
        `"${oneLine(name)}" is ${status} and cannot be suspended. Dismiss the flag or inspect the drive instead.`
      );
      return;
    }
    if (
      !window.confirm(
        `Suspend "${oneLine(name)}" and mark this report resolved?\n\nThe drive is hidden from volunteers, its pending and approved volunteers are notified, and only an administrator can reinstate it.`
      )
    ) {
      return;
    }
    const suspended = await applyEventStatus(eventId, "SUSPENDED");
    if (suspended) {
      await resolveReport(reportId);
    }
  };

  /** Opens the event modal for a report, fetching the drive if it is not loaded. */
  const handleInspectReportEvent = async (reportId: string) => {
    const rep = allReports.find(r => r.id === reportId);
    if (!rep?.eventId || !token) return;
    const loaded = events.find(e => e.id === rep.eventId);
    if (loaded) {
      void handleSelectEvent(loaded);
      return;
    }
    const fallback: EventItem = {
      id: rep.eventId,
      name: rep.eventName || "Reported drive",
      organizer: rep.organizerName || "Unknown organizer",
      organizerEmail: rep.organizerEmail || "N/A",
      category: "",
      location: "",
      volunteersApplied: 0,
      approvedCount: 0,
      volunteersNeeded: 0,
      status: rep.eventStatus ?? "ACTIVE",
    };
    try {
      const res = await fetch(`${API_BASE_URL}/events/${rep.eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: timeoutSignal(),
      });
      if (res.status === 401) {
        expireSession();
        return;
      }
      if (!res.ok) {
        void handleSelectEvent(fallback);
        return;
      }
      const evt = await res.json();
      const mapped = mapEvent(evt);
      // The public detail route omits the organizer email; keep the report's.
      void handleSelectEvent({
        ...mapped,
        organizerEmail:
          mapped.organizerEmail === "N/A" ? fallback.organizerEmail : mapped.organizerEmail,
      });
    } catch {
      void handleSelectEvent(fallback);
    }
  };

  /** USER reports: jump to the Users tab filtered to the reported account. */
  const handleFindReportedUser = (email: string) => {
    setUserSearch(email);
    setActiveTab("users");
  };

  const handleDeleteEvent = async (id: string) => {
    const target =
      events.find(e => e.id === id) ??
      (selectedEvent && selectedEvent.id === id ? selectedEvent : undefined);
    if (
      !window.confirm(
        `Permanently delete "${oneLine(target?.name ?? "this drive")}"?\n\nOnly drives with no applications, attendance or reports can be deleted — otherwise the API refuses and you should Cancel or Suspend it instead.`
      )
    ) {
      return;
    }
    const data = await runAction(
      `event-delete:${id}`,
      t =>
        fetch(`${API_BASE_URL}/events/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${t}` },
          signal: timeoutSignal(),
        }),
      "Could not delete the event"
    );
    if (data) {
      setEvents(prev => prev.filter(e => e.id !== id));
      setSelectedEvent(cur => (cur?.id === id ? null : cur));
    }
  };

  const allUsers = useMemo(
    () => mergeById(usersList, usersMore?.rows ?? []),
    [usersList, usersMore]
  );
  const allTransactions = useMemo(
    () => mergeById(transactions, paymentsMore?.rows ?? []),
    [transactions, paymentsMore]
  );

  const handleToggleUserBan = async (id: string, currentBanStatus: boolean) => {
    const nextBanStatus = !currentBanStatus;
    const user = allUsers.find(u => u.id === id);
    if (
      nextBanStatus &&
      !window.confirm(
        `Suspend ${oneLine(user?.fullName ?? "this account")} (${oneLine(user?.email ?? id)})?\n\nTheir session stops working immediately and they cannot request a login code until reinstated.`
      )
    ) {
      return;
    }
    const data = await runAction(
      `user:${id}`,
      t => patchJson(t, `/auth/users/${id}/ban`, { isBanned: nextBanStatus }),
      nextBanStatus ? "Could not suspend the account" : "Could not reinstate the account"
    );
    if (data) {
      const flip = (u: PlatformUser) => (u.id === id ? { ...u, isBanned: nextBanStatus } : u);
      setUsersList(prev => prev.map(flip));
      setUsersMore(prev => (prev ? { ...prev, rows: prev.rows.map(flip) } : prev));
      setStats(prev =>
        prev
          ? {
              ...prev,
              users: {
                ...prev.users,
                banned: Math.max(0, prev.users.banned + (nextBanStatus ? 1 : -1)),
              },
            }
          : prev
      );
    }
  };

  /** Admin close of a session the volunteer never scanned out of (WEB-30). */
  const handleCloseSession = async (id: string) => {
    const log = attendanceLogs.find(a => a.id === id);
    if (
      !window.confirm(
        `Close the open session for ${oneLine(log?.volunteer?.fullName ?? "this volunteer")} at "${oneLine(log?.event?.title ?? "this drive")}"?\n\nCheck-out is recorded at the drive's end time (or now, if earlier), hours are clamped as usual and reputation is awarded once. This cannot be undone from the console.`
      )
    ) {
      return;
    }
    const data = await runAction(
      `attendance:${id}`,
      t => patchJson(t, `/attendance/${id}/close`),
      "Could not close the session"
    );
    if (data) {
      setAttendanceLogs(prev =>
        prev.map(a => (a.id === id ? { ...a, ...(data as Partial<AttendanceLog>) } : a))
      );
    }
  };

  // Dynamic Calculated Metrics. Exact counts come from /admin/stats; the
  // page-derived values are only a fallback while that feed is unavailable.
  const pendingNgosCount = stats?.ngos.pending ?? ngos.length;
  const pendingReportsCount =
    stats?.reports.open ?? reports.filter(r => !r.resolved).length;
  const pendingPaymentsCount =
    stats?.payments.pending ??
    transactions.filter(t => t.status === "PENDING").length;
  const totalVolunteersCount = stats?.users.total ?? usersList.length;
  const activeHostsCount =
    stats?.users.organizers ??
    usersList.filter(u => u.userType === "ORGANIZER").length;
  const activeEventsCount =
    stats?.events.active ??
    events.filter(e => e.status === "ACTIVE" || e.status === "FEATURED").length;
  const totalRevenue =
    stats?.payments.revenue ??
    transactions
      .filter(t => t.status === "SUCCESS")
      .reduce((sum, t) => sum + t.amount, 0);

  const publishedEvents = useMemo(
    () => events.filter(e => e.status === "ACTIVE" || e.status === "FEATURED"),
    [events]
  );

  const categoryDistribution = useMemo(() => {
    const categoryCounts: Record<string, number> = {};
    events.forEach(evt => {
      const cat = evt.category || "General";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const items = Object.entries(categoryCounts).map(([label, count]) => ({
      label,
      count,
    }));

    if (items.length === 0) {
      return [];
    }

    const maxCount = Math.max(...items.map(i => i.count));
    return items.map(item => ({
      ...item,
      isPrimary: item.count === maxCount,
    }));
  }, [events]);

  const maxCategoryCount = useMemo(() => {
    return Math.max(...categoryDistribution.map(c => c.count), 1);
  }, [categoryDistribution]);

  // First feed the active tab depends on that has never loaded, if any.
  const missingFeed =
    (FEEDS_BY_TAB[activeTab] ?? []).find(name => !feedHealth[name].loaded) ?? null;

  // Loading Indicator
  if (isAuthLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#0b0f19",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
      >
        <p>Loading Admin Workspace...</p>
      </div>
    );
  }

  // Auth Gate Modal
  if (!token) {
    return (
      <AuthModal
        authStep={authStep}
        identifier={identifier}
        setIdentifier={setIdentifier}
        otpCode={otpCode}
        setOtpCode={setOtpCode}
        authError={authError}
        authMsg={authMsg}
        devOtp={devOtp}
        isSubmitting={isSubmitting}
        handleRequestOtp={handleRequestOtp}
        handleVerifyOtp={handleVerifyOtp}
        setAuthStep={setAuthStep}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#0b0f19",
        color: "#f8fafc",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingNgosCount={pendingNgosCount}
        pendingReportsCount={pendingReportsCount}
        pendingPaymentsCount={pendingPaymentsCount}
        adminUser={adminUser}
        handleLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          padding: "40px",
          overflowY: "auto",
          backgroundColor: "#0b0f19",
        }}
      >
        {/* Dynamic Header */}
        <Header
          activeTab={activeTab}
          isSyncing={isSyncing}
          lastSyncTime={lastSyncTime}
          syncErrors={syncErrors}
          actionError={actionError}
          onDismissActionError={() => setActionError("")}
          onManualSync={() => fetchDashboardData(token)}
        />

        {/* Until the first sync completes the tabs would assert "no users",
            "all NGOs cleared" and so on — show a neutral state instead. */}
        {!hasLoaded ? (
          <div
            style={{
              padding: "60px 0",
              textAlign: "center",
              color: "#94a3b8",
              fontSize: "14px",
            }}
          >
            Syncing platform data…
          </div>
        ) : missingFeed ? (
          // A feed this tab depends on has never loaded: say so instead of
          // rendering an empty state that reads as "nothing to do".
          <FeedError
            label={FEED_LABELS[missingFeed].toLowerCase()}
            health={feedHealth[missingFeed]}
            onRetry={() => fetchDashboardData(token)}
          />
        ) : (
          <>
            {/* Tab Views */}
            {activeTab === "dashboard" && (
              <OverviewTab
                totalVolunteersCount={totalVolunteersCount}
                activeHostsCount={activeHostsCount}
                activeEventsCount={activeEventsCount}
                pendingNgosCount={pendingNgosCount}
                events={publishedEvents}
                categoryDistribution={categoryDistribution}
                maxCategoryCount={maxCategoryCount}
                onSelectEvent={handleSelectEvent}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === "analytics" && (
              <AnalyticsTab
                events={events}
                attendanceLogs={attendanceLogs}
                ngos={ngos}
                transactions={transactions}
                stats={stats}
              />
            )}

            {activeTab === "ngos" && (
              <NgosTab
                ngos={ngos}
                token={token}
                status={ngoStatus}
                onStatusChange={handleNgoStatusChange}
                loadState={
                  ngosLoading
                    ? "loading"
                    : feedHealth.ngos.loaded
                    ? "ready"
                    : "error"
                }
                health={feedHealth.ngos}
                onRetry={() => fetchDashboardData(token)}
                onApproveNGO={handleApproveNGO}
                onRejectNGO={handleRejectNGO}
                onRevokeNGO={handleRevokeNGO}
                onSessionExpired={() => expireSession()}
              />
            )}

            {activeTab === "events" && (
              <EventsTab
                events={events}
                totalOnPlatform={stats?.events.total}
                hasMore={Boolean(feedHealth.events.nextCursor)}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSelectEvent={handleSelectEvent}
                onEventAction={handleEventAction}
              />
            )}

            {activeTab === "moderation" && (
              <SafetyReportsTab
                reports={allReports}
                totalReports={
                  stats ? stats.reports.open + stats.reports.resolved : undefined
                }
                hasMore={Boolean(reportsMore ? reportsMore.cursor : feedHealth.reports.nextCursor)}
                loadingMore={loadingMore.reports}
                onLoadMore={() => handleLoadMore("reports")}
                onDismissReport={handleDismissReport}
                onSuspendReportedEvent={handleSuspendReportedEvent}
                onInspectEvent={handleInspectReportEvent}
                onFindUser={handleFindReportedUser}
              />
            )}

            {activeTab === "payments" && (
              <PaymentsTab
                transactions={allTransactions}
                totalRevenue={totalRevenue}
                pendingPaymentsCount={pendingPaymentsCount}
                hasMore={Boolean(paymentsMore ? paymentsMore.cursor : feedHealth.payments.nextCursor)}
                loadingMore={loadingMore.payments}
                onLoadMore={() => handleLoadMore("payments")}
              />
            )}

            {activeTab === "users" && (
              <UsersTab
                usersList={allUsers}
                totalRegistered={userSearch.trim() ? undefined : stats?.users.total}
                hasMore={Boolean(usersMore ? usersMore.cursor : feedHealth.users.nextCursor)}
                loadingMore={loadingMore.users}
                onLoadMore={() => handleLoadMore("users")}
                search={userSearch}
                onSearchChange={setUserSearch}
                isSearching={isSearchingUsers}
                adminUser={adminUser}
                onToggleUserBan={handleToggleUserBan}
              />
            )}

            {activeTab === "broadcast" && (
              <BroadcastTab
                broadcastTitle={broadcastTitle}
                setBroadcastTitle={setBroadcastTitle}
                broadcastBody={broadcastBody}
                setBroadcastBody={setBroadcastBody}
                broadcastTargetRole={broadcastTargetRole}
                setBroadcastTargetRole={setBroadcastTargetRole}
                audienceCount={audienceSize(stats, broadcastTargetRole)}
                isBroadcasting={isBroadcasting}
                broadcastMsg={broadcastMsg}
                broadcastHistory={broadcastHistory}
                historyHasMore={Boolean(feedHealth.broadcasts.nextCursor)}
                historyError={
                  feedHealth.broadcasts.loaded
                    ? null
                    : describeFeedError(feedHealth.broadcasts.lastErrorStatus)
                }
                onRetryHistory={() => fetchDashboardData(token)}
                onSendBroadcast={handleSendBroadcast}
              />
            )}

            {activeTab === "attendance" && (
              <AttendanceTab
                attendanceLogs={attendanceLogs}
                completedSessions={stats?.attendance.completedSessions}
                hasMore={Boolean(feedHealth.attendance.nextCursor)}
                token={token}
                onCloseSession={handleCloseSession}
                onSessionExpired={() => expireSession()}
              />
            )}

            {activeTab === "settings" && (
              <SettingsTab
                autoSyncSeconds={autoSyncSeconds}
                setAutoSyncSeconds={setAutoSyncSeconds}
              />
            )}
          </>
        )}

        {/* Event Details Inspection Modal */}
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEventAction={handleEventAction}
          onDeleteEvent={handleDeleteEvent}
        />
      </main>
    </div>
  );
}
