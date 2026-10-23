"use client";

import { useState } from "react";
import { Building2, Check, FileText, IdCard, RotateCcw, ShieldAlert, ShieldOff, X } from "lucide-react";
import { ApiError } from "../lib/api";
import { useDebounced, useMutation, usePagedList } from "../lib/hooks";
import { useApi, useSession } from "../lib/session";
import { useFeedback } from "../lib/feedback";
import { formatDate, formatDateTime, timeAgo } from "../lib/format";
import { API_BASE_URL } from "../config/constants";
import { isTrustedDocumentUrl, openDocument } from "../utils/documents";
import type { NgoVerification, VerificationStatus } from "../types/admin";
import { useConsole } from "../components/shell/ConsoleContext";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Panel,
  SearchInput,
  Segmented,
  Skeleton,
  Toolbar,
} from "../components/ui/primitives";
import { PersonLink, VerificationBadge } from "../components/common/bits";

type DocKind = "registration" | "identity";

/**
 * Documents opened in this browser session, keyed by request and URL so a
 * resubmitted document has to be opened again. Module-level so switching
 * screens and coming back does not forget what was already checked.
 */
const openedDocs = new Set<string>();
const docKey = (row: NgoVerification, kind: DocKind) =>
  `${row.id}|${kind}|${kind === "registration" ? row.registrationDocs : row.identityProof}`;

const EMPTY: Record<VerificationStatus, { title: string; body: string }> = {
  PENDING: {
    title: "No requests waiting",
    body: "When an organisation applies to publish drives, its request appears here for review.",
  },
  APPROVED: { title: "No verified NGOs", body: "Approved organisations are listed here." },
  REJECTED: { title: "No rejected requests", body: "Rejected and revoked organisations are listed here." },
};

export default function NgosView() {
  const api = useApi();
  const { token } = useSession();
  const { toast, confirm } = useFeedback();
  const { stats, refreshStats } = useConsole();
  const [status, setStatus] = useState<VerificationStatus>("PENDING");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);
  const [run, busy] = useMutation();
  const [, setOpenedVersion] = useState(0);

  const list = usePagedList<NgoVerification>("/ngos", { status, q: q || undefined });

  const isOpened = (row: NgoVerification, kind: DocKind) => openedDocs.has(docKey(row, kind));
  const bothOpened = (row: NgoVerification) => isOpened(row, "registration") && isOpened(row, "identity");

  // Called straight from the click: openDocument opens the tab synchronously.
  const openDoc = (row: NgoVerification, kind: DocKind) => {
    if (!token) return;
    const url = kind === "registration" ? row.registrationDocs : row.identityProof;
    void openDocument(token, url, API_BASE_URL).then(result => {
      if (result.ok) {
        openedDocs.add(docKey(row, kind));
        setOpenedVersion(n => n + 1);
        if (result.mode === "download") {
          toast({ tone: "info", title: "Document downloaded", description: "This file type cannot be previewed in the browser." });
        }
      } else {
        toast({ tone: "error", title: "Could not open the document", description: result.message });
      }
    });
  };

  const decide = async (row: NgoVerification, next: VerificationStatus) => {
    const org = row.ngoName;
    const person = row.user.fullName;
    const wasApproved = row.status === "APPROVED";

    const r =
      next === "APPROVED"
        ? await confirm({
            title: row.status === "REJECTED" ? `Re-approve ${org}?` : `Approve ${org}?`,
            tone: "positive",
            confirmLabel: "Approve and verify",
            body: (
              <>
                <p>
                  {person} becomes an organizer and can publish drives straight away. Volunteers will see {org} as a
                  verified NGO.
                </p>
                <p>Approve only if the registration document and identity proof match the details given.</p>
              </>
            ),
            note: {
              label: "Message to the organisation",
              placeholder: "e.g. Welcome aboard. Your first drive can go live today.",
              hint: "Sent with the approval email.",
            },
          })
        : next === "REJECTED"
          ? await confirm({
              title: wasApproved ? `Revoke verification for ${org}?` : `Reject ${org}?`,
              tone: "danger",
              confirmLabel: wasApproved ? "Revoke verification" : "Reject request",
              body: wasApproved ? (
                <>
                  <p>{person} loses the organizer role straight away and can no longer publish or manage drives.</p>
                  <p>Every drive of theirs that has not finished is cancelled. Completed drives stay on record.</p>
                </>
              ) : (
                <p>
                  {person} stays a volunteer and cannot publish drives. They can submit updated documents from the app.
                </p>
              ),
              note: {
                label: "Reason, sent to the organisation",
                placeholder: wasApproved
                  ? "e.g. Registration was found to be invalid after a complaint."
                  : "e.g. The registration certificate is unreadable. Upload a clearer scan.",
                minLength: 10,
                hint: "Emailed and sent as a notification to the organisation, and kept in the audit log.",
              },
            })
          : await confirm({
              title: `Return ${org} to review?`,
              confirmLabel: "Return to review",
              body: (
                <p>
                  The request moves back to Pending so it can be checked again. {person}&rsquo;s role does not change,
                  and the organisation receives an email update.
                </p>
              ),
            });
    if (!r.confirmed) return;

    await run(row.id, async () => {
      try {
        await api(`/ngos/${row.id}/verify`, {
          method: "PATCH",
          body: r.note ? { status: next, note: r.note } : { status: next },
        });
        list.removeItem(row.id);
        refreshStats();
        toast({
          title:
            next === "APPROVED"
              ? `${org} is verified`
              : next === "REJECTED"
                ? wasApproved
                  ? `Verification revoked for ${org}`
                  : `${org} rejected`
                : `${org} returned to review`,
          description:
            next === "APPROVED"
              ? `${person} can now publish drives.`
              : next === "REJECTED"
                ? wasApproved
                  ? "Their unfinished drives were cancelled."
                  : "The reason was sent to the organisation."
                : undefined,
        });
      } catch (err) {
        toast({
          tone: "error",
          title: "Could not update the request",
          description: err instanceof ApiError ? err.message : undefined,
        });
      }
    });
  };

  return (
    <>
      <PageHeader
        title="NGO approvals"
        description="Only organisations approved here can publish drives. Open both documents and check they match the details before approving."
      />

      <Toolbar>
        <Segmented<VerificationStatus>
          label="Request status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "PENDING", label: "Pending", count: stats?.ngos.pending },
            { value: "APPROVED", label: "Verified" },
            { value: "REJECTED", label: "Rejected" },
          ]}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search organisation, person or details"
          label="Search NGO requests by organisation, applicant name, email or contact details"
        />
      </Toolbar>

      <Panel bodyClassName="p-0">
        {list.state === "loading" && list.items.length === 0 ? (
          <div role="status" aria-label="Loading NGO requests" className="divide-y divide-line-soft">
            {[0, 1, 2].map(i => (
              <div key={i} className="space-y-3 px-5 py-5">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-9 w-2/3" />
              </div>
            ))}
          </div>
        ) : list.state === "error" && list.items.length === 0 ? (
          <ErrorState message={list.error ?? "Could not load NGO requests."} onRetry={list.reload} />
        ) : list.items.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={q ? "No requests match" : EMPTY[status].title}
            body={q ? "Try a different search." : EMPTY[status].body}
          />
        ) : (
          <>
            <ul className="divide-y divide-line-soft" aria-label="NGO verification requests">
              {list.items.map(row => (
                <RequestCard
                  key={row.id}
                  row={row}
                  busy={busy === row.id}
                  opened={kind => isOpened(row, kind)}
                  bothOpened={bothOpened(row)}
                  onOpen={kind => openDoc(row, kind)}
                  onDecide={next => decide(row, next)}
                />
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3 text-meta text-ink-3">
              <span className="tabular">
                Showing {list.items.length.toLocaleString("en-IN")}
                {list.hasMore ? " so far" : list.items.length === 1 ? " request" : " requests"}
              </span>
              {list.hasMore ? (
                <Button size="sm" onClick={list.loadMore} loading={list.loadingMore}>
                  Load more
                </Button>
              ) : null}
              {list.state === "error" && list.error ? <span className="text-danger">{list.error}</span> : null}
            </div>
          </>
        )}
      </Panel>
    </>
  );
}

function RequestCard({
  row,
  busy,
  opened,
  bothOpened,
  onOpen,
  onDecide,
}: {
  row: NgoVerification;
  busy: boolean;
  opened: (kind: DocKind) => boolean;
  bothOpened: boolean;
  onOpen: (kind: DocKind) => void;
  onDecide: (next: VerificationStatus) => void;
}) {
  const hintId = `ngo-${row.id}-hint`;
  const needsDocs = row.status !== "APPROVED";
  const unsafeDocs =
    !isTrustedDocumentUrl(row.registrationDocs, API_BASE_URL) || !isTrustedDocumentUrl(row.identityProof, API_BASE_URL);

  const when =
    row.status === "APPROVED"
      ? `Verified ${formatDate(row.verifiedAt ?? row.updatedAt)}`
      : row.status === "REJECTED"
        ? `Rejected ${formatDate(row.updatedAt)}`
        : `Submitted ${timeAgo(row.createdAt)}`;

  return (
    <li className="px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold text-forest">{row.ngoName}</h3>
          <p className="mt-0.5 text-meta text-ink-3">
            <span title={formatDateTime(row.status === "PENDING" ? row.createdAt : row.updatedAt)}>{when}</span>
            {row.status === "PENDING" && row.updatedAt !== row.createdAt ? ` · last updated ${timeAgo(row.updatedAt)}` : ""}
          </p>
        </div>
        <VerificationBadge status={row.status} />
      </div>

      <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-label font-semibold uppercase tracking-[0.04em] text-ink-3">Applicant</p>
          <div className="mt-1.5 flex items-start gap-3">
            <Avatar name={row.user.fullName} size="sm" />
            <div className="min-w-0 text-row">
              <PersonLink id={row.id} name={row.user.fullName} secondary={row.user.email} className="block min-w-0" />
              {row.user.phoneNumber ? <span className="block text-meta text-ink-3">{row.user.phoneNumber}</span> : null}
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-label font-semibold uppercase tracking-[0.04em] text-ink-3">Registration / contact details</p>
          <p className="mt-1.5 whitespace-pre-line break-words text-row text-ink">{row.contactDetails || "None given"}</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-label font-semibold uppercase tracking-[0.04em] text-ink-3">Documents</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          <DocButton
            label="Registration document"
            icon={FileText}
            url={row.registrationDocs}
            opened={opened("registration")}
            onOpen={() => onOpen("registration")}
          />
          <DocButton
            label="Identity proof"
            icon={IdCard}
            url={row.identityProof}
            opened={opened("identity")}
            onOpen={() => onOpen("identity")}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
        {row.status === "APPROVED" ? (
          <Button variant="danger-quiet" icon={ShieldOff} loading={busy} onClick={() => onDecide("REJECTED")}>
            Revoke verification
          </Button>
        ) : (
          <>
            <Button
              variant="positive"
              icon={Check}
              loading={busy}
              disabled={!bothOpened}
              aria-describedby={!bothOpened ? hintId : undefined}
              onClick={() => onDecide("APPROVED")}
            >
              {row.status === "REJECTED" ? "Re-approve" : "Approve"}
            </Button>
            {row.status === "PENDING" ? (
              <Button variant="danger-quiet" icon={X} disabled={busy} onClick={() => onDecide("REJECTED")}>
                Reject
              </Button>
            ) : (
              <Button variant="ghost" icon={RotateCcw} disabled={busy} onClick={() => onDecide("PENDING")}>
                Return to review
              </Button>
            )}
            {needsDocs && !bothOpened ? (
              <p id={hintId} className="basis-full text-meta text-ink-3 sm:basis-auto">
                {unsafeDocs
                  ? "A document cannot be opened safely, so this request cannot be approved until the organisation uploads it again."
                  : "Open both documents to enable approval."}
              </p>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

function DocButton({
  label,
  icon,
  url,
  opened,
  onOpen,
}: {
  label: string;
  icon: typeof FileText;
  url: string;
  opened: boolean;
  onOpen: () => void;
}) {
  const trusted = isTrustedDocumentUrl(url, API_BASE_URL);
  if (!trusted) {
    return (
      <span className="inline-flex items-center gap-1.5 text-meta text-ink-2">
        <ShieldAlert aria-hidden className="size-4 text-danger" />
        {label}: not a Voluntree upload, so it is not opened
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" icon={icon} onClick={onOpen}>
        {label}
      </Button>
      {opened ? (
        <Badge tone="success" icon={Check}>
          Opened
        </Badge>
      ) : (
        <span className="text-label text-ink-3">Not opened yet</span>
      )}
    </span>
  );
}
