"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Download, ShieldAlert, X } from "lucide-react";
import { useDebounced, usePagedList, useResource } from "../lib/hooks";
import { formatDate, formatDateTime, formatTime, hours, humanize, plural } from "../lib/format";
import { exportToCsv } from "../utils/csvExporter";
import { ALL_EVENT_STATUSES } from "../utils/eventStatus";
import type { AdminEvent, EventStatus } from "../types/admin";
import { useConsole } from "../components/shell/ConsoleContext";
import { DataTable, type Column } from "../components/ui/DataTable";
import { Badge, Button, PageHeader, Panel, SearchInput, Select, Toolbar } from "../components/ui/primitives";
import { EventStatusBadge, eventStatusLabel } from "../components/common/bits";

/** Fired by the drive drawer after any change, so this list re-reads. */
const EVENTS_CHANGED = "voluntree:events-changed";

export default function DrivesView() {
  const { openEvent, params } = useConsole();

  // Arrival params (e.g. go("drives", { organizerId })) are read once.
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [status, setStatus] = useState<EventStatus | "">(() => {
    const s = params.get("status") as EventStatus | null;
    return s && ALL_EVENT_STATUSES.includes(s) ? s : "";
  });
  const [category, setCategory] = useState(() => params.get("category") ?? "");
  const [organizerId, setOrganizerId] = useState(() => params.get("organizerId") ?? "");
  const q = useDebounced(search.trim(), 300);

  const categories = useResource<{ data: string[] }>("/events/categories");

  const list = usePagedList<AdminEvent>("/events/admin/all", {
    q: q || undefined,
    status: status || undefined,
    category: category || undefined,
    organizerId: organizerId || undefined,
  });
  const { reload } = list;

  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener(EVENTS_CHANGED, onChange);
    return () => window.removeEventListener(EVENTS_CHANGED, onChange);
  }, [reload]);

  const filtered = Boolean(q || status || category || organizerId);
  const organizerName = organizerId ? list.items.find(e => e.organizerId === organizerId)?.organizer.fullName : undefined;

  const columns: Column<AdminEvent>[] = [
    {
      key: "drive",
      header: "Drive",
      primary: true,
      cell: e => (
        <span className="block min-w-0 max-w-[22rem]">
          <span className="block font-semibold text-forest">{e.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-2">
            <span className="truncate">{e.organizer.fullName}</span>
            {!e.isOrganizerVerified ? (
              <Badge tone="outline" icon={ShieldAlert} title="This organizer's NGO verification is not approved">
                Organizer not verified
              </Badge>
            ) : null}
          </span>
        </span>
      ),
    },
    {
      key: "date",
      header: "Starts",
      cell: e => (
        <span className="whitespace-nowrap text-meta text-ink-2">
          {formatDate(e.startTime)}
          <span className="block text-ink-3">{formatTime(e.startTime)}</span>
        </span>
      ),
    },
    { key: "status", header: "Status", cell: e => <EventStatusBadge status={e.status} /> },
    {
      key: "fill",
      header: "Filled",
      cell: e => (
        <span className="tabular whitespace-nowrap text-meta">
          {e.approvedCount.toLocaleString("en-IN")} of {plural(e.volunteersNeeded, "place")}
        </span>
      ),
    },
    {
      key: "applications",
      header: "Applications",
      align: "right",
      // The table only has room for every column on wide screens; phones get cards.
      className: "hidden lg:table-cell",
      cell: e => <span className="tabular">{e.applicationCount.toLocaleString("en-IN")}</span>,
    },
    {
      key: "hours",
      header: "Hours logged",
      align: "right",
      hideOnMobile: true,
      className: "hidden xl:table-cell",
      cell: e => <span className="tabular">{hours(e.hoursLoggedTotal)}</span>,
    },
  ];

  const exportRows = () =>
    exportToCsv(
      "voluntree_drives",
      [
        "Title",
        "Organizer",
        "Organizer email",
        "Organizer verified",
        "Category",
        "Status",
        "Starts",
        "Ends",
        "Location",
        "Places",
        "Approved",
        "Applications",
        "Check-ins",
        "Hours logged",
      ],
      list.items.map(e => [
        e.title,
        e.organizer.fullName,
        e.organizer.email ?? "",
        e.isOrganizerVerified ? "Yes" : "No",
        e.category,
        eventStatusLabel(e.status),
        formatDateTime(e.startTime),
        formatDateTime(e.endTime),
        e.isOnline ? "Online" : e.address,
        e.volunteersNeeded,
        e.approvedCount,
        e.applicationCount,
        e.attendanceCount,
        Math.round(e.hoursLoggedTotal * 10) / 10,
      ])
    );

  return (
    <>
      <PageHeader
        title="Drives"
        description="Every drive in every status, newest first. Open a drive to review its volunteers, edit details, feature, suspend or cancel it."
        actions={
          <Button icon={Download} disabled={list.items.length === 0} onClick={exportRows}>
            Export loaded rows
          </Button>
        }
      />

      <Toolbar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search title, place or organizer"
          label="Search drives by title, place, organizer name or email"
        />
        <Select
          aria-label="Drive status"
          value={status}
          onChange={e => setStatus(e.target.value as EventStatus | "")}
          className="w-full sm:w-48"
        >
          <option value="">All statuses</option>
          {ALL_EVENT_STATUSES.map(s => (
            <option key={s} value={s}>
              {eventStatusLabel(s)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Drive category"
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full sm:w-56"
        >
          <option value="">All categories</option>
          {(categories.data?.data ?? []).map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          {category && categories.data && !categories.data.data.includes(category) ? (
            <option value={category}>{humanize(category)}</option>
          ) : null}
        </Select>
        {organizerId ? (
          <Badge tone="info" className="py-1 pr-1">
            Drives by {organizerName ?? "one organizer"}
            <button
              type="button"
              onClick={() => setOrganizerId("")}
              aria-label="Show drives by every organizer"
              className="inline-flex size-5 items-center justify-center rounded-full hover:bg-forest/10"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </Badge>
        ) : null}
      </Toolbar>

      <Panel bodyClassName="p-0">
        <DataTable
          caption="Drives"
          columns={columns}
          rows={list.items}
          rowKey={e => e.id}
          state={list.state}
          error={list.error}
          onRetry={list.reload}
          onRowClick={e => openEvent(e.id, e)}
          hasMore={list.hasMore}
          loadingMore={list.loadingMore}
          onLoadMore={list.loadMore}
          empty={{
            icon: CalendarDays,
            title: filtered ? "No drives match" : "No drives yet",
            body: filtered
              ? "Try a different search, status or category."
              : "Drives appear here as soon as a verified organizer publishes one.",
            action: filtered ? (
              <Button
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setCategory("");
                  setOrganizerId("");
                }}
              >
                Clear filters
              </Button>
            ) : undefined,
          }}
        />
      </Panel>
    </>
  );
}
