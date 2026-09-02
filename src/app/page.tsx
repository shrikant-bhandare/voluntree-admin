"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  TabType,
  NGO,
  EventItem,
  EventStatusValue,
  SafetyReport,
  PaymentTransaction,
  PlatformUser,
  AttendanceLog,
  BroadcastNotification,
  AdminStats,
  LIST_PAGE_SIZE,
} from "../types";
import { API_BASE_URL } from "../config/constants";
import { nextAdminStatus } from "../utils/eventStatus";
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
  status: number;
  rows: Record<string, unknown>[];
  payload: unknown;
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
  const [hasLoaded, setHasLoaded] = useState(false);
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
      setAuthStep("identifier");
      setAuthError(message);
    },
    []
  );

  const fetchDashboardData = useCallback(
    async (currentToken: string) => {
      if (!currentToken) return;
      if (syncBusyRef.current) return;
      syncBusyRef.current = true;
      const seq = ++syncSeqRef.current;
      let sessionExpired = false;
      let forbidden = false;
      setIsSyncing(true);

      // List endpoints return { data, nextCursor }. Older ones returned a bare
      // array; accept both so a partially deployed API does not blank the screen.
      const toList = (payload: unknown): Record<string, unknown>[] => {
        if (Array.isArray(payload)) return payload;
        if (
          payload &&
          typeof payload === "object" &&
          Array.isArray((payload as { data?: unknown }).data)
        ) {
          return (payload as { data: Record<string, unknown>[] }).data;
        }
        return [];
      };

      const authed = async (path: string): Promise<Feed> => {
        try {
          const res = await fetch(`${API_BASE_URL}${path}`, {
            headers: { Authorization: `Bearer ${currentToken}` },
          });
          if (res.status === 401) sessionExpired = true;
          if (res.status === 403) forbidden = true;
          if (!res.ok) {
            return { ok: false, status: res.status, rows: [], payload: null };
          }
          const payload = await res.json();
          return { ok: true, status: res.status, rows: toList(payload), payload };
        } catch {
          return { ok: false, status: 0, rows: [], payload: null };
        }
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
          authed("/admin/stats"),
          // Admin listing: includes suspended/draft/completed events and the
          // organizer's email — the public /events hides both.
          authed(`/events/admin/all?limit=${LIST_PAGE_SIZE}`),
          authed(`/reports?limit=${LIST_PAGE_SIZE}`),
          // Platform-wide ledger. /payments/history is only the caller's own.
          authed(`/payments?limit=${LIST_PAGE_SIZE}`),
          authed(`/ngos/pending?limit=${LIST_PAGE_SIZE}`),
          authed(`/auth/users?limit=${LIST_PAGE_SIZE}`),
          authed(`/attendance/admin/all?limit=${LIST_PAGE_SIZE}`),
          authed(`/notifications/history?limit=${LIST_PAGE_SIZE}`),
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

        const failures: string[] = [];
        const note = (name: string, feed: Feed) => {
          if (!feed.ok) {
            failures.push(
              `${name} (${feed.status === 0 ? "network" : `HTTP ${feed.status}`})`
            );
          }
        };
        note("Stats", statsFeed);
        note("Events", eventFeed);
        note("Reports", reportFeed);
        note("Payments", paymentFeed);
        note("NGOs", ngoFeed);
        note("Users", userFeed);
        note("Attendance", attendanceFeed);
        note("Broadcasts", broadcastFeed);

        if (statsFeed.ok) setStats(statsFeed.payload as AdminStats);

        let currentReports = reportsRef.current;
        if (reportFeed.ok) {
          currentReports = reportFeed.rows.map((rep: any) => ({
            id: rep.id,
            eventId: rep.eventId,
            eventName: rep.event?.title || "Reported Drive",
            category: rep.category,
            reporter: rep.reporter?.fullName || "Platform User",
            reason: rep.reason,
            resolved: rep.resolved,
            date: new Date(rep.createdAt).toLocaleDateString(),
          }));
          reportsRef.current = currentReports;
          setReports(currentReports);
        }

        if (eventFeed.ok) {
          // The public event list no longer carries reports or applicant
          // details — those leaked volunteer emails. Report counts are derived
          // from the admin-only reports feed instead, and applicants load on
          // demand.
          const reportsByEvent = currentReports
            .filter(rep => !rep.resolved)
            .reduce((acc: Record<string, number>, rep) => {
              acc[rep.eventId] = (acc[rep.eventId] || 0) + 1;
              return acc;
            }, {});

          setEvents(
            eventFeed.rows.map((evt: any) => ({
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
              startTime: evt.startTime
                ? new Date(evt.startTime).toLocaleString()
                : undefined,
              endTime: evt.endTime
                ? new Date(evt.endTime).toLocaleString()
                : undefined,
              status: evt.status as EventStatusValue,
              openPositions: evt.openPositions || [],
              perks: evt.perks || [],
              bannerUrl: evt.bannerUrl,
              applications: undefined,
              attendanceLog: [],
              reports: [],
              reportsCount: reportsByEvent[evt.id] || 0,
              hoursLoggedTotal: evt.hoursLoggedTotal ?? 0,
              attendanceCount: evt.attendanceCount ?? 0,
            }))
          );
        }

        if (paymentFeed.ok) {
          setTransactions(
            paymentFeed.rows.map((tx: any) => ({
              id: tx.id,
              donor: tx.user?.fullName || "Deleted account",
              type: tx.type,
              amount: tx.amount,
              currency: tx.currency,
              status: tx.status,
              txRef: tx.txRef,
              date: new Date(tx.createdAt).toLocaleDateString(),
              eventName: tx.event?.title,
            }))
          );
        }

        if (ngoFeed.ok) {
          setNgos(
            ngoFeed.rows.map((ngo: any) => ({
              id: ngo.id,
              name: ngo.ngoName,
              contactName: ngo.user?.fullName || "Unknown applicant",
              email: ngo.user?.email || "No Email",
              phone: ngo.user?.phoneNumber || "No Phone",
              contactDetails: ngo.contactDetails || "",
              registrationDocs: ngo.registrationDocs || "",
              identityProof: ngo.identityProof || "",
              status: ngo.status,
              submittedAt: ngo.createdAt
                ? new Date(ngo.createdAt).toLocaleDateString()
                : "",
            }))
          );
        }

        if (userFeed.ok) {
          setUsersList(
            userFeed.rows.map((u: any) => ({
              id: u.id,
              email: u.email,
              phoneNumber: u.phoneNumber,
              fullName: u.fullName,
              userType: u.userType,
              isBanned: u.isBanned,
              createdAt: new Date(u.createdAt).toLocaleDateString(),
              profile: u.profile,
            }))
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
    [expireSession]
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
          { headers: { Authorization: `Bearer ${token}` } }
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
          applicationsError: "Could not load the applicant roster — network error.",
        });
      }
    },
    [token, expireSession]
  );

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
      });

      if (!res.ok) {
        throw new Error(await readApiError(res, "Failed to request OTP code."));
      }
      const data = await res.json();

      setAuthStep("otp");
      setAuthMsg("If this address belongs to an administrator, a code has been sent.");
      if (data.otpInDev) {
        setDevOtp(data.otpInDev);
      }
    } catch (err: any) {
      setAuthError(err.message || "An authentication error occurred.");
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
      setAuthError(err.message || "Authentication failed.");
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
      setBroadcastMsg(`⚠️ Error: ${err.message}`);
    } finally {
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
      } catch {
        setActionError(`${fallback} — network error.`);
        return null;
      } finally {
        busyRef.current.delete(key);
      }
    },
    [token, expireSession]
  );

  const patchJson = (authToken: string, path: string, body: unknown) =>
    fetch(`${API_BASE_URL}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
    });

  // Moderation Actions
  const handleApproveNGO = async (id: string) => {
    const ngo = ngos.find(n => n.id === id);
    if (
      !window.confirm(
        `Approve "${ngo?.name ?? "this organization"}"?\n\nThe account becomes an ORGANIZER and can publish drives, review applicants and receive donations.`
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
      setStats(prev =>
        prev
          ? { ...prev, ngos: { pending: Math.max(0, prev.ngos.pending - 1) } }
          : prev
      );
    }
  };

  const handleRejectNGO = async (id: string) => {
    const ngo = ngos.find(n => n.id === id);
    if (
      !window.confirm(
        `Reject "${ngo?.name ?? "this organization"}"?\n\nIf the account is currently an organizer it is demoted to volunteer and every one of its upcoming drives is CANCELLED. This cannot be undone from the console.`
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
      setStats(prev =>
        prev
          ? { ...prev, ngos: { pending: Math.max(0, prev.ngos.pending - 1) } }
          : prev
      );
    }
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
    }
    return Boolean(data);
  };

  const toggleEventStatus = async (id: string) => {
    const target = events.find(e => e.id === id);
    if (!target) return;

    // ACTIVE → FEATURED → SUSPENDED → ACTIVE only. Re-activating a COMPLETED,
    // CANCELLED, DRAFT or CLOSED drive would reopen it for applications.
    const transition = nextAdminStatus(target.status);
    if (!transition) {
      setActionError(
        `"${target.name}" is ${target.status}. That state is managed by the organizer or the platform lifecycle and has no admin transition.`
      );
      return;
    }
    if (
      transition.destructive &&
      !window.confirm(
        `Suspend "${target.name}"?\n\nIt disappears from the public listing and its organizer cannot reinstate it — only an administrator can.`
      )
    ) {
      return;
    }
    await applyEventStatus(id, transition.next);
  };

  const handleResolveReport = async (reportId: string) => {
    const data = await runAction(
      `report:${reportId}`,
      t =>
        fetch(`${API_BASE_URL}/reports/${reportId}/resolve`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${t}` },
        }),
      "Could not resolve the report"
    );
    if (data) {
      setReports(prev => {
        const next = prev.map(rep =>
          rep.id === reportId ? { ...rep, resolved: true } : rep
        );
        reportsRef.current = next;
        return next;
      });
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

  const handleRemoveReportedEvent = async (
    eventId: string,
    reportId: string
  ) => {
    const target = events.find(e => e.id === eventId);
    if (
      !window.confirm(
        `Suspend "${target?.name ?? "the reported drive"}" and mark this report resolved?\n\nThe drive is hidden from volunteers until an administrator reinstates it.`
      )
    ) {
      return;
    }
    if (target?.status === "SUSPENDED") {
      await handleResolveReport(reportId);
      return;
    }
    const suspended = await applyEventStatus(eventId, "SUSPENDED");
    if (suspended) {
      await handleResolveReport(reportId);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    const target = events.find(e => e.id === id);
    if (
      !window.confirm(
        `Permanently delete "${target?.name ?? "this drive"}"?\n\nIts applications, attendance records, posts and reports are deleted with it. Prefer Suspend unless the listing itself must go.`
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
        }),
      "Could not delete the event"
    );
    if (data) {
      setEvents(prev => prev.filter(e => e.id !== id));
      setSelectedEvent(cur => (cur?.id === id ? null : cur));
    }
  };

  const handleToggleUserBan = async (id: string, currentBanStatus: boolean) => {
    const nextBanStatus = !currentBanStatus;
    const user = usersList.find(u => u.id === id);
    if (
      nextBanStatus &&
      !window.confirm(
        `Suspend ${user?.fullName ?? "this account"} (${user?.email ?? id})?\n\nTheir session stops working immediately and they cannot request a login code until reinstated.`
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
      setUsersList(prev =>
        prev.map(u => (u.id === id ? { ...u, isBanned: nextBanStatus } : u))
      );
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
                onApproveNGO={handleApproveNGO}
                onRejectNGO={handleRejectNGO}
              />
            )}

            {activeTab === "events" && (
              <EventsTab
                events={events}
                totalOnPlatform={stats?.events.total}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSelectEvent={handleSelectEvent}
                onToggleStatus={toggleEventStatus}
              />
            )}

            {activeTab === "moderation" && (
              <SafetyReportsTab
                reports={reports}
                onResolveReport={handleResolveReport}
                onRemoveReportedEvent={handleRemoveReportedEvent}
              />
            )}

            {activeTab === "payments" && (
              <PaymentsTab
                transactions={transactions}
                totalRevenue={totalRevenue}
                pendingPaymentsCount={pendingPaymentsCount}
              />
            )}

            {activeTab === "users" && (
              <UsersTab
                usersList={usersList}
                totalRegistered={stats?.users.total}
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
                isBroadcasting={isBroadcasting}
                broadcastMsg={broadcastMsg}
                broadcastHistory={broadcastHistory}
                onSendBroadcast={handleSendBroadcast}
              />
            )}

            {activeTab === "attendance" && (
              <AttendanceTab attendanceLogs={attendanceLogs} token={token} />
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
          onToggleStatus={toggleEventStatus}
          onDeleteEvent={handleDeleteEvent}
        />
      </main>
    </div>
  );
}
