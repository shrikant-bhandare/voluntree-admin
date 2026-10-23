"use client";

import { useState, type ReactNode } from "react";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  Download,
  Image as ImageIcon,
  Megaphone,
  MessageSquare,
  ScrollText,
  ShieldAlert,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { usePagedList } from "../lib/hooks";
import { useSession } from "../lib/session";
import { formatDate, formatDateTime, formatTime, humanize, timeAgo } from "../lib/format";
import { exportToCsv } from "../utils/csvExporter";
import type { AdminActionRow, EventStatus } from "../types/admin";
import { useConsole } from "../components/shell/ConsoleContext";
import { Button, EmptyState, ErrorState, PageHeader, Panel, Segmented, Select, Skeleton, Toolbar } from "../components/ui/primitives";
import { eventStatusLabel } from "../components/common/bits";
import type { ViewId } from "../components/shell/nav";

/* -------------------------------------------------------------- Vocabulary */

const ACTION_LABEL: Record<string, string> = {
  USER_BANNED: "Suspended an account",
  USER_UNBANNED: "Reinstated an account",
  NGO_APPROVED: "Verified an NGO",
  NGO_REJECTED: "Rejected an NGO application",
  NGO_REVOKED: "Revoked an NGO's verification",
  NGO_RESET_TO_PENDING: "Returned an NGO to review",
  EVENT_ACTIVE: "Set a drive to active",
  EVENT_FEATURED: "Featured a drive",
  EVENT_FULL: "Marked a drive as full",
  EVENT_SUSPENDED: "Suspended a drive",
  EVENT_CANCELLED: "Cancelled a drive",
  EVENT_COMPLETED: "Marked a drive as completed",
  EVENT_CLOSED: "Closed a drive",
  EVENT_DRAFT: "Moved a drive back to draft",
  EVENT_EDITED: "Edited a drive",
  EVENT_DELETED: "Deleted a drive",
  REPORT_RESOLVED: "Resolved a safety report",
  REPORT_REOPENED: "Reopened a safety report",
  REPORT_CONVERSATION_VIEWED: "Read a reported conversation",
  ATTENDANCE_CLOSED: "Closed a check-in session",
  PAYMENT_SETTLED: "Marked a payment as paid",
  PAYMENT_FAILED: "Marked a payment as failed",
  POST_DELETED: "Removed a photo post",
  COMMENT_DELETED: "Removed a comment",
  APPLICATION_APPROVED: "Approved an application",
  APPLICATION_REJECTED: "Rejected an application",
  APPLICATION_WAITLISTED: "Waitlisted an application",
  APPLICATION_UNDER_REVIEW: "Put an application under review",
  APPLICATION_PENDING: "Moved an application back to pending",
  BROADCAST_SENT: "Sent a broadcast",
};

/** USER_BANNED → "Suspended an account"; unknown codes are humanised. */
export function auditActionLabel(action: string): string {
  return ACTION_LABEL[action] ?? humanize(action);
}

const TARGET_ICON: Record<string, LucideIcon> = {
  USER: UserRound,
  NGO: Building2,
  EVENT: CalendarDays,
  REPORT: ShieldAlert,
  ATTENDANCE: Clock,
  PAYMENT: Wallet,
  POST: ImageIcon,
  COMMENT: MessageSquare,
  APPLICATION: ClipboardList,
  BROADCAST: Megaphone,
};

const TARGET_TYPES: { value: string; label: string; one: string }[] = [
  { value: "USER", label: "People", one: "person" },
  { value: "NGO", label: "NGOs", one: "NGO" },
  { value: "EVENT", label: "Drives", one: "drive" },
  { value: "REPORT", label: "Safety reports", one: "safety report" },
  { value: "APPLICATION", label: "Applications", one: "application" },
  { value: "ATTENDANCE", label: "Check-in sessions", one: "check-in session" },
  { value: "PAYMENT", label: "Payments", one: "payment" },
  { value: "POST", label: "Photo posts", one: "photo post" },
  { value: "COMMENT", label: "Comments", one: "comment" },
  { value: "BROADCAST", label: "Broadcasts", one: "broadcast" },
];

const RESOLUTION_LABEL: Record<string, string> = {
  DISMISSED: "Dismissed",
  ACTION_TAKEN: "Action taken",
  BANNED_TARGET: "Suspended the reported person",
};

const AUDIENCE_LABEL: Record<string, string> = {
  ALL: "Everyone",
  VOLUNTEER: "Volunteers",
  ORGANIZER: "Organizers",
  ADMIN: "Admins",
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** "dateOfBirth" → "date of birth". */
function fieldName(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

/** The recorded reason, note and other context worth reading, in plain words. */
function metadataLines(entry: AdminActionRow): { label: string; value: string; quote?: boolean }[] {
  const m = entry.metadata ?? {};
  const lines: { label: string; value: string; quote?: boolean }[] = [];
  const reason = str(m.reason);
  const note = str(m.note);
  if (reason) lines.push({ label: "Reason", value: reason, quote: true });
  if (note) lines.push({ label: "Note", value: note, quote: true });
  const from = str(m.from);
  const to = str(m.to);
  if (from && to) {
    lines.push({
      label: "Status",
      value: `${eventStatusLabel(from as EventStatus)} to ${eventStatusLabel(to as EventStatus)}`,
    });
  }
  if (Array.isArray(m.fields) && m.fields.length > 0) {
    lines.push({ label: "Changed", value: m.fields.map(f => fieldName(String(f))).join(", ") });
  }
  const outcome = str(m.resolutionAction);
  if (outcome) lines.push({ label: "Outcome", value: RESOLUTION_LABEL[outcome] ?? humanize(outcome) });
  const ref = str(m.gatewayReference);
  if (ref) lines.push({ label: "Reference", value: ref });
  const audience = str(m.targetRole);
  if (audience) lines.push({ label: "Audience", value: AUDIENCE_LABEL[audience] ?? humanize(audience) });
  const content = str(m.content);
  if (content) lines.push({ label: "Removed text", value: content, quote: true });
  const caption = str(m.caption);
  if (caption) lines.push({ label: "Caption", value: caption, quote: true });
  return lines;
}

/**
 * Server summaries still carry raw enum codes ("a INAPPROPRIATE report",
 * "from ACTIVE to FEATURED"). Lower-case those outside quoted titles, fixing
 * the article; references such as TX-SUB-G7H8I9 are left alone.
 */
export function readableSummary(summary: string): string {
  return summary
    .split(/("[^"]*")/)
    .map(part =>
      part.startsWith('"')
        ? part
        : part.replace(/(\ba )?(?<![-\w])([A-Z]{4,}(?:_[A-Z]+)*)(?![-\w])/g, (_m, article: string | undefined, word: string) => {
            const text = word.toLowerCase().split("_").join(" ");
            return (article ? (/^[aeiou]/.test(text) ? "an " : "a ") : "") + text;
          })
    )
    .join("");
}

interface TargetLink {
  label: string;
  onClick: () => void;
}

/* ------------------------------------------------------------------ Entry */

/**
 * One audit entry: what was done, by whom, when, why, and links to the
 * record. Also used for the "Admin history" list in the person drawer.
 */
export function AuditEntry({
  entry,
  hideTargetFor,
  showDate = true,
}: {
  entry: AdminActionRow;
  /** Leave out links back to this record (the drawer it is shown in). */
  hideTargetFor?: string;
  showDate?: boolean;
}) {
  const { openUser, openEvent, go } = useConsole();
  const m = entry.metadata ?? {};
  const Icon = TARGET_ICON[entry.targetType] ?? ScrollText;

  const links: TargetLink[] = [];
  const person = (id: string | null, label: string) => {
    if (id && id !== hideTargetFor) links.push({ label, onClick: () => openUser(id) });
  };
  const drive = (id: string | null) => {
    if (id) links.push({ label: "View drive", onClick: () => openEvent(id) });
  };
  const screen = (view: ViewId, label: string, params?: Record<string, string>) =>
    links.push({ label, onClick: () => go(view, params) });

  switch (entry.targetType) {
    case "USER":
      person(entry.targetId, "View person");
      if (str(m.reportId)) screen("reports", "Safety reports", { targetUserId: entry.targetId });
      break;
    case "EVENT":
      if (entry.action !== "EVENT_DELETED") drive(entry.targetId);
      break;
    case "REPORT":
      screen("reports", "Safety reports");
      break;
    case "NGO":
      screen("ngos", "NGO approvals");
      break;
    case "PAYMENT":
      screen("payments", "Payments");
      break;
    case "BROADCAST":
      screen("broadcasts", "Broadcasts");
      break;
    case "ATTENDANCE":
    case "APPLICATION":
      person(str(m.volunteerId), "View volunteer");
      drive(str(m.eventId));
      break;
    case "POST":
      person(str(m.authorId), "View organizer");
      drive(str(m.eventId));
      break;
    case "COMMENT":
      person(str(m.authorId), "View author");
      break;
  }

  const details = metadataLines(entry);

  return (
    <li className="flex gap-3 px-4 py-4 sm:px-5">
      <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-mint-soft text-forest">
        <Icon aria-hidden className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <p className="text-row font-semibold text-ink">{auditActionLabel(entry.action)}</p>
          <time
            dateTime={entry.createdAt}
            title={formatDateTime(entry.createdAt)}
            className="tabular shrink-0 text-meta text-ink-3"
          >
            {showDate ? formatDateTime(entry.createdAt) : formatTime(entry.createdAt)}
          </time>
        </div>
        <p className="mt-0.5 break-words text-meta text-ink-2">{readableSummary(entry.summary)}</p>
        <p className="mt-1 text-meta text-ink-3">
          By{" "}
          <span className="font-semibold text-ink-2">
            {entry.admin?.fullName ?? (entry.adminId ? "A removed admin" : "Voluntree (automatic)")}
          </span>
          {showDate ? null : <> · {timeAgo(entry.createdAt)}</>}
        </p>

        {details.length > 0 ? (
          <dl className="mt-2 space-y-1.5">
            {details.map(d => (
              <div key={d.label} className="flex flex-wrap gap-x-2 text-meta">
                <dt className="font-semibold text-ink-2">{d.label}:</dt>
                <dd
                  className={
                    d.quote
                      ? "min-w-0 flex-1 whitespace-pre-line break-words border-l-2 border-line pl-2 text-ink"
                      : "min-w-0 flex-1 break-words text-ink"
                  }
                >
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {links.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {links.map(l => (
              <button
                key={l.label}
                type="button"
                onClick={l.onClick}
                className="rounded-sm text-meta font-semibold text-forest underline decoration-forest/30 underline-offset-[3px] hover:decoration-forest"
              >
                {l.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------- View */

type Whose = "ALL" | "MINE";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return formatDate(d);
}

export default function AuditView() {
  const { admin } = useSession();
  const { params } = useConsole();
  const [targetType, setTargetType] = useState(() => params.get("targetType") ?? "");
  const [targetId, setTargetId] = useState(() => params.get("targetId") ?? "");
  const [whose, setWhose] = useState<Whose>("ALL");

  // go("audit", { targetType, targetId }) while already on this screen (e.g.
  // from the person drawer) changes params without remounting the view.
  const [seenParams, setSeenParams] = useState(params);
  if (params !== seenParams) {
    setSeenParams(params);
    setTargetType(params.get("targetType") ?? "");
    setTargetId(params.get("targetId") ?? "");
  }

  const list = usePagedList<AdminActionRow>("/admin/audit", {
    targetType: targetType || undefined,
    targetId: targetId || undefined,
    adminId: whose === "MINE" ? admin?.id : undefined,
  });

  const groups: { day: string; entries: AdminActionRow[] }[] = [];
  for (const entry of list.items) {
    const day = dayLabel(entry.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.entries.push(entry);
    else groups.push({ day, entries: [entry] });
  }

  let content: ReactNode;
  if (list.state === "loading" && list.items.length === 0) {
    content = (
      <div role="status" aria-label="Loading the audit log" aria-busy className="divide-y divide-line-soft">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-5 py-4">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (list.state === "error" && list.items.length === 0) {
    content = <ErrorState message={list.error ?? "Could not load the audit log."} onRetry={list.reload} />;
  } else if (list.items.length === 0) {
    content = (
      <EmptyState
        icon={ScrollText}
        title="No admin actions here"
        body={
          targetType || targetId || whose === "MINE"
            ? "Nothing matches these filters. Try showing every record type or every admin."
            : "Every suspension, approval, settlement and removal made in the console will be listed here."
        }
      />
    );
  } else {
    content = (
      <>
        {groups.map(g => (
          <section key={g.day} aria-label={g.day}>
            <h2 className="border-b border-line-soft bg-surface px-5 pb-2 pt-4 text-label font-semibold uppercase tracking-[0.04em] text-ink-3">
              {g.day}
            </h2>
            <ol className="divide-y divide-line-soft">
              {g.entries.map(entry => (
                <AuditEntry key={entry.id} entry={entry} showDate={false} />
              ))}
            </ol>
          </section>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3 text-meta text-ink-3">
          <span className="tabular">
            Showing {list.items.length.toLocaleString("en-IN")}
            {list.hasMore ? " so far" : list.items.length === 1 ? " entry" : " entries"}
          </span>
          {list.hasMore ? (
            <Button size="sm" onClick={list.loadMore} loading={list.loadingMore}>
              Load older entries
            </Button>
          ) : null}
          {list.state === "error" && list.error ? <span className="text-danger">{list.error}</span> : null}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Who did what in the console, newest first. Entries are written automatically and cannot be edited or deleted."
        actions={
          <Button
            icon={Download}
            disabled={list.items.length === 0}
            onClick={() =>
              exportToCsv(
                "voluntree_audit_log",
                ["Date", "Admin", "Action", "Summary", "Record type", "Record ID", "Reason or note"],
                list.items.map(e => [
                  formatDateTime(e.createdAt),
                  e.admin?.fullName ?? "",
                  auditActionLabel(e.action),
                  readableSummary(e.summary),
                  humanize(e.targetType),
                  e.targetId,
                  metadataLines(e)
                    .filter(l => l.quote)
                    .map(l => `${l.label}: ${l.value}`)
                    .join(" | "),
                ])
              )
            }
          >
            Export loaded rows
          </Button>
        }
      />

      <Toolbar>
        <Select
          aria-label="Record type"
          value={targetType}
          onChange={e => {
            setTargetType(e.target.value);
            setTargetId("");
          }}
          className="w-full sm:w-56"
        >
          <option value="">All record types</option>
          {TARGET_TYPES.map(t => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <Segmented<Whose>
          label="Whose actions"
          value={whose}
          onChange={setWhose}
          options={[
            { value: "ALL", label: "All admins" },
            { value: "MINE", label: "Only my actions" },
          ]}
        />
        {targetId ? (
          <span className="inline-flex h-8 items-center gap-2 rounded-full pl-3 pr-1 text-meta font-semibold text-ink-2 ring-1 ring-inset ring-line">
            Only this {TARGET_TYPES.find(t => t.value === targetType)?.one ?? "record"}
            <button
              type="button"
              aria-label="Show all records"
              onClick={() => setTargetId("")}
              className="inline-flex size-6 items-center justify-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
            >
              <X aria-hidden className="size-4" />
            </button>
          </span>
        ) : null}
      </Toolbar>

      <Panel bodyClassName="p-0" className="overflow-hidden">
        {content}
      </Panel>
    </>
  );
}
