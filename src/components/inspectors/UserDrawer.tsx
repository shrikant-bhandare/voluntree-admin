"use client";

import { useEffect, type ReactNode } from "react";
import { Ban, Building2, ExternalLink, RotateCcw, ShieldAlert } from "lucide-react";
import { ApiError } from "../../lib/api";
import { useMutation, useResource } from "../../lib/hooks";
import { useApi, useSession } from "../../lib/session";
import { useFeedback } from "../../lib/feedback";
import { formatDate, formatDateTime, hours, humanize, plural, timeAgo } from "../../lib/format";
import type { ApplicationStatus, UserDetail, UserRole } from "../../types/admin";
import { useConsole } from "../shell/ConsoleContext";
import { Drawer } from "../ui/Overlay";
import { Badge, Button, Details, ErrorState, SectionTitle, Skeleton } from "../ui/primitives";
import {
  ApplicationStatusBadge,
  BannedBadge,
  EventStatusBadge,
  MinorBadge,
  PersonLink,
  RoleBadge,
  VerificationBadge,
} from "../common/bits";
import { AuditEntry } from "../../views/AuditView";

/** Fired after a suspend/reinstate so every list of people can re-read. */
export const USERS_CHANGED_EVENT = "voluntree:users-changed";

/* ---------------------------------------------------- Suspend / reinstate */

export interface AccountTarget {
  id: string;
  fullName: string;
  email: string;
  userType: UserRole;
  isBanned: boolean;
  isMinor?: boolean;
  openReports?: number;
}

/**
 * Suspend and reinstate, shared by the People list and the person drawer so
 * both ask the same questions and record the same reason. A suspension needs
 * a written reason; the success toast offers Undo.
 */
export function useAccountActions(onChanged?: (id: string, isBanned: boolean) => void) {
  const api = useApi();
  const { admin } = useSession();
  const { toast, confirm } = useFeedback();
  const { refreshStats } = useConsole();
  const [run, busy] = useMutation();

  /** Why this account cannot be suspended from here, or null when it can. */
  const blockedReason = (t: Pick<AccountTarget, "id" | "userType">): string | null => {
    if (admin && t.id === admin.id) return "You cannot suspend your own account.";
    if (t.userType === "ADMIN") return "Administrator accounts cannot be suspended from the console.";
    return null;
  };

  const apply = async (t: AccountTarget, isBanned: boolean, reason: string) => {
    await api(`/auth/users/${t.id}/ban`, {
      method: "PATCH",
      body: { isBanned, reason: reason || undefined },
    });
    onChanged?.(t.id, isBanned);
    refreshStats();
    window.dispatchEvent(new CustomEvent(USERS_CHANGED_EVENT, { detail: { id: t.id, isBanned } }));
  };

  const undoSuspend = (t: AccountTarget) =>
    run(t.id, async () => {
      try {
        await apply(t, false, "Suspension undone straight after it was applied");
        toast({ title: "Suspension undone", description: `${t.fullName} can use Voluntree again.` });
      } catch (err) {
        toast({ tone: "error", title: "Could not undo the suspension", description: err instanceof ApiError ? err.message : undefined });
      }
    });

  const suspend = async (t: AccountTarget) => {
    const r = await confirm({
      title: `Suspend ${t.fullName}?`,
      tone: "danger",
      confirmLabel: "Suspend account",
      body: (
        <>
          <p>
            {t.email}
            {t.isMinor ? " · this person is under 18." : ""}
          </p>
          <p>
            They are signed out straight away and cannot sign in, send or receive messages until an admin reinstates
            them.
            {t.userType === "ORGANIZER" ? " Drives they organize stop appearing to volunteers." : ""} Nothing is
            deleted.
          </p>
          {t.openReports ? (
            <p>
              {plural(t.openReports, "open report")} about them stay open. Resolve them in Safety reports once you have
              acted.
            </p>
          ) : null}
        </>
      ),
      note: {
        label: "Reason for suspending",
        placeholder: "What happened, and which report or evidence this is based on",
        minLength: 5,
        hint: "Recorded in the audit log and on this person's admin history.",
      },
    });
    if (!r.confirmed) return;

    await run(t.id, async () => {
      try {
        await apply(t, true, r.note);
        toast({
          title: "Account suspended",
          description: t.fullName,
          action: { label: "Undo", onClick: () => void undoSuspend(t) },
        });
      } catch (err) {
        toast({ tone: "error", title: "Could not suspend the account", description: err instanceof ApiError ? err.message : undefined });
      }
    });
  };

  const reinstate = async (t: AccountTarget) => {
    const r = await confirm({
      title: `Reinstate ${t.fullName}?`,
      tone: "positive",
      confirmLabel: "Reinstate account",
      body: (
        <p>
          {t.email} can sign in, message and apply to drives again straight away.
          {t.userType === "ORGANIZER" ? " Their published drives become visible to volunteers again." : ""}
        </p>
      ),
      note: {
        label: "Reason for reinstating",
        placeholder: "e.g. appeal reviewed, report found to be mistaken",
        hint: "Recorded in the audit log.",
      },
    });
    if (!r.confirmed) return;

    await run(t.id, async () => {
      try {
        await apply(t, false, r.note);
        toast({ title: "Account reinstated", description: t.fullName });
      } catch (err) {
        toast({ tone: "error", title: "Could not reinstate the account", description: err instanceof ApiError ? err.message : undefined });
      }
    });
  };

  return { suspend, reinstate, busy, blockedReason };
}

/* ------------------------------------------------------------ Small parts */

function DriveLink({ id, title }: { id: string; title: string }) {
  const { openEvent } = useConsole();
  return (
    <button
      type="button"
      onClick={() => openEvent(id)}
      className="rounded-sm text-left font-semibold text-forest underline decoration-forest/30 underline-offset-[3px] hover:decoration-forest"
    >
      {title}
    </button>
  );
}

function Stat({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface px-4 py-3 ring-1 ring-line-soft">
      <dt className="text-label font-semibold uppercase tracking-[0.04em] text-ink-3">{label}</dt>
      <dd className="tabular mt-1 text-xl font-bold text-forest">{value}</dd>
      {detail ? <dd className="mt-0.5 text-meta text-ink-2">{detail}</dd> : null}
    </div>
  );
}

function RecordList({ children, empty }: { children: ReactNode[]; empty: string }) {
  if (children.length === 0) return <p className="text-meta text-ink-3">{empty}</p>;
  return (
    <ul className="divide-y divide-line-soft rounded-lg bg-surface ring-1 ring-line-soft">
      {children}
    </ul>
  );
}

function RecordItem({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 px-4 py-3">
      <div className="min-w-0 flex-1 text-row">{children}</div>
      {aside ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{aside}</div> : null}
    </li>
  );
}

const APP_ORDER: ApplicationStatus[] = ["PENDING", "UNDER_REVIEW", "APPROVED", "WAITLISTED", "REJECTED"];

const RESOLUTION_LABEL: Record<string, string> = {
  DISMISSED: "Dismissed",
  ACTION_TAKEN: "Action taken",
  BANNED_TARGET: "Suspended",
};

function DrawerSkeleton() {
  return (
    <div role="status" aria-label="Loading this person" aria-busy className="space-y-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-32" />
    </div>
  );
}

/* ------------------------------------------------------------------ Drawer */

export function UserDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { go } = useConsole();
  const detail = useResource<UserDetail>(`/admin/users/${userId}`);
  const { reload } = detail;
  const actions = useAccountActions();
  const u = detail.data && detail.data.id === userId ? detail.data : null;

  // Re-read after any suspend/reinstate, including an Undo from a toast.
  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener(USERS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(USERS_CHANGED_EVENT, onChange);
  }, [reload]);

  const target: AccountTarget | null = u
    ? {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        userType: u.userType,
        isBanned: u.isBanned,
        isMinor: u.isMinor,
        openReports: u.counts.reportsAgainstOpen,
      }
    : null;
  const blocked = target ? actions.blockedReason(target) : null;

  const footer = target ? (
    <>
      {blocked ? <p className="mr-auto text-meta text-ink-3">{blocked}</p> : null}
      {target.isBanned ? (
        <Button
          variant="positive"
          icon={RotateCcw}
          disabled={Boolean(blocked)}
          loading={actions.busy === target.id}
          onClick={() => actions.reinstate(target)}
        >
          Reinstate account
        </Button>
      ) : (
        <Button
          variant="danger"
          icon={Ban}
          disabled={Boolean(blocked)}
          loading={actions.busy === target.id}
          onClick={() => actions.suspend(target)}
        >
          Suspend account
        </Button>
      )}
    </>
  ) : undefined;

  let body: ReactNode;
  if (!u && detail.state === "error") {
    body = <ErrorState message={detail.error ?? "Could not load this person."} onRetry={reload} />;
  } else if (!u) {
    body = <DrawerSkeleton />;
  } else {
    const c = u.counts;
    const appTotal = Object.values(c.applications).reduce((sum, n) => sum + (n ?? 0), 0);
    const appBreakdown = APP_ORDER.filter(s => (c.applications[s] ?? 0) > 0)
      .map(s => `${(c.applications[s] ?? 0).toLocaleString("en-IN")} ${humanize(s).toLowerCase()}`)
      .join(" · ");
    const p = u.profile;

    body = (
      <>
        {detail.state === "error" ? (
          <p role="alert" className="mb-4 rounded-md bg-danger-soft px-3 py-2 text-meta text-danger-ink">
            Could not refresh: {detail.error}
          </p>
        ) : null}

        <SectionTitle>Details</SectionTitle>
        <Details
          items={[
            {
              label: "Email",
              value: (
                <a href={`mailto:${u.email}`} className="text-forest underline decoration-forest/30 underline-offset-[3px]">
                  {u.email}
                </a>
              ),
            },
            { label: "Phone", value: u.phoneNumber || <span className="text-ink-3">Not given</span> },
            {
              label: "Age",
              value:
                u.age != null ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {u.age} · born {formatDate(u.dateOfBirth)}
                    {u.isMinor ? <MinorBadge /> : null}
                  </span>
                ) : (
                  <span className="text-ink-3">Date of birth not recorded</span>
                ),
            },
            { label: "Joined", value: formatDate(u.createdAt) },
            {
              label: "Last seen",
              value: u.isOnline ? (
                <Badge tone="success">Online now</Badge>
              ) : (
                <span title={formatDateTime(u.lastSeen)}>{timeAgo(u.lastSeen)}</span>
              ),
            },
            {
              label: "Terms accepted",
              value: u.termsAcceptedAt ? (
                `${formatDate(u.termsAcceptedAt)}${u.termsVersion ? ` · version ${u.termsVersion}` : ""}`
              ) : (
                <span className="text-ink-3">Not recorded</span>
              ),
            },
            { label: "Location", value: p?.location || <span className="text-ink-3">Not given</span> },
            {
              label: "Emergency contact",
              value:
                p?.emergencyName || p?.emergencyContact ? (
                  [p.emergencyName, p.emergencyContact].filter(Boolean).join(" · ")
                ) : (
                  <span className="text-ink-3">Not given</span>
                ),
            },
            {
              label: "Reputation",
              value: p ? `${p.reputationScore.toLocaleString("en-IN")} points · ${humanize(p.reputationLevel)}` : "—",
            },
            { label: "Experience", value: p ? humanize(p.experienceLevel) : "—" },
          ]}
        />

        <SectionTitle>Activity</SectionTitle>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Hours logged" value={hours(c.hoursLogged)} />
          <Stat
            label="Sessions"
            value={c.sessionsCompleted.toLocaleString("en-IN")}
            detail={c.openSessions > 0 ? `${c.openSessions.toLocaleString("en-IN")} still open` : "completed"}
          />
          <Stat label="Applications" value={appTotal.toLocaleString("en-IN")} detail={appBreakdown || undefined} />
          <Stat label="Drives created" value={c.eventsCreated.toLocaleString("en-IN")} />
          <Stat
            label="Reports about them"
            value={c.reportsAgainstOpen.toLocaleString("en-IN")}
            detail={`open of ${c.reportsAgainstTotal.toLocaleString("en-IN")} total`}
          />
          <Stat label="Reports filed" value={c.reportsSubmitted.toLocaleString("en-IN")} />
          <Stat
            label="Blocked by"
            value={plural(c.blockedBy, "person", "people")}
            detail={`They block ${plural(c.blocking, "person", "people")}`}
          />
          <Stat
            label="Comments"
            value={c.comments.toLocaleString("en-IN")}
            detail={c.posts > 0 ? plural(c.posts, "photo post") : undefined}
          />
        </dl>

        {u.ngoVerification ? (
          <>
            <SectionTitle
              aside={
                <button
                  type="button"
                  onClick={() => go("ngos")}
                  className="inline-flex items-center gap-1 rounded-sm font-semibold text-forest underline decoration-forest/30 underline-offset-[3px]"
                >
                  NGO approvals
                </button>
              }
            >
              NGO verification
            </SectionTitle>
            <div className="rounded-lg bg-surface p-4 ring-1 ring-line-soft">
              <div className="flex flex-wrap items-center gap-2">
                <Building2 aria-hidden className="size-4 text-forest" />
                <span className="text-row font-semibold text-ink">{u.ngoVerification.ngoName}</span>
                <VerificationBadge status={u.ngoVerification.status} />
              </div>
              <p className="mt-2 whitespace-pre-line break-words text-meta text-ink-2">
                {u.ngoVerification.contactDetails}
              </p>
              <p className="mt-2 text-meta text-ink-3">
                Submitted {formatDate(u.ngoVerification.createdAt)}
                {u.ngoVerification.verifiedAt ? ` · verified ${formatDate(u.ngoVerification.verifiedAt)}` : ""}
              </p>
            </div>
          </>
        ) : null}

        <SectionTitle
          aside={
            <button
              type="button"
              onClick={() => go("reports", { targetUserId: u.id })}
              className="inline-flex items-center gap-1 rounded-sm font-semibold text-forest underline decoration-forest/30 underline-offset-[3px]"
            >
              <ShieldAlert aria-hidden className="size-4" />
              Open in Safety reports
            </button>
          }
        >
          Reports about this person
        </SectionTitle>
        <RecordList empty="No one has reported this person.">
          {u.reportsAgainst.map(r => (
            <RecordItem
              key={r.id}
              aside={
                r.resolved ? (
                  <Badge tone="neutral">
                    {r.resolutionAction ? RESOLUTION_LABEL[r.resolutionAction] ?? humanize(r.resolutionAction) : "Resolved"}
                  </Badge>
                ) : (
                  <Badge tone="outline">Open</Badge>
                )
              }
            >
              <p className="font-semibold text-ink">{humanize(r.category)}</p>
              <p className="mt-0.5 line-clamp-3 break-words text-meta text-ink-2">{r.reason}</p>
              <p className="mt-1 text-meta text-ink-3">
                By <PersonLink id={r.reporter.id} name={r.reporter.fullName} /> · {formatDate(r.createdAt)}
                {r.messageId ? " · about a message" : ""}
              </p>
            </RecordItem>
          ))}
        </RecordList>

        <SectionTitle aside={appTotal > u.recentApplications.length ? `Latest ${u.recentApplications.length}` : undefined}>
          Recent applications
        </SectionTitle>
        <RecordList empty="No applications yet.">
          {u.recentApplications.map(a => (
            <RecordItem key={a.id} aside={<ApplicationStatusBadge status={a.status} />}>
              <DriveLink id={a.event.id} title={a.event.title} />
              <p className="mt-0.5 text-meta text-ink-3">
                Applied {formatDate(a.createdAt)} · drive starts {formatDate(a.event.startTime)}
              </p>
            </RecordItem>
          ))}
        </RecordList>

        <SectionTitle>Recent attendance</SectionTitle>
        <RecordList empty="No check-ins yet.">
          {u.recentAttendance.map(a => (
            <RecordItem
              key={a.id}
              aside={
                a.checkOut ? (
                  <span className="tabular text-meta font-semibold text-ink">{hours(a.hoursLogged)}</span>
                ) : (
                  <Badge tone="outline">Still checked in</Badge>
                )
              }
            >
              <DriveLink id={a.event.id} title={a.event.title} />
              <p className="mt-0.5 text-meta text-ink-3">
                In {formatDateTime(a.checkIn)}
                {a.checkOut ? ` · out ${formatDateTime(a.checkOut)}` : ""}
              </p>
            </RecordItem>
          ))}
        </RecordList>

        {u.userType !== "VOLUNTEER" || u.recentEvents.length > 0 ? (
          <>
            <SectionTitle>Recent drives created</SectionTitle>
            <RecordList empty="No drives created.">
              {u.recentEvents.map(e => (
                <RecordItem key={e.id} aside={<EventStatusBadge status={e.status} />}>
                  <DriveLink id={e.id} title={e.title} />
                  <p className="mt-0.5 text-meta text-ink-3">Starts {formatDateTime(e.startTime)}</p>
                </RecordItem>
              ))}
            </RecordList>
          </>
        ) : null}

        <SectionTitle>Recent comments</SectionTitle>
        <RecordList empty="No comments.">
          {u.recentComments.map(cm => (
            <RecordItem key={cm.id}>
              <p className="line-clamp-3 whitespace-pre-line break-words text-ink">{cm.content}</p>
              <p className="mt-1 text-meta text-ink-3">
                On <DriveLink id={cm.post.event.id} title={cm.post.event.title} /> · {timeAgo(cm.createdAt)}
              </p>
            </RecordItem>
          ))}
        </RecordList>

        <SectionTitle>Admin history</SectionTitle>
        {u.adminHistory.length === 0 ? (
          <p className="text-meta text-ink-3">No admin has acted on this account.</p>
        ) : (
          <ol className="divide-y divide-line-soft rounded-lg bg-surface ring-1 ring-line-soft">
            {u.adminHistory.map(entry => (
              <AuditEntry key={entry.id} entry={entry} hideTargetFor={u.id} />
            ))}
          </ol>
        )}
        <p className="mt-2 flex items-center gap-1 text-meta text-ink-3">
          <ExternalLink aria-hidden className="size-3.5" />
          <button
            type="button"
            onClick={() => go("audit", { targetType: "USER", targetId: u.id })}
            className="rounded-sm font-semibold text-forest underline decoration-forest/30 underline-offset-[3px]"
          >
            Full audit log for this person
          </button>
        </p>
      </>
    );
  }

  return (
    <Drawer
      open
      onClose={onClose}
      size="lg"
      title={u ? u.fullName : detail.state === "error" ? "Person" : "Loading person…"}
      subtitle={u ? u.email : undefined}
      meta={
        u ? (
          <>
            <RoleBadge role={u.userType} />
            {u.isMinor ? <MinorBadge age={u.age} /> : null}
            {u.isBanned ? <BannedBadge /> : null}
            {u.counts.reportsAgainstOpen > 0 ? (
              <Badge tone="info" icon={ShieldAlert}>
                {plural(u.counts.reportsAgainstOpen, "open report")}
              </Badge>
            ) : null}
          </>
        ) : undefined
      }
      footer={footer}
    >
      {body}
    </Drawer>
  );
}
