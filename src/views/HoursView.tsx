"use client";

import { useState } from "react";
import { Clock, Download, FileText, ShieldCheck, Square, X } from "lucide-react";
import { ApiError } from "../lib/api";
import { useDebounced, useMutation, usePagedList } from "../lib/hooks";
import { useApi, useSession } from "../lib/session";
import { useFeedback } from "../lib/feedback";
import { formatDateTime, hours, plural } from "../lib/format";
import { exportToCsv } from "../utils/csvExporter";
import { API_BASE_URL } from "../config/constants";
import type { AttendanceRow } from "../types/admin";
import { useConsole } from "../components/shell/ConsoleContext";
import { DataTable, type Column } from "../components/ui/DataTable";
import { Badge, Button, PageHeader, Panel, SearchInput, Segmented, Toolbar } from "../components/ui/primitives";
import { PersonLink } from "../components/common/bits";

type SessionFilter = "OPEN" | "DONE" | "ALL";

type ClosedSession = AttendanceRow & { pointsAwarded?: number };

/** Safe file-name fragment from a person's or drive's name. */
function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "session"
  );
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join(". ");
    if (typeof msg === "string" && msg) return msg;
  } catch {
    // Not JSON.
  }
  return `Request failed (HTTP ${res.status}).`;
}

export default function HoursView() {
  const api = useApi();
  const { token } = useSession();
  const { toast, confirm } = useFeedback();
  const { stats, refreshStats, openEvent, params } = useConsole();
  const [filter, setFilter] = useState<SessionFilter>("OPEN");
  const [search, setSearch] = useState("");
  const [eventId, setEventId] = useState(() => params.get("eventId") ?? "");
  const q = useDebounced(search.trim(), 300);

  // go("hours", { eventId }) while already here changes params without a remount.
  const [seenParams, setSeenParams] = useState(params);
  if (params !== seenParams) {
    setSeenParams(params);
    setEventId(params.get("eventId") ?? "");
  }
  const [run, busy] = useMutation();

  const list = usePagedList<AttendanceRow>("/attendance/admin/all", {
    q: q || undefined,
    eventId: eventId || undefined,
    open: filter === "ALL" ? undefined : filter === "OPEN",
  });

  const close = async (row: AttendanceRow) => {
    const r = await confirm({
      title: `Close ${row.volunteer.fullName}'s session?`,
      confirmLabel: "Close session",
      body: (
        <>
          <p>
            Checked in to {row.event.title} at {formatDateTime(row.checkIn)}.
          </p>
          <p>
            The check-out is recorded now, or at the drive&apos;s end time if the drive has already finished, so hours
            never run past the drive. Reputation points are awarded as for a normal check-out.
          </p>
          <p>Open sessions also close on their own 2 h after a drive ends, so you only need this to settle one sooner.</p>
        </>
      ),
    });
    if (!r.confirmed) return;

    await run(row.id, async () => {
      try {
        const closed = await api<ClosedSession>(`/attendance/${row.id}/close`, { method: "PATCH" });
        list.updateItem(row.id, { checkOut: closed.checkOut, hoursLogged: closed.hoursLogged });
        refreshStats();
        toast({
          title: "Session closed",
          description: `${row.volunteer.fullName} · ${hours(closed.hoursLogged)} logged${
            closed.pointsAwarded ? ` · ${plural(closed.pointsAwarded, "reputation point")}` : ""
          }`,
        });
      } catch (err) {
        toast({ tone: "error", title: "Could not close the session", description: err instanceof ApiError ? err.message : undefined });
      }
    });
  };

  const certificate = async (row: AttendanceRow) => {
    await run(`cert:${row.id}`, async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/attendance/certificate/${row.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) throw new Error(await readError(res));
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `certificate_${slug(row.volunteer.fullName)}_${slug(row.event.title)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
        toast({ title: "Certificate downloaded", description: `${row.volunteer.fullName} · ${row.event.title}` });
      } catch (err) {
        toast({
          tone: "error",
          title: "Could not download the certificate",
          description: err instanceof Error ? err.message : undefined,
        });
      }
    });
  };

  const columns: Column<AttendanceRow>[] = [
    {
      key: "volunteer",
      header: "Volunteer",
      primary: true,
      cell: a => <PersonLink id={a.volunteerId} name={a.volunteer.fullName} secondary={a.volunteer.email} />,
    },
    {
      key: "drive",
      header: "Drive",
      cell: a => (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            openEvent(a.eventId);
          }}
          className="rounded-sm text-left text-forest underline decoration-forest/30 underline-offset-[3px] hover:decoration-forest"
        >
          {a.event.title}
        </button>
      ),
    },
    {
      key: "in",
      header: "Checked in",
      cell: a => (
        <span className="text-meta text-ink-2">
          {formatDateTime(a.checkIn)}
          {/* Tablet table only: the check-out column is hidden below xl. */}
          <span className="hidden text-ink-3 md:block xl:hidden">
            {a.checkOut ? `Out ${formatDateTime(a.checkOut)}` : "Still checked in"}
          </span>
        </span>
      ),
    },
    {
      key: "out",
      header: "Checked out",
      className: "hidden xl:table-cell",
      cell: a =>
        a.checkOut ? (
          <span className="text-meta text-ink-2">{formatDateTime(a.checkOut)}</span>
        ) : (
          <Badge tone="outline" icon={Clock}>
            Still checked in
          </Badge>
        ),
    },
    {
      key: "hours",
      header: "Hours",
      align: "right",
      cell: a =>
        a.checkOut ? (
          <span className="tabular font-semibold">{hours(a.hoursLogged)}</span>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    {
      key: "verified",
      header: "Check-out",
      hideOnMobile: true,
      className: "hidden xl:table-cell",
      cell: a =>
        a.verifiedByOrganizer ? (
          <Badge tone="success" icon={ShieldCheck} title="The organizer scanned this volunteer out">
            Organizer scan
          </Badge>
        ) : a.checkOut ? (
          <Badge tone="neutral" title="Closed automatically after the drive or by an admin">
            Closed without scan
          </Badge>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
  ];

  const driveTitle = eventId ? list.items.find(a => a.eventId === eventId)?.event.title : undefined;

  return (
    <>
      <PageHeader
        title="Volunteer hours"
        description="Every QR check-in and check-out. Close a session someone forgot to check out of, or download a volunteer's certificate."
        actions={
          <Button
            icon={Download}
            disabled={list.items.length === 0}
            onClick={() =>
              exportToCsv(
                "voluntree_hours",
                ["Volunteer", "Email", "Drive", "Category", "Checked in", "Checked out", "Hours", "Organizer scan"],
                list.items.map(a => [
                  a.volunteer.fullName,
                  a.volunteer.email,
                  a.event.title,
                  a.event.category,
                  formatDateTime(a.checkIn),
                  a.checkOut ? formatDateTime(a.checkOut) : "Still checked in",
                  a.checkOut ? Math.round(Number(a.hoursLogged ?? 0) * 100) / 100 : "",
                  a.verifiedByOrganizer ? "Yes" : "No",
                ])
              )
            }
          >
            Export loaded rows
          </Button>
        }
      />

      <Toolbar>
        <Segmented<SessionFilter>
          label="Session status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "OPEN", label: "Open now" },
            { value: "DONE", label: "Completed", count: stats?.attendance.completedSessions },
            { value: "ALL", label: "All" },
          ]}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by volunteer or drive"
          label="Search sessions"
        />
        {eventId ? (
          <span className="inline-flex h-8 max-w-full items-center gap-2 rounded-full pl-3 pr-1 text-meta font-semibold text-ink-2 ring-1 ring-inset ring-line">
            <span className="truncate">{driveTitle ? `Drive: ${driveTitle}` : "One drive only"}</span>
            <button
              type="button"
              aria-label="Show every drive"
              onClick={() => setEventId("")}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-sunken hover:text-ink"
            >
              <X aria-hidden className="size-4" />
            </button>
          </span>
        ) : null}
      </Toolbar>

      <Panel bodyClassName="p-0">
        <DataTable
          caption="Check-in sessions"
          columns={columns}
          rows={list.items}
          rowKey={a => a.id}
          state={list.state}
          error={list.error}
          onRetry={list.reload}
          hasMore={list.hasMore}
          loadingMore={list.loadingMore}
          onLoadMore={list.loadMore}
          empty={{
            icon: Clock,
            title:
              filter === "OPEN" && !q && !eventId
                ? "No one is checked in right now"
                : q || eventId
                  ? "No sessions match"
                  : "No sessions here",
            body:
              filter === "OPEN" && !q && !eventId
                ? "Volunteers appear here from the moment an organizer scans them in until they are scanned out."
                : "Try another name or drive, or another status.",
          }}
          actions={a =>
            a.checkOut ? (
              <Button
                size="sm"
                variant="ghost"
                icon={FileText}
                loading={busy === `cert:${a.id}`}
                onClick={() => certificate(a)}
                aria-label={`Download certificate for ${a.volunteer.fullName}, ${a.event.title}`}
              >
                Certificate
              </Button>
            ) : (
              <Button
                size="sm"
                icon={Square}
                loading={busy === a.id}
                onClick={() => close(a)}
                aria-label={`Close ${a.volunteer.fullName}'s session at ${a.event.title}`}
              >
                Close session
              </Button>
            )
          }
        />
      </Panel>
    </>
  );
}
