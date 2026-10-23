"use client";

import { useState, type ReactNode } from "react";
import {
  Ban,
  CalendarDays,
  Check,
  CircleDot,
  Eye,
  MessagesSquare,
  Paperclip,
  RotateCcw,
  ShieldAlert,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { ApiError } from "../../lib/api";
import { useMutation, useResource, type Resource } from "../../lib/hooks";
import { useApi, useSession } from "../../lib/session";
import { useFeedback } from "../../lib/feedback";
import { formatDateTime, humanize, plural } from "../../lib/format";
import { findEventAction, oneLine } from "../../utils/eventStatus";
import type { ChatMessage, ReportContext, ReportParty, ResolutionAction, SafetyReport } from "../../types/admin";
import { useConsole } from "../shell/ConsoleContext";
import { Drawer } from "../ui/Overlay";
import {
  Avatar,
  Badge,
  Button,
  Details,
  ErrorState,
  SectionTitle,
  Skeleton,
  cn,
  type BadgeTone,
  type ButtonVariant,
} from "../ui/primitives";
import { BannedBadge, EventStatusBadge, MinorBadge, PersonLink, RoleBadge } from "../common/bits";

/* ------------------------------------------------------ Shared report bits */

/**
 * Fired on `window` after the drawer changes a report (resolve, reopen,
 * suspend). The drawer is opened from several screens and only receives a
 * copy of the row, so instead of a callback it announces the change and
 * ReportsView listens: it patches the row in place from `detail.report` and
 * re-fetches the first page (the row may now fall outside the active filter,
 * and a suspension changes other rows about the same person).
 */
export const REPORTS_CHANGED_EVENT = "voluntree:reports-changed";

export interface ReportsChangedDetail {
  report: SafetyReport;
}

function notifyReportsChanged(report: SafetyReport) {
  window.dispatchEvent(new CustomEvent<ReportsChangedDetail>(REPORTS_CHANGED_EVENT, { detail: { report } }));
}

/** The categories the app offers (chat and drive report sheets). */
const CATEGORY_LABEL: Record<string, string> = {
  HARASSMENT: "Harassment or bullying",
  INAPPROPRIATE: "Inappropriate or sexual content",
  SPAM: "Spam or scam",
  FAKE_EVENT: "Fake drive or scam",
  FRAUD: "Fraud or illegal activity",
  OTHER: "Something else",
};

export function reportCategoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? humanize(category);
}

/** The reported person's name, or the reported drive's title. */
export function reportSubject(r: SafetyReport): string {
  if (r.targetType === "USER") return r.targetUser?.fullName ?? "Deleted account";
  return r.event?.title ?? "Deleted drive";
}

type Outcome = "OPEN" | "RESOLVED" | ResolutionAction;

const OUTCOME: Record<Outcome, { label: string; tone: BadgeTone; icon: LucideIcon }> = {
  OPEN: { label: "Open", tone: "info", icon: CircleDot },
  RESOLVED: { label: "Resolved", tone: "neutral", icon: Check },
  DISMISSED: { label: "Dismissed", tone: "neutral", icon: X },
  ACTION_TAKEN: { label: "Acted on", tone: "success", icon: Check },
  BANNED_TARGET: { label: "Account suspended", tone: "danger", icon: Ban },
};

function outcomeOf(r: SafetyReport): Outcome {
  if (!r.resolved) return "OPEN";
  return r.resolutionAction ?? "RESOLVED";
}

export function ReportStatusBadge({ report }: { report: SafetyReport }) {
  const o = OUTCOME[outcomeOf(report)];
  return (
    <Badge tone={o.tone} icon={o.icon}>
      {o.label}
    </Badge>
  );
}

/** "Involves someone under 18" — forest like MinorBadge, never red. */
export function InvolvesMinorBadge() {
  return (
    <Badge tone="forest" icon={UserRound}>
      Involves someone under 18
    </Badge>
  );
}

/* ------------------------------------------------------------------ Drawer */

export function ReportDrawer({ report, onClose }: { report: SafetyReport; onClose: () => void }) {
  // Keyed so opening a different report from the same drawer slot starts
  // with fresh state (the conversation is never carried over).
  return <ReportDrawerBody key={report.id} initial={report} onClose={onClose} />;
}

function ReportDrawerBody({ initial, onClose }: { initial: SafetyReport; onClose: () => void }) {
  const api = useApi();
  const { admin } = useSession();
  const { toast, confirm } = useFeedback();
  const { refreshStats, openEvent, go } = useConsole();
  const [report, setReport] = useState(initial);
  const [run, busy] = useMutation();
  const [showConversation, setShowConversation] = useState(false);

  const isUserReport = report.targetType === "USER";
  const target = report.targetUser;
  const event = report.event;
  const subject = reportSubject(report);
  const errorText = (err: unknown) => (err instanceof ApiError ? err.message : undefined);

  const context = useResource<ReportContext>(
    showConversation && isUserReport && target ? `/reports/${report.id}/context` : null
  );

  const apply = (next: SafetyReport) => {
    setReport(next);
    notifyReportsChanged(next);
    refreshStats();
  };

  /** PATCH /reports/:id/resolve, then reflect it locally. Throws on failure. */
  const resolveAs = async (base: SafetyReport, action: ResolutionAction, note: string) => {
    const updated = await api<Partial<SafetyReport> | undefined>(`/reports/${base.id}/resolve`, {
      method: "PATCH",
      body: { action, note },
    });
    apply({
      ...base,
      resolved: true,
      resolutionAction: action,
      resolutionNote: updated?.resolutionNote ?? (note || null),
      resolvedAt: updated?.resolvedAt ?? new Date().toISOString(),
      resolvedById: updated?.resolvedById ?? admin?.id ?? null,
      resolvedBy: admin ? { id: admin.id, fullName: admin.fullName } : base.resolvedBy,
      targetUser:
        action === "BANNED_TARGET" && base.targetUser ? { ...base.targetUser, isBanned: true } : base.targetUser,
    });
  };

  const suspendAccount = async () => {
    if (!target) return;
    const r = await confirm({
      title: `Suspend ${oneLine(target.fullName, 60)}?`,
      tone: "danger",
      confirmLabel: "Suspend account & resolve",
      body: (
        <>
          <p>
            {target.fullName} loses access to Voluntree straight away and cannot use the app until an administrator
            lifts the suspension from their profile.
          </p>
          <p>This report is closed as &ldquo;Account suspended&rdquo;.</p>
        </>
      ),
      note: {
        label: "Reason for suspending",
        placeholder: "What they did and why it needs a suspension",
        minLength: 5,
        hint: "Saved as the resolution note and in the audit log.",
      },
    });
    if (!r.confirmed) return;
    await run("ban", async () => {
      try {
        await resolveAs(report, "BANNED_TARGET", r.note);
        toast({ title: "Account suspended and report resolved", description: target.fullName });
      } catch (err) {
        toast({ tone: "error", title: "Could not suspend the account", description: errorText(err) });
      }
    });
  };

  const markActionTaken = async () => {
    const r = await confirm({
      title: "Mark action taken?",
      confirmLabel: "Mark action taken",
      body: (
        <p>
          Use this when you have dealt with the report another way, for example by warning {isUserReport ? "the person" : "the organizer"}{" "}
          or removing content. The report is closed as &ldquo;Acted on&rdquo;.
        </p>
      ),
      note: {
        label: "What you did",
        placeholder: "e.g. Warned them by email and removed the comment",
        minLength: 5,
        hint: "Saved as the resolution note and in the audit log.",
      },
    });
    if (!r.confirmed) return;
    await run("action", async () => {
      try {
        await resolveAs(report, "ACTION_TAKEN", r.note);
        toast({ title: "Report resolved as acted on", description: subject });
      } catch (err) {
        toast({ tone: "error", title: "Could not resolve the report", description: errorText(err) });
      }
    });
  };

  const dismiss = async () => {
    const r = await confirm({
      title: "Dismiss this report?",
      confirmLabel: "Dismiss report",
      body: <p>The report is closed with no action against {subject}. You can reopen it later if new evidence turns up.</p>,
      note: {
        label: "Why you are dismissing it",
        placeholder: "e.g. The messages do not break the community rules",
        minLength: 5,
        hint: "Saved as the resolution note and in the audit log.",
      },
    });
    if (!r.confirmed) return;
    await run("dismiss", async () => {
      try {
        await resolveAs(report, "DISMISSED", r.note);
        toast({ title: "Report dismissed", description: subject });
      } catch (err) {
        toast({ tone: "error", title: "Could not dismiss the report", description: errorText(err) });
      }
    });
  };

  const suspendDriveDef = event ? findEventAction(event.status, "SUSPEND") : null;

  const suspendDrive = async () => {
    if (!event || !suspendDriveDef?.confirm) return;
    // The shared copy starts with the question; the rest explains the effect.
    const [, ...explain] = suspendDriveDef.confirm(event.title).split("\n\n");
    const r = await confirm({
      title: "Suspend this drive?",
      tone: "danger",
      confirmLabel: "Suspend drive & resolve",
      body: (
        <>
          <p className="font-semibold text-ink">{event.title}</p>
          {explain.map(p => (
            <p key={p}>{p}</p>
          ))}
          <p>This report is then closed as &ldquo;Acted on&rdquo;.</p>
        </>
      ),
      note: {
        label: "Reason for suspending the drive",
        placeholder: "What is wrong with the drive",
        minLength: 5,
        hint: "Saved as the resolution note and in the audit log.",
      },
    });
    if (!r.confirmed) return;
    await run("drive", async () => {
      try {
        await api(`/events/${event.id}/status`, { method: "PATCH", body: { status: "SUSPENDED" } });
      } catch (err) {
        toast({ tone: "error", title: "Could not suspend the drive", description: errorText(err) });
        return;
      }
      const suspended: SafetyReport = { ...report, event: { ...event, status: "SUSPENDED" } };
      try {
        await resolveAs(suspended, "ACTION_TAKEN", r.note);
        toast({ title: "Drive suspended and report resolved", description: event.title });
      } catch (err) {
        // The drive change stuck; show it and keep the report open.
        apply(suspended);
        toast({
          tone: "error",
          title: "The drive is suspended, but the report is still open",
          description: errorText(err),
        });
      }
    });
  };

  const reopen = async () => {
    const r = await confirm({
      title: "Reopen this report?",
      confirmLabel: "Reopen report",
      body: (
        <>
          <p>It goes back into the open queue. The outcome and note are cleared from the report; the audit log keeps them.</p>
          {report.resolutionAction === "BANNED_TARGET" && target ? (
            <p>Reopening does not lift the suspension. Do that from {target.fullName}&rsquo;s profile.</p>
          ) : null}
          {!isUserReport && event?.status === "SUSPENDED" ? (
            <p>Reopening does not reinstate the drive. Do that from the drive itself.</p>
          ) : null}
        </>
      ),
    });
    if (!r.confirmed) return;
    await run("reopen", async () => {
      try {
        await api(`/reports/${report.id}/reopen`, { method: "PATCH" });
        apply({
          ...report,
          resolved: false,
          resolutionAction: null,
          resolutionNote: null,
          resolvedAt: null,
          resolvedById: null,
          resolvedBy: null,
        });
        toast({ title: "Report reopened", description: subject });
      } catch (err) {
        toast({ tone: "error", title: "Could not reopen the report", description: errorText(err) });
      }
    });
  };

  const others = report.otherReportsAgainstTarget;
  const minorParties = [report.reporter, target, event?.organizer].filter(
    (p): p is ReportParty => Boolean(p?.isMinor)
  );

  return (
    <Drawer
      open
      onClose={onClose}
      size="lg"
      title={`Report about ${subject}`}
      subtitle={`${reportCategoryLabel(report.category)} · filed ${formatDateTime(report.createdAt)}`}
      meta={
        <>
          <ReportStatusBadge report={report} />
          {report.involvesMinor ? <InvolvesMinorBadge /> : null}
          <Badge tone="outline">{isUserReport ? "Person" : "Drive"}</Badge>
        </>
      }
    >
      {report.involvesMinor ? (
        <div className="mb-6 flex gap-3 rounded-lg bg-mint-soft p-4 text-forest ring-1 ring-inset ring-forest/20">
          <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <p className="text-meta">
            <span className="font-semibold">
              {minorParties.length > 0
                ? `${minorParties.map(p => p.fullName).join(" and ")} ${minorParties.length === 1 ? "is" : "are"} under 18.`
                : "Someone in this report is under 18."}
            </span>{" "}
            Deal with this report before others and write down your reasoning in the note.
          </p>
        </div>
      ) : null}

      <SectionTitle>Who is involved</SectionTitle>
      {!isUserReport ? (
        <div className="mb-3 rounded-lg bg-surface p-4 ring-1 ring-line-soft">
          <p className="text-label font-semibold uppercase tracking-[0.04em] text-ink-3">Reported drive</p>
          {event ? (
            <div className="mt-2 flex items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-forest">
                <CalendarDays aria-hidden className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => openEvent(event.id)}
                  className="rounded-sm text-left font-semibold text-forest underline decoration-forest/30 underline-offset-[3px] hover:decoration-forest"
                >
                  {event.title}
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <EventStatusBadge status={event.status} />
                  <span className="text-meta text-ink-2">{humanize(event.category)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-meta text-ink-3">This drive no longer exists.</p>
          )}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <PartyCard
          label={isUserReport ? "Reported person" : "Organizer of the drive"}
          party={isUserReport ? target : (event?.organizer ?? null)}
        />
        <PartyCard label="Reported by" party={report.reporter} />
      </div>

      <SectionTitle aside={reportCategoryLabel(report.category)}>What was reported</SectionTitle>
      <div className="rounded-lg bg-surface p-4 ring-1 ring-line-soft">
        <p className="text-label font-semibold uppercase tracking-[0.04em] text-ink-3">In the reporter&rsquo;s words</p>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-row text-ink">{report.reason}</p>
      </div>

      {report.message ? <ReportedMessage message={report.message} report={report} /> : null}

      <SectionTitle>History</SectionTitle>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-row text-ink-2">
          {others > 0
            ? `There ${others === 1 ? "is" : "are"} ${plural(others, "other report")} about this ${isUserReport ? "person" : "drive"}, open or resolved.`
            : `No other reports about this ${isUserReport ? "person" : "drive"}.`}
        </p>
        {others > 0 && isUserReport && target ? (
          <Button
            size="sm"
            variant="ghost"
            className="self-start sm:self-auto"
            onClick={() => go("reports", { targetUserId: target.id, targetName: target.fullName })}
          >
            See all reports about {target.fullName.split(/\s+/)[0]}
          </Button>
        ) : null}
      </div>

      {isUserReport && target ? (
        <>
          <SectionTitle>Conversation</SectionTitle>
          {!showConversation ? (
            <div className="rounded-lg bg-surface p-4 ring-1 ring-line-soft">
              <p className="text-row text-ink-2">
                See the messages between {report.reporter.fullName} and {target.fullName} around the time of the
                report.
              </p>
              <Button className="mt-3" icon={MessagesSquare} onClick={() => setShowConversation(true)}>
                Show conversation
              </Button>
              <p className="mt-2 flex items-center gap-1.5 text-meta text-ink-3">
                <Eye aria-hidden className="size-4 shrink-0" />
                Opening the conversation is recorded in the audit log.
              </p>
            </div>
          ) : (
            <Transcript context={context} report={report} />
          )}
        </>
      ) : null}

      {report.resolved ? (
        <>
          <SectionTitle>Outcome</SectionTitle>
          <div className="rounded-lg bg-surface p-4 ring-1 ring-line-soft">
            <Details
              items={[
                { label: "Outcome", value: <ReportStatusBadge report={report} /> },
                { label: "Resolved by", value: report.resolvedBy?.fullName ?? "Unknown administrator" },
                { label: "Resolved", value: formatDateTime(report.resolvedAt) },
                {
                  label: "Note",
                  value: report.resolutionNote ? (
                    <span className="whitespace-pre-wrap">{report.resolutionNote}</span>
                  ) : (
                    <span className="text-ink-3">No note recorded</span>
                  ),
                },
              ]}
            />
            <Button className="mt-5" icon={RotateCcw} loading={busy === "reopen"} onClick={reopen}>
              Reopen report
            </Button>
          </div>
        </>
      ) : (
        <>
          <SectionTitle>Decide</SectionTitle>
          <div className="space-y-3">
            {isUserReport ? (
              <DecisionOption
                title="Suspend the account"
                body={
                  !target
                    ? "The account no longer exists."
                    : target.userType === "ADMIN"
                      ? "Administrator accounts cannot be suspended from a report."
                      : target.isBanned
                        ? `${target.fullName} is already suspended. Close the report with Mark action taken.`
                        : `${target.fullName} loses access straight away and the report is closed.`
                }
                action={
                  target && target.userType !== "ADMIN" && !target.isBanned ? (
                    <DecisionButton variant="danger" icon={Ban} busy={busy} id="ban" onClick={suspendAccount}>
                      Suspend account &amp; resolve
                    </DecisionButton>
                  ) : null
                }
              />
            ) : event ? (
              <DecisionOption
                title="Suspend the drive"
                body={
                  suspendDriveDef
                    ? "It disappears from the public listing, its volunteers are notified, and the report is closed as acted on."
                    : `A ${event.status.toLowerCase()} drive cannot be suspended.`
                }
                action={
                  suspendDriveDef ? (
                    <DecisionButton variant="danger" icon={Ban} busy={busy} id="drive" onClick={suspendDrive}>
                      Suspend drive
                    </DecisionButton>
                  ) : null
                }
              />
            ) : null}
            <DecisionOption
              title="Mark action taken"
              body="You dealt with it another way, such as a warning or removing content."
              action={
                <DecisionButton variant="primary" icon={Check} busy={busy} id="action" onClick={markActionTaken}>
                  Mark action taken
                </DecisionButton>
              }
            />
            <DecisionOption
              title="Dismiss"
              body="Nothing here breaks the community rules. Close it with no action."
              action={
                <DecisionButton variant="secondary" icon={X} busy={busy} id="dismiss" onClick={dismiss}>
                  Dismiss
                </DecisionButton>
              }
            />
          </div>
        </>
      )}
    </Drawer>
  );
}

/* ------------------------------------------------------------ Local pieces */

function PartyCard({ label, party }: { label: string; party: ReportParty | null }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface p-4 ring-1 ring-line-soft">
      <p className="text-label font-semibold uppercase tracking-[0.04em] text-ink-3">{label}</p>
      {party ? (
        <div className="mt-2 flex items-start gap-3">
          <Avatar name={party.fullName} />
          <div className="min-w-0">
            <PersonLink id={party.id} name={party.fullName} secondary={party.email} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <RoleBadge role={party.userType} />
              {party.isMinor ? <MinorBadge age={party.age} /> : null}
              {party.isBanned ? <BannedBadge /> : null}
            </div>
            {!party.isMinor ? (
              <p className="mt-1.5 text-meta text-ink-2">
                {party.age != null ? `Age ${party.age}` : "Age not recorded"}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-meta text-ink-3">This account no longer exists.</p>
      )}
    </div>
  );
}

function senderName(senderId: string, report: SafetyReport): string {
  if (senderId === report.reporter.id) return report.reporter.fullName;
  if (report.targetUser && senderId === report.targetUser.id) return report.targetUser.fullName;
  return "Someone else";
}

function MessageBody({ message }: { message: ChatMessage }) {
  return (
    <>
      {message.content ? (
        <p className="mt-1 whitespace-pre-wrap break-words text-row text-ink">{message.content}</p>
      ) : null}
      {message.fileUrl || message.isDeleted ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {message.fileUrl ? (
            <Badge tone="outline" icon={Paperclip}>
              {message.type && message.type !== "TEXT" ? `${humanize(message.type)} attachment` : "Attachment"}
            </Badge>
          ) : null}
          {message.isDeleted ? <Badge tone="neutral">Deleted by sender</Badge> : null}
        </div>
      ) : null}
    </>
  );
}

function ReportedMessage({ message, report }: { message: ChatMessage; report: SafetyReport }) {
  return (
    <>
      <SectionTitle>Reported message</SectionTitle>
      <figure className="rounded-lg border-l-4 border-forest bg-surface p-4 ring-1 ring-line-soft">
        <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-meta font-semibold text-forest">{senderName(message.senderId, report)}</span>
          <time dateTime={message.createdAt} className="text-meta text-ink-3">
            {formatDateTime(message.createdAt)}
          </time>
        </figcaption>
        <blockquote>
          <MessageBody message={message} />
        </blockquote>
      </figure>
    </>
  );
}

function Transcript({
  context,
  report,
}: {
  context: Resource<ReportContext>;
  report: SafetyReport;
}) {
  const note = (
    <p className="mb-3 flex items-center gap-1.5 text-meta text-ink-3">
      <Eye aria-hidden className="size-4 shrink-0" />
      Opening the conversation is recorded in the audit log.
    </p>
  );

  if (context.state === "loading") {
    return (
      <div role="status" aria-label="Loading the conversation" className="space-y-2">
        {note}
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className={cn("h-16", i % 2 ? "sm:ml-10" : "sm:mr-10")} />
        ))}
      </div>
    );
  }
  if (context.state === "error" || !context.data) {
    return (
      <div className="rounded-lg bg-surface ring-1 ring-line-soft">
        <ErrorState message={context.error ?? "The conversation could not be loaded."} onRetry={context.reload} />
      </div>
    );
  }

  const ctx = context.data;
  const minorIds = new Set(
    [report.reporter, report.targetUser].filter((p): p is ReportParty => Boolean(p?.isMinor)).map(p => p.id)
  );
  const nameFor = (id: string) =>
    id === ctx.reporter.id ? ctx.reporter.fullName : id === ctx.targetUser.id ? ctx.targetUser.fullName : "Someone else";

  return (
    <div>
      {note}
      {ctx.messages.length === 0 ? (
        <p className="rounded-lg bg-surface p-4 text-row text-ink-2 ring-1 ring-line-soft">
          No messages between {ctx.reporter.fullName} and {ctx.targetUser.fullName} were found.
        </p>
      ) : (
        <ol aria-label="Conversation transcript" className="space-y-2">
          {ctx.messages.map(m => {
            const reported = m.id === ctx.reportedMessageId;
            const fromReporter = m.senderId === ctx.reporter.id;
            return (
              <li
                key={m.id}
                aria-current={reported ? "true" : undefined}
                className={cn(
                  "rounded-lg px-4 py-3",
                  fromReporter ? "sm:mr-10" : "sm:ml-10",
                  reported
                    ? "bg-mint-soft ring-2 ring-forest"
                    : fromReporter
                      ? "bg-surface ring-1 ring-line-soft"
                      : "bg-sunken ring-1 ring-sunken-2"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-meta font-semibold text-forest">{nameFor(m.senderId)}</span>
                    <span className="text-meta text-ink-3">{fromReporter ? "(reporter)" : "(reported person)"}</span>
                    {minorIds.has(m.senderId) ? <MinorBadge /> : null}
                  </span>
                  <time dateTime={m.createdAt} className="text-meta text-ink-3">
                    {formatDateTime(m.createdAt)}
                  </time>
                </div>
                {reported ? (
                  <Badge tone="forest" icon={ShieldAlert} className="mt-1.5">
                    Reported message
                  </Badge>
                ) : null}
                <MessageBody message={m} />
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-3 text-meta text-ink-3">
        The messages around the {ctx.reportedMessageId ? "reported message" : "time of the report"}, oldest first.
      </p>
    </div>
  );
}

function DecisionOption({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 ring-1 ring-line-soft sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-row font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-meta text-ink-2">{body}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function DecisionButton({
  id,
  busy,
  variant,
  icon,
  onClick,
  children,
}: {
  id: string;
  busy: string | null;
  variant: ButtonVariant;
  icon: LucideIcon;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant={variant}
      icon={icon}
      loading={busy === id}
      disabled={busy !== null && busy !== id}
      onClick={onClick}
      className="w-full sm:w-auto"
    >
      {children}
    </Button>
  );
}
