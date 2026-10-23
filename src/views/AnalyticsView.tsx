"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import type { Page } from "../lib/api";
import { useResource } from "../lib/hooks";
import { formatDateTime, formatMoney, plural } from "../lib/format";
import type { AdminEvent, AdminStats } from "../types/admin";
import { useConsole } from "../components/shell/ConsoleContext";
import { DataTable, type Column } from "../components/ui/DataTable";
import { ErrorState, PageHeader, Panel, Segmented, Skeleton, cn } from "../components/ui/primitives";
import { PersonLink } from "../components/common/bits";

const SAMPLE_SIZE = 100;

function n(value: number): string {
  return value.toLocaleString("en-IN");
}

function percent(value: number, total: number): string {
  if (total <= 0) return "0%";
  const p = (value / total) * 100;
  if (p > 0 && p < 1) return "under 1%";
  return `${Math.round(p)}%`;
}

/* --------------------------------------------------------------- Bar list */

interface Bar {
  label: string;
  value: number;
  hint?: string;
  /** Overrides the default "12 · 30%" text. */
  display?: string;
}

/** Bars grow from zero once on mount (transform only; reduced motion skips it). */
function useGrown(): boolean {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setGrown(true), 30);
    return () => window.clearTimeout(id);
  }, []);
  return grown;
}

/**
 * Horizontal proportional bars. Every bar carries its number and share as
 * text, so the bar itself is decoration for sighted readers (aria-hidden).
 */
function BarList({
  bars,
  total,
  tone = "growth",
  label,
}: {
  bars: Bar[];
  /** What 100% means; defaults to the largest bar. */
  total?: number;
  tone?: "growth" | "forest";
  label: string;
}) {
  const grown = useGrown();
  const scale = total ?? Math.max(0, ...bars.map(b => b.value));
  return (
    <ul aria-label={label} className="space-y-3.5">
      {bars.map(b => {
        const frac = scale > 0 ? Math.min(1, b.value / scale) : 0;
        return (
          <li key={b.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-meta text-ink">
                {b.label}
                {b.hint ? <span className="ml-1.5 text-label text-ink-3">{b.hint}</span> : null}
              </span>
              <span className="tabular shrink-0 text-meta font-semibold text-ink">
                {b.display ?? (total !== undefined ? `${n(b.value)} · ${percent(b.value, total)}` : n(b.value))}
              </span>
            </div>
            <div aria-hidden className="mt-1.5 h-2 overflow-hidden rounded-full bg-sunken">
              <div
                className={cn(
                  "h-full w-full origin-left transition-transform duration-700 ease-out-quint",
                  tone === "forest" ? "bg-forest" : "bg-growth"
                )}
                style={{ transform: `scaleX(${grown ? frac : 0})` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-4 border-t border-line-soft pt-3 text-meta text-ink-2">{children}</p>;
}

function PanelSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- Sample breakdown */

interface OrganizerRow {
  id: string;
  name: string;
  drives: number;
  approved: number;
  hours: number;
}

type RankBy = "drives" | "hours";

function fillBuckets(drives: AdminEvent[]) {
  const counted = drives.filter(d => d.volunteersNeeded > 0 && d.status !== "CANCELLED" && d.status !== "DRAFT");
  const buckets = { none: 0, low: 0, high: 0, full: 0 };
  for (const d of counted) {
    const rate = d.approvedCount / d.volunteersNeeded;
    if (d.approvedCount === 0) buckets.none++;
    else if (rate < 0.5) buckets.low++;
    else if (rate < 1) buckets.high++;
    else buckets.full++;
  }
  return { counted: counted.length, buckets };
}

function organizerRows(drives: AdminEvent[]): OrganizerRow[] {
  const map = new Map<string, OrganizerRow>();
  for (const d of drives) {
    const id = d.organizer?.id ?? d.organizerId;
    const row = map.get(id) ?? { id, name: d.organizer?.fullName ?? "Unknown organizer", drives: 0, approved: 0, hours: 0 };
    row.drives += 1;
    row.approved += d.approvedCount ?? 0;
    row.hours += Number(d.hoursLoggedTotal ?? 0);
    map.set(id, row);
  }
  return [...map.values()];
}

function hoursText(h: number): string {
  return `${h.toLocaleString("en-IN", { maximumFractionDigits: 1 })} h`;
}

export default function AnalyticsView() {
  const { stats, statsError, refreshStats } = useConsole();
  const sample = useResource<Page<AdminEvent>>(`/events/admin/all?limit=${SAMPLE_SIZE}`);
  const categories = useResource<{ data: string[] }>("/events/categories");
  const [rankBy, setRankBy] = useState<RankBy>("drives");

  const drives = sample.data?.data ?? [];
  const truncated = Boolean(sample.data?.nextCursor);
  const sampleLabel = !sample.data
    ? "Based on the latest drives."
    : truncated
      ? `Based on the latest ${n(drives.length)} drives${stats ? ` of ${n(stats.events.total)}` : ""}, newest first.`
      : `Based on all ${plural(drives.length, "drive")}.`;

  // Categories: every allowed category, zeros included, busiest first.
  const byCategory = new Map<string, number>();
  for (const c of categories.data?.data ?? []) byCategory.set(c, 0);
  for (const d of drives) byCategory.set(d.category, (byCategory.get(d.category) ?? 0) + 1);
  const categoryBars = [...byCategory.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
  const emptyCategories = [...byCategory.entries()].filter(([, v]) => v === 0).map(([c]) => c);

  const fill = fillBuckets(drives);
  const organizers = organizerRows(drives)
    .sort((a, b) =>
      rankBy === "drives" ? b.drives - a.drives || b.hours - a.hours : b.hours - a.hours || b.drives - a.drives
    )
    .slice(0, 8);

  const orgColumns: Column<OrganizerRow>[] = [
    { key: "name", header: "Organizer", primary: true, cell: o => <PersonLink id={o.id} name={o.name} /> },
    { key: "drives", header: "Drives", align: "right", cell: o => <span className="tabular">{n(o.drives)}</span> },
    {
      key: "approved",
      header: "Volunteers approved",
      align: "right",
      cell: o => <span className="tabular">{n(o.approved)}</span>,
    },
    {
      key: "hours",
      header: "Hours logged",
      align: "right",
      cell: o => <span className="tabular font-semibold">{hoursText(o.hours)}</span>,
    },
  ];

  const statsBody = (render: (s: AdminStats) => ReactNode) =>
    stats ? render(stats) : statsError ? <ErrorState message={statsError} onRetry={refreshStats} /> : <PanelSkeleton />;

  const sampleBody = (render: () => ReactNode) =>
    sample.state === "loading" && !sample.data ? (
      <PanelSkeleton />
    ) : sample.state === "error" && !sample.data ? (
      <ErrorState message={sample.error ?? "The drives could not be loaded."} onRetry={sample.reload} />
    ) : (
      render()
    );

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Exact platform counts first, then patterns from recent drives. Every chart lists its numbers."
      />

      <section aria-labelledby="exact-heading" className="mb-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="exact-heading" className="text-xl font-bold text-forest">
            Platform counts
          </h2>
          <p className="text-meta text-ink-3">
            {stats ? `Exact, as of ${formatDateTime(stats.generatedAt)}` : "Exact counts across the platform"}
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          <Panel title="People by role" description={stats ? plural(stats.users.total, "account") : undefined}>
            {statsBody(s => (
              <>
                <BarList
                  label="People by role"
                  total={s.users.total}
                  tone="forest"
                  bars={[
                    { label: "Volunteers", value: s.users.volunteers },
                    { label: "Organizers", value: s.users.organizers },
                    { label: "Admins", value: s.users.admins },
                  ]}
                />
                <Note>
                  {s.users.banned === 0
                    ? "No accounts are suspended."
                    : `${plural(s.users.banned, "account is", "accounts are")} suspended; they are still counted in their role above.`}
                </Note>
              </>
            ))}
          </Panel>

          <Panel title="Drives by status" description={stats ? plural(stats.events.total, "drive") : undefined}>
            {statsBody(s => {
              const e = s.events;
              const other = Math.max(0, e.total - e.active - e.suspended);
              return (
                <>
                  <BarList
                    label="Drives by status"
                    total={e.total}
                    bars={[
                      { label: "Live", hint: "active or featured", value: e.active },
                      { label: "Upcoming", hint: "live, not yet ended", value: e.upcoming },
                      { label: "Suspended", value: e.suspended },
                      { label: "Everything else", hint: "draft, full, completed, closed, cancelled", value: other },
                    ]}
                  />
                  <Note>Upcoming drives are part of live drives, so the shares add up to more than 100%.</Note>
                </>
              );
            })}
          </Panel>

          <Panel
            title="Safety reports"
            description={stats ? plural(stats.reports.open + stats.reports.resolved, "report") : undefined}
          >
            {statsBody(s => {
              const r = s.reports;
              return (
                <BarList
                  label="Safety reports, open and resolved"
                  total={r.open + r.resolved}
                  tone="forest"
                  bars={[
                    { label: "Open", value: r.open },
                    { label: "Resolved", value: r.resolved },
                  ]}
                />
              );
            })}
          </Panel>

          <Panel
            title="Payments"
            description={stats ? `${formatMoney(stats.payments.revenue)} settled` : undefined}
          >
            {statsBody(s => {
              const p = s.payments;
              return (
                <>
                  <BarList
                    label="Payments, pending and successful"
                    total={p.pending + p.successful}
                    bars={[
                      { label: "Successful", value: p.successful },
                      { label: "Pending", value: p.pending },
                    ]}
                  />
                  <Note>
                    Revenue settled: <span className="tabular font-semibold text-ink">{formatMoney(p.revenue)}</span>
                    {" "}from successful payments. Failed payments are not counted here.
                  </Note>
                </>
              );
            })}
          </Panel>
        </div>
      </section>

      <section aria-labelledby="sample-heading">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="sample-heading" className="text-xl font-bold text-forest">
            Recent drives
          </h2>
          <p className="text-meta text-ink-3">{sampleLabel}</p>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          <Panel title="Drives by category" description={sample.data ? plural(drives.length, "drive") : undefined}>
            {sampleBody(() =>
              drives.length === 0 ? (
                <p className="text-meta text-ink-2">No drives have been created yet.</p>
              ) : (
                <>
                  <BarList label="Drives by category" total={drives.length} bars={categoryBars} />
                  {emptyCategories.length > 0 ? (
                    <Note>No drives in: {emptyCategories.join(", ")}.</Note>
                  ) : null}
                </>
              )
            )}
          </Panel>

          <Panel
            title="How full drives are"
            description="Approved volunteers as a share of the places each drive asked for."
          >
            {sampleBody(() =>
              fill.counted === 0 ? (
                <p className="text-meta text-ink-2">No drives with places to fill in this sample.</p>
              ) : (
                <>
                  <BarList
                    label="Drives by fill rate"
                    total={fill.counted}
                    tone="forest"
                    bars={[
                      { label: "No one approved yet", value: fill.buckets.none },
                      { label: "Under half full", value: fill.buckets.low },
                      { label: "Half full or more", value: fill.buckets.high },
                      { label: "Full", hint: "all places approved", value: fill.buckets.full },
                    ]}
                  />
                  <Note>
                    {plural(fill.counted, "drive")} counted. Cancelled and draft drives, and drives that did not set a
                    number of places, are left out.
                  </Note>
                </>
              )
            )}
          </Panel>
        </div>

        <Panel
          className="mt-4"
          title="Most active organizers"
          description="Up to 8 organizers, from the same sample of drives."
          actions={
            <Segmented<RankBy>
              label="Rank organizers by"
              value={rankBy}
              onChange={setRankBy}
              options={[
                { value: "drives", label: "By drives" },
                { value: "hours", label: "By hours" },
              ]}
            />
          }
          bodyClassName="p-0"
        >
          <DataTable
            caption={`Most active organizers, ranked by ${rankBy === "drives" ? "drives" : "hours logged"}`}
            columns={orgColumns}
            rows={organizers}
            rowKey={o => o.id}
            state={sample.state}
            error={sample.error}
            onRetry={sample.reload}
            empty={{
              icon: CalendarDays,
              title: "No organizers yet",
              body: "Organizers appear here once they publish drives.",
            }}
          />
        </Panel>
      </section>
    </>
  );
}
