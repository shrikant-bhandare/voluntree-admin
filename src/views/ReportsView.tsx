"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ShieldCheck, UserRound, X } from "lucide-react";
import { usePagedList } from "../lib/hooks";
import { formatDateTime, plural, timeAgo } from "../lib/format";
import type { SafetyReport } from "../types/admin";
import { useConsole } from "../components/shell/ConsoleContext";
import { DataTable, type Column } from "../components/ui/DataTable";
import { PageHeader, Panel, Segmented, Toolbar, cn } from "../components/ui/primitives";
import { BannedBadge, MinorBadge, PersonLink } from "../components/common/bits";
import {
  REPORTS_CHANGED_EVENT,
  ReportStatusBadge,
  reportCategoryLabel,
  reportSubject,
  type ReportsChangedDetail,
} from "../components/inspectors/ReportDrawer";

type StatusFilter = "OPEN" | "RESOLVED" | "ALL";

export default function ReportsView() {
  const { stats, params, go, openReport, openEvent } = useConsole();
  // Deep link: go("reports", { targetUserId, targetName? }) from a profile or report.
  const targetUserId = params.get("targetUserId") ?? "";
  const targetNameParam = params.get("targetName");
  const [status, setStatus] = useState<StatusFilter>(() => (targetUserId ? "ALL" : "OPEN"));
  const [minorsOnly, setMinorsOnly] = useState(false);
  // A person's report history is most useful in full, so a new deep link shows All.
  const [linkedTarget, setLinkedTarget] = useState(targetUserId);
  if (linkedTarget !== targetUserId) {
    setLinkedTarget(targetUserId);
    if (targetUserId) setStatus("ALL");
  }

  const list = usePagedList<SafetyReport>("/reports", {
    resolved: status === "ALL" ? undefined : status === "RESOLVED",
    involvesMinor: minorsOnly ? true : undefined,
    targetUserId: targetUserId || undefined,
  });

  // The shared report drawer announces every change it makes (see
  // REPORTS_CHANGED_EVENT in ReportDrawer): patch the row at once, then
  // re-fetch so filters and other rows about the same person stay true.
  const { updateItem, reload } = list;
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ReportsChangedDetail>).detail;
      if (detail?.report) updateItem(detail.report.id, detail.report);
      reload();
    };
    window.addEventListener(REPORTS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(REPORTS_CHANGED_EVENT, onChange);
  }, [updateItem, reload]);

  const targetName =
    targetNameParam ??
    list.items.find(r => r.targetUserId === targetUserId)?.targetUser?.fullName ??
    "this person";

  // Queue totals are platform-wide, so they are only shown when no other filter narrows the list.
  const showCounts = !minorsOnly && !targetUserId && stats != null;
  const counts = showCounts
    ? { open: stats.reports.open, resolved: stats.reports.resolved, all: stats.reports.open + stats.reports.resolved }
    : null;

  const columns: Column<SafetyReport>[] = [
    {
      key: "subject",
      header: "Reported",
      primary: true,
      className: "md:min-w-[15rem]",
      cell: r => {
        const isUser = r.targetType === "USER";
        const Icon = isUser ? UserRound : CalendarDays;
        const drive = r.event;
        return (
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                r.involvesMinor ? "bg-forest text-white" : "bg-sunken text-forest"
              )}
            >
              <Icon aria-hidden className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {isUser ? (
                  <PersonLink id={r.targetUserId} name={reportSubject(r)} />
                ) : drive ? (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      openEvent(drive.id);
                    }}
                    className="rounded-sm text-left font-semibold text-forest underline decoration-forest/30 underline-offset-[3px] hover:decoration-forest"
                  >
                    {drive.title}
                  </button>
                ) : (
                  <span className="text-ink-3">{reportSubject(r)}</span>
                )}
                {r.targetUser?.isMinor ? <MinorBadge age={r.targetUser.age} /> : null}
                {r.targetUser?.isBanned ? <BannedBadge /> : null}
              </div>
              <p className="mt-0.5 text-meta text-ink-2">
                {isUser ? "Person" : "Drive"} · <span className="font-semibold">{reportCategoryLabel(r.category)}</span>
                {r.otherReportsAgainstTarget > 0 ? (
                  <>
                    {" · "}
                    <span className="font-semibold text-ink">{plural(r.otherReportsAgainstTarget, "other report")}</span>
                  </>
                ) : null}
              </p>
              {!isUser && r.event?.organizer.isMinor ? (
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-meta text-ink-2">
                  Organizer <MinorBadge age={r.event.organizer.age} />
                </p>
              ) : null}
              <p className="mt-0.5 line-clamp-1 max-w-md break-words text-meta text-ink-3">{r.reason}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "reporter",
      header: "Reported by",
      cell: r => (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <PersonLink id={r.reporterId} name={r.reporter.fullName} />
          {r.reporter.isMinor ? <MinorBadge age={r.reporter.age} /> : null}
        </span>
      ),
    },
    {
      key: "filed",
      header: "Filed",
      cell: r => (
        <time dateTime={r.createdAt} title={formatDateTime(r.createdAt)} className="whitespace-nowrap text-meta text-ink-2">
          {timeAgo(r.createdAt)}
        </time>
      ),
    },
    { key: "status", header: "Status", cell: r => <ReportStatusBadge report={r} /> },
  ];

  const emptyTitle = (() => {
    const scope = minorsOnly ? " involving under-18s" : "";
    const about = targetUserId ? ` about ${targetName}` : "";
    if (status === "OPEN") return `No open reports${about}${scope}`;
    if (status === "RESOLVED") return `No resolved reports${about}${scope}`;
    return `No reports${about}${scope}`;
  })();

  return (
    <>
      <PageHeader
        title="Safety reports"
        description="Reports from volunteers and organizers about people and drives. Open reports come first, and any report involving someone under 18 is highlighted."
      />

      <Toolbar>
        <Segmented<StatusFilter>
          label="Report status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "OPEN", label: "Open", count: counts?.open },
            { value: "RESOLVED", label: "Resolved", count: counts?.resolved },
            { value: "ALL", label: "All", count: counts?.all },
          ]}
        />
        <MinorToggle checked={minorsOnly} onChange={setMinorsOnly} />
        {targetUserId ? (
          <FilterChip label={`Reports about ${targetName}`} onRemove={() => go("reports")} />
        ) : null}
      </Toolbar>

      <Panel bodyClassName="p-0">
        <DataTable
          caption="Safety reports"
          columns={columns}
          rows={list.items}
          rowKey={r => r.id}
          state={list.state}
          error={list.error}
          onRetry={list.reload}
          hasMore={list.hasMore}
          loadingMore={list.loadingMore}
          onLoadMore={list.loadMore}
          onRowClick={openReport}
          rowTone={r => (r.involvesMinor ? "attention" : "default")}
          empty={{
            icon: ShieldCheck,
            title: emptyTitle,
            body:
              status === "OPEN" && !minorsOnly && !targetUserId
                ? "When a volunteer or organizer reports a person or a drive, it lands here."
                : "Try another status or remove a filter.",
          }}
        />
      </Panel>
    </>
  );
}

/** Checkbox styled as a toolbar control (no shared toggle primitive yet). */
function MinorToggle({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="inline-flex h-10 cursor-pointer select-none items-center gap-2.5 rounded-md bg-surface px-3 text-meta font-semibold text-ink ring-1 ring-inset ring-line transition-shadow duration-150 hover:ring-ink-3 has-[:checked]:text-forest has-[:checked]:ring-2 has-[:checked]:ring-forest">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="size-4 shrink-0 cursor-pointer accent-forest"
      />
      <UserRound aria-hidden className="size-4 shrink-0" />
      Only reports involving under-18s
    </label>
  );
}

/** A removable active-filter chip (no shared primitive yet). */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-8 max-w-full items-center gap-1 rounded-full bg-forest-200/50 pl-3 pr-1 text-meta font-semibold text-forest">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        title="Remove filter"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-forest-200"
      >
        <X aria-hidden className="size-4" />
      </button>
    </span>
  );
}
