"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, RefreshCw, ScrollText } from "lucide-react";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../config/constants";
import { useSession } from "../lib/session";
import { useFeedback } from "../lib/feedback";
import { formatDateTime, formatTime } from "../lib/format";
import type { UserRole } from "../types/admin";
import { useConsole } from "../components/shell/ConsoleContext";
import { Badge, Button, Details, PageHeader, Panel, Skeleton } from "../components/ui/primitives";
import { RoleBadge } from "../components/common/bits";

type ProbeStatus = "up" | "down" | "unknown";

interface HealthReport {
  /** The API answered at all. */
  reachable: boolean;
  database: ProbeStatus;
  redis: ProbeStatus;
  /** Process uptime in seconds, from /health/live. */
  uptime: number | null;
  checkedAt: Date;
}

interface TerminusBody {
  status?: string;
  info?: Record<string, { status?: string }>;
  error?: Record<string, { status?: string }>;
  details?: Record<string, { status?: string }>;
}

function probe(body: TerminusBody | null, key: string): ProbeStatus {
  const entry = body?.details?.[key] ?? body?.info?.[key] ?? body?.error?.[key];
  if (entry?.status === "up") return "up";
  if (entry?.status === "down") return "down";
  return "unknown";
}

/** The health probes are public and answer 503 with a body when degraded, so they are read directly. */
async function readJson<T>(path: string): Promise<{ ok: boolean; body: T | null }> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  let body: T | null = null;
  try {
    body = (await res.json()) as T;
  } catch {
    body = null;
  }
  return { ok: res.ok, body };
}

async function checkHealth(): Promise<HealthReport> {
  const checkedAt = new Date();
  try {
    const [ready, live] = await Promise.all([
      readJson<TerminusBody>("/health/ready"),
      readJson<{ status: string; uptime: number }>("/health/live").catch(() => ({ ok: false, body: null })),
    ]);
    return {
      reachable: true,
      database: probe(ready.body, "database"),
      redis: probe(ready.body, "redis"),
      uptime: typeof live.body?.uptime === "number" ? live.body.uptime : null,
      checkedAt,
    };
  } catch {
    return { reachable: false, database: "unknown", redis: "unknown", uptime: null, checkedAt };
  }
}

/** "3 days 4 h", "5 h 20 min", "12 min" — never seconds. */
function formatUptime(seconds: number): string {
  const totalMin = Math.floor(seconds / 60);
  if (totalMin < 1) return "under a minute";
  const days = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (days > 0) return `${days} ${days === 1 ? "day" : "days"}${h ? ` ${h} h` : ""}`;
  if (h > 0) return `${h} h${m ? ` ${m} min` : ""}`;
  return `${m} min`;
}

function StatusBadge({ status, upLabel = "Working" }: { status: ProbeStatus; upLabel?: string }) {
  if (status === "up") return <Badge tone="success">{upLabel}</Badge>;
  if (status === "down") return <Badge tone="danger">Not reachable</Badge>;
  return <Badge tone="outline">Unknown</Badge>;
}

const ROLES: UserRole[] = ["VOLUNTEER", "ORGANIZER", "ADMIN"];

export default function SettingsView() {
  const { admin, signOut } = useSession();
  const { confirm } = useFeedback();
  const { stats, go } = useConsole();
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [checking, setChecking] = useState(true);
  const seq = useRef(0);

  const runCheck = useCallback(async () => {
    const mine = ++seq.current;
    setChecking(true);
    const report = await checkHealth();
    if (mine !== seq.current) return;
    setHealth(report);
    setChecking(false);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void runCheck(), 0);
    return () => window.clearTimeout(id);
  }, [runCheck]);

  const askSignOut = async () => {
    const r = await confirm({
      title: "Sign out of the console?",
      confirmLabel: "Sign out",
      body: <p>You will need a new sign-in code to come back. Nothing you have open is lost on the server.</p>,
    });
    if (r.confirmed) signOut("You have signed out.");
  };

  const role = admin && ROLES.includes(admin.userType as UserRole) ? (admin.userType as UserRole) : null;

  return (
    <>
      <PageHeader title="Settings" description="Your account and the state of the system this console talks to." />

      <div className="grid max-w-4xl grid-cols-1 gap-4">
        <Panel
          title="Your account"
          actions={
            <Button icon={LogOut} onClick={askSignOut}>
              Sign out
            </Button>
          }
        >
          <Details
            columns={3}
            items={[
              { label: "Name", value: admin?.fullName || "—" },
              { label: "Email", value: admin?.email || "—" },
              { label: "Role", value: role ? <RoleBadge role={role} /> : admin?.userType ?? "—" },
            ]}
          />
          <p className="mt-5 text-meta text-ink-2">
            You sign in with a one-time code sent to this email. Admin access is granted only from the server, never
            from this console.
          </p>
        </Panel>

        <Panel
          title="System status"
          description={
            health && !checking
              ? `Last checked at ${formatTime(health.checkedAt)}.`
              : checking
                ? "Checking now."
                : undefined
          }
          actions={
            <Button icon={RefreshCw} loading={checking} onClick={() => void runCheck()}>
              Check again
            </Button>
          }
        >
          <div aria-live="polite">
            {!health ? (
              <div role="status" aria-label="Checking system status" className="space-y-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ) : (
              <>
                {!health.reachable ? (
                  <p role="alert" className="mb-4 text-meta text-danger-ink">
                    The API could not be reached at this address. Check that the server is running and that this
                    console is allowed in its CORS settings.
                  </p>
                ) : null}
                <Details
                  columns={2}
                  items={[
                    {
                      label: "API address",
                      value: <span className="break-all">{API_BASE_URL}</span>,
                    },
                    {
                      label: "API server",
                      value: health.reachable ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusBadge status="up" upLabel="Responding" />
                          {health.uptime !== null ? (
                            <span className="text-meta text-ink-2">Running for {formatUptime(health.uptime)}</span>
                          ) : null}
                        </span>
                      ) : (
                        <StatusBadge status="down" />
                      ),
                    },
                    {
                      label: "Database",
                      value: <StatusBadge status={health.database} />,
                    },
                    {
                      label: "Redis",
                      value: (
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={health.redis} />
                          {health.redis === "down" ? (
                            <span className="text-meta text-ink-2">
                              Sign-in codes and live chat work on one server only until it is back.
                            </span>
                          ) : null}
                        </span>
                      ),
                    },
                  ]}
                />
              </>
            )}
          </div>
        </Panel>

        <Panel title="What this console refreshes">
          <ul className="space-y-2 text-meta text-ink-2">
            <li>
              Counts in the sidebar, on Overview and on Analytics refresh every 30 s while this tab is visible, and
              again straight after you change something.
              {stats ? ` The current counts were generated at ${formatDateTime(stats.generatedAt)}.` : ""}
            </li>
            <li>Lists load when you open a screen. Open the screen again to see newer rows.</li>
            <li>System status is checked when you open Settings or press Check again.</li>
          </ul>
        </Panel>

        <Panel
          title="Audit log"
          actions={
            <Button icon={ScrollText} onClick={() => go("audit")}>
              Open audit log
            </Button>
          }
        >
          <p className="text-meta text-ink-2">
            Every admin action, such as an approval, a suspension, a settled payment or a broadcast, is recorded with
            who did it and when.
          </p>
        </Panel>
      </div>
    </>
  );
}
