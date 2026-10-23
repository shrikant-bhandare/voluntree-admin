"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowRight, Building2, CheckCircle2, Clock, RefreshCw, ShieldAlert, Wallet, type LucideIcon } from "lucide-react";
import type { Page } from "../lib/api";
import { useResource, type LoadState, type Resource } from "../lib/hooks";
import { formatDateTime, formatMoney, humanize, plural, timeAgo } from "../lib/format";
import type { AdminStats, AttendanceRow, NgoVerification, SafetyReport } from "../types/admin";
import { useConsole } from "../components/shell/ConsoleContext";
import { Button, ErrorState, PageHeader, Panel, Skeleton, cn } from "../components/ui/primitives";
import { MinorBadge, PersonLink } from "../components/common/bits";

const LIST_SIZE = 5;

/** "3 days", "5 h", "under an hour" — how long something has been waiting. */
function waitingFor(value: string, now = Date.now()): string {
  const ms = now - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "under an hour";
  if (h < 24) return `${h} h`;
  const days = Math.floor(h / 24);
  if (days < 14) return plural(days, "day");
  return plural(Math.floor(days / 7), "week");
}

function n(value: number): string {
  return value.toLocaleString("en-IN");
}

/**
 * Re-reads a list when the matching count in /admin/stats moves, so a block's
 * rows never disagree with the number above them for longer than one poll.
 */
function useReloadWhen(key: number | undefined, reload: () => void) {
  const reloadRef = useRef(reload);
  const previous = useRef(key);
  useEffect(() => {
    reloadRef.current = reload;
  });
  useEffect(() => {
    const before = previous.current;
    previous.current = key;
    if (before !== undefined && key !== undefined && before !== key) reloadRef.current();
  }, [key]);
}

/* ------------------------------------------------------------ Queue block */

function QueueBlock({
  icon: Icon,
  title,
  summary,
  actionLabel,
  onAction,
  children,
}: {
  icon: LucideIcon;
  title: string;
  summary: ReactNode;
  actionLabel: string;
  onAction: () => void;
  children?: ReactNode;
}) {
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Icon aria-hidden className="size-5 shrink-0 text-forest" strokeWidth={2} />
          {title}
        </span>
      }
      description={summary}
      actions={
        <Button size="sm" variant="ghost" onClick={onAction} aria-label={`${actionLabel}: ${title}`}>
          {actionLabel}
          <ArrowRight aria-hidden className="size-4" />
        </Button>
      }
      className="min-w-0"
      bodyClassName="p-0"
    >
      {children}
    </Panel>
  );
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-line-soft">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2 px-5 py-3.5">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}

function BlockError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <p className="text-meta text-danger-ink">{message ?? "This list could not be loaded."}</p>
      <Button size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** Rows of a block, or its loading / error state. */
function BlockBody<T>({
  resource,
  render,
}: {
  resource: Resource<Page<T>>;
  render: (rows: T[]) => ReactNode;
}) {
  if (resource.state === "loading" && !resource.data) return <ListSkeleton />;
  if (resource.state === "error" && !resource.data) return <BlockError message={resource.error} onRetry={resource.reload} />;
  return <>{render(resource.data?.data ?? [])}</>;
}

/* ------------------------------------------------------------- The queues */

const CLEAR_PHRASE: Record<Queue["id"], string> = {
  reports: "no open safety reports",
  ngos: "no NGOs waiting for approval",
  payments: "no payments waiting to settle",
  hours: "no volunteer still checked in",
};

const QUEUE_PHRASE: Record<Queue["id"], string> = {
  reports: "safety reports",
  ngos: "NGO approvals",
  payments: "payments",
  hours: "open check-ins",
};

interface Queue {
  id: "reports" | "ngos" | "payments" | "hours";
  label: string;
  /** null while unknown (stats and list both still loading or failed). */
  count: number | null;
  /** The count is a lower bound (taken from a capped list). */
  atLeast?: boolean;
}

export default function OverviewView() {
  const { stats, statsError, refreshStats, go, openReport, openEvent } = useConsole();

  const minorReports = useResource<Page<SafetyReport>>(
    `/reports?resolved=false&involvesMinor=true&limit=${LIST_SIZE}`
  );
  const openReports = useResource<Page<SafetyReport>>(`/reports?resolved=false&limit=${LIST_SIZE}`);
  const ngos = useResource<Page<NgoVerification>>(`/ngos?status=PENDING&limit=${LIST_SIZE}`);
  const sessions = useResource<Page<AttendanceRow>>(`/attendance/admin/all?open=true&limit=${LIST_SIZE}`);

  useReloadWhen(stats?.reports.open, () => {
    minorReports.reload();
    openReports.reload();
  });
  useReloadWhen(stats?.ngos.pending, ngos.reload);
  useReloadWhen(stats?.attendance.completedSessions, sessions.reload);

  const refreshAll = () => {
    refreshStats();
    minorReports.reload();
    openReports.reload();
    ngos.reload();
    sessions.reload();
  };

  // Under-18 reports first, then the rest of the open queue, without repeats.
  const reportRows: SafetyReport[] = (() => {
    const minors = minorReports.data?.data ?? [];
    const seen = new Set(minors.map(r => r.id));
    const rest = (openReports.data?.data ?? []).filter(r => !seen.has(r.id));
    return [...minors, ...rest].slice(0, LIST_SIZE);
  })();
  const minorCount = minorReports.data?.data.length ?? 0;
  const minorMore = Boolean(minorReports.data?.nextCursor);
  const reportsResource: Resource<Page<SafetyReport>> = {
    ...openReports,
    state: (minorReports.state === "error" && openReports.state === "error" ? "error" : openReports.state) as LoadState,
    data: openReports.data || minorReports.data ? { data: reportRows, nextCursor: null } : null,
    reload: () => {
      minorReports.reload();
      openReports.reload();
    },
  };

  const fromList = (r: Resource<Page<unknown>>): { count: number | null; atLeast: boolean } =>
    r.data ? { count: r.data.data.length, atLeast: Boolean(r.data.nextCursor) } : { count: null, atLeast: false };

  const queues: Queue[] = [
    {
      id: "reports",
      label: "Safety reports",
      ...(stats ? { count: stats.reports.open } : fromList(openReports as Resource<Page<unknown>>)),
    },
    { id: "ngos", label: "NGO approvals", ...(stats ? { count: stats.ngos.pending } : fromList(ngos as Resource<Page<unknown>>)) },
    { id: "payments", label: "Payments", count: stats ? stats.payments.pending : null },
    { id: "hours", label: "Check-ins", ...fromList(sessions as Resource<Page<unknown>>) },
  ];

  const waiting = queues.filter(q => q.count !== null && q.count > 0);
  const clear = queues.filter(q => q.count === 0);
  const unknown = queues.filter(q => q.count === null);
  const stillLoading = !stats && !statsError;

  const headline = (() => {
    if (stillLoading) return "Loading what is waiting for you.";
    if (waiting.length === 0 && unknown.length === 0) return "Nothing is waiting for you right now.";
    if (waiting.length === 0) return "Nothing waiting in the queues that loaded.";
    return `${plural(waiting.length, "queue needs", "queues need")} you: ${waiting.map(q => QUEUE_PHRASE[q.id]).join(", ")}.`;
  })();

  return (
    <>
      <PageHeader
        title="Overview"
        description={headline}
        actions={
          <Button icon={RefreshCw} onClick={refreshAll}>
            Refresh
          </Button>
        }
      />

      <section aria-labelledby="attention-heading" className="mb-10">
        <h2 id="attention-heading" className="mb-4 text-xl font-bold text-forest">
          Needs your attention
        </h2>

        {statsError && !stats ? (
          <p role="alert" className="mb-4 text-meta text-danger-ink">
            The platform counts could not be loaded ({statsError}). The lists below are loaded separately.
          </p>
        ) : null}

        {stillLoading ? (
          <div className="grid gap-4 lg:grid-cols-2" aria-busy>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface p-5 shadow-card ring-1 ring-line-soft">
                <Skeleton className="mb-3 h-5 w-1/3" />
                <Skeleton className="mb-5 h-4 w-1/2" />
                <Skeleton className="mb-2 h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            ))}
          </div>
        ) : waiting.length === 0 && unknown.length === 0 ? (
          <div className="flex items-start gap-4 rounded-xl bg-surface px-5 py-5 shadow-card ring-1 ring-line-soft">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-mint-soft text-growth">
              <CheckCircle2 aria-hidden className="size-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-forest">All clear</p>
              <p className="mt-0.5 text-meta text-ink-2">
                No open safety reports, no NGOs waiting for approval, no payments waiting to settle, and no volunteer is
                still checked in. This page updates every 30 seconds while it is open.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              {queues
                .filter(q => q.count === null || q.count > 0)
                .map(q => {
                  if (q.id === "reports") {
                    return (
                      <QueueBlock
                        key={q.id}
                        icon={ShieldAlert}
                        title="Safety reports"
                        summary={
                          q.count === null ? (
                            "Open reports from volunteers and organizers."
                          ) : (
                            <>
                              {plural(q.count, "open report")}
                              {q.atLeast ? " or more" : ""}
                              {minorCount > 0
                                ? `, ${minorMore ? "at least " : ""}${n(minorCount)} involving someone under 18`
                                : ""}
                              .
                            </>
                          )
                        }
                        actionLabel="View all"
                        onAction={() => go("reports")}
                      >
                        <BlockBody
                          resource={reportsResource}
                          render={rows => (
                            <ul className="divide-y divide-line-soft">
                              {rows.map(r => {
                                const target =
                                  r.targetType === "EVENT" ? r.event?.title ?? "A drive" : r.targetUser?.fullName ?? "A person";
                                return (
                                  <li key={r.id}>
                                    <button
                                      type="button"
                                      onClick={() => openReport(r)}
                                      className="block w-full px-5 py-3.5 text-left transition-colors duration-150 hover:bg-canvas focus-visible:bg-canvas"
                                    >
                                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="text-row font-semibold text-ink">
                                          {humanize(r.category)}
                                          <span className="font-normal text-ink-2">
                                            {" · "}
                                            {r.targetType === "EVENT" ? "drive " : ""}
                                            {target}
                                          </span>
                                        </span>
                                        {r.involvesMinor ? <MinorBadge /> : null}
                                      </span>
                                      <span className="mt-0.5 block truncate text-meta text-ink-2">{r.reason}</span>
                                      <span className="mt-0.5 block text-label text-ink-3">
                                        Reported {timeAgo(r.createdAt)} by {r.reporter.fullName}
                                      </span>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        />
                      </QueueBlock>
                    );
                  }

                  if (q.id === "ngos") {
                    return (
                      <QueueBlock
                        key={q.id}
                        icon={Building2}
                        title="NGO approvals"
                        summary={
                          q.count === null
                            ? "Organizations waiting for verification, oldest first."
                            : `${plural(q.count, "organization")}${q.atLeast ? " or more" : ""} waiting, oldest first. Only approved NGOs can publish drives.`
                        }
                        actionLabel="Review"
                        onAction={() => go("ngos")}
                      >
                        <BlockBody
                          resource={ngos}
                          render={rows => (
                            <ul className="divide-y divide-line-soft">
                              {rows.map(v => (
                                <li key={v.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                                  <span className="min-w-0">
                                    <span className="block truncate text-row font-semibold text-ink">{v.ngoName}</span>
                                    <span className="block truncate text-meta text-ink-2">{v.user.fullName}</span>
                                  </span>
                                  <span className="shrink-0 text-right text-meta text-ink-2" title={formatDateTime(v.createdAt)}>
                                    Waiting {waitingFor(v.createdAt)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        />
                      </QueueBlock>
                    );
                  }

                  if (q.id === "payments") {
                    return (
                      <QueueBlock
                        key={q.id}
                        icon={Wallet}
                        title="Payments waiting"
                        summary={
                          q.count === null
                            ? "Pending payments could not be counted."
                            : `${plural(q.count, "payment")} not yet confirmed by the gateway.`
                        }
                        actionLabel="Review"
                        onAction={() => go("payments")}
                      >
                        <p className="px-5 py-4 text-meta text-ink-2">
                          Payments settle on their own when the gateway confirms them. Settle one by hand only when the
                          money has arrived and the confirmation never did.
                        </p>
                      </QueueBlock>
                    );
                  }

                  return (
                    <QueueBlock
                      key={q.id}
                      icon={Clock}
                      title="Still checked in"
                      summary={
                        q.count === null
                          ? "Volunteers who have checked in and not yet checked out."
                          : `${plural(q.count, "volunteer")}${q.atLeast ? " or more" : ""} checked in and not yet checked out. Open sessions close on their own 2 h after the drive ends.`
                      }
                      actionLabel="View all"
                      onAction={() => go("hours")}
                    >
                      <BlockBody
                        resource={sessions}
                        render={rows => (
                          <ul className="divide-y divide-line-soft">
                            {rows.map(s => (
                              <li key={s.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                                <span className="min-w-0 text-row">
                                  <PersonLink id={s.volunteer.id} name={s.volunteer.fullName} />
                                  <button
                                    type="button"
                                    onClick={() => openEvent(s.event.id)}
                                    className="block max-w-full truncate rounded-sm text-left text-meta text-ink-2 hover:text-forest hover:underline"
                                  >
                                    {s.event.title}
                                  </button>
                                </span>
                                <span className="shrink-0 text-right text-meta text-ink-2" title={formatDateTime(s.checkIn)}>
                                  Checked in {timeAgo(s.checkIn)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      />
                    </QueueBlock>
                  );
                })}
            </div>

            {clear.length > 0 ? (
              <p className="mt-4 flex items-start gap-2 text-meta text-ink-2">
                <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-growth" />
                <span>
                  Clear right now:{" "}
                  {clear.map(q => CLEAR_PHRASE[q.id]).join(", ")}
                  .
                </span>
              </p>
            ) : null}
          </>
        )}
      </section>

      <PlatformSummary stats={stats} error={statsError} onRetry={refreshStats} />
    </>
  );
}

/* ------------------------------------------------------ Platform summary */

function SummaryGroup({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; hint?: string }[];
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-base font-semibold text-forest">{title}</h3>
      <dl className="divide-y divide-line-soft border-t border-line-soft">
        {rows.map((r, i) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className={cn("text-meta", i === 0 ? "font-semibold text-ink" : "text-ink-2")}>
              {r.label}
              {r.hint ? <span className="block text-label text-ink-3">{r.hint}</span> : null}
            </dt>
            <dd className={cn("tabular whitespace-nowrap text-right text-row", i === 0 ? "font-bold text-forest" : "font-semibold text-ink")}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function PlatformSummary({
  stats,
  error,
  onRetry,
}: {
  stats: AdminStats | null;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <Panel
      title="Platform summary"
      description={
        stats
          ? `Exact counts across the whole platform, as of ${formatDateTime(stats.generatedAt)}.`
          : "Exact counts across the whole platform."
      }
    >
      {!stats && error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : !stats ? (
        <div className="grid gap-8 md:grid-cols-2 2xl:grid-cols-4" aria-busy role="status" aria-label="Loading summary">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2 2xl:grid-cols-4">
          <SummaryGroup
            title="People"
            rows={[
              { label: "Accounts", value: n(stats.users.total) },
              { label: "Volunteers", value: n(stats.users.volunteers) },
              { label: "Organizers", value: n(stats.users.organizers) },
              { label: "Admins", value: n(stats.users.admins) },
              { label: "Suspended accounts", value: n(stats.users.banned) },
            ]}
          />
          <SummaryGroup
            title="Drives"
            rows={[
              { label: "All drives", value: n(stats.events.total) },
              { label: "Live", hint: "Active or featured", value: n(stats.events.active) },
              { label: "Upcoming", hint: "Live and not yet ended", value: n(stats.events.upcoming) },
              { label: "Suspended", value: n(stats.events.suspended) },
            ]}
          />
          <SummaryGroup
            title="Verified hours"
            rows={[
              {
                label: "Hours logged",
                hint: "From QR check-in and check-out",
                value: `${stats.attendance.totalHours.toLocaleString("en-IN", { maximumFractionDigits: 1 })} h`,
              },
              { label: "Completed sessions", value: n(stats.attendance.completedSessions) },
            ]}
          />
          <SummaryGroup
            title="Money and safety"
            rows={[
              { label: "Revenue settled", value: formatMoney(stats.payments.revenue) },
              { label: "Successful payments", value: n(stats.payments.successful) },
              { label: "Reports resolved", value: n(stats.reports.resolved) },
              { label: "Reports open", value: n(stats.reports.open) },
            ]}
          />
        </div>
      )}
    </Panel>
  );
}
