"use client";

import { useEffect, useState } from "react";
import { Ban, Download, RotateCcw, ShieldAlert, Users } from "lucide-react";
import { useDebounced, usePagedList } from "../lib/hooks";
import { formatDate, formatDateTime, humanize, timeAgo } from "../lib/format";
import { exportToCsv } from "../utils/csvExporter";
import type { UserRole, UserRow } from "../types/admin";
import { useConsole } from "../components/shell/ConsoleContext";
import { DataTable, type Column } from "../components/ui/DataTable";
import { Avatar, Badge, Button, PageHeader, Panel, SearchInput, Segmented, Toolbar } from "../components/ui/primitives";
import { BannedBadge, MinorBadge, RoleBadge } from "../components/common/bits";
import { USERS_CHANGED_EVENT, useAccountActions } from "../components/inspectors/UserDrawer";

type RoleFilter = UserRole | "ALL";
type StatusFilter = "ALL" | "BANNED";

const ROLES: RoleFilter[] = ["ALL", "VOLUNTEER", "ORGANIZER", "ADMIN"];

/** Whole years from a date of birth, or null when none is recorded. */
function ageFrom(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export default function PeopleView() {
  const { stats, openUser, params } = useConsole();
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [role, setRole] = useState<RoleFilter>(() => {
    const r = params.get("role") as RoleFilter | null;
    return r && ROLES.includes(r) ? r : "ALL";
  });
  const [status, setStatus] = useState<StatusFilter>(() => (params.get("banned") === "true" ? "BANNED" : "ALL"));
  const q = useDebounced(search.trim(), 300);

  const list = usePagedList<UserRow>("/auth/users", {
    q: q || undefined,
    role: role === "ALL" ? undefined : role,
    banned: status === "BANNED" ? "true" : undefined,
  });
  const { updateItem, reload } = list;

  const actions = useAccountActions((id, isBanned) => updateItem(id, { isBanned }));

  // A suspend or reinstate from the person drawer (or an Undo) re-reads the list.
  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener(USERS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(USERS_CHANGED_EVENT, onChange);
  }, [reload]);

  const columns: Column<UserRow>[] = [
    {
      key: "person",
      header: "Person",
      primary: true,
      cell: u => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={u.fullName} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-forest">{u.fullName}</span>
              <span className="xl:hidden">
                <RoleBadge role={u.userType} />
              </span>
              {u.isBanned ? <BannedBadge /> : null}
            </span>
            <span className="block max-w-[14rem] truncate text-meta text-ink-3" title={u.email}>
              {u.email}
            </span>
          </span>
        </span>
      ),
    },
    // Below xl the role sits next to the name so the table fits beside the sidebar.
    { key: "role", header: "Role", hideOnMobile: true, className: "hidden xl:table-cell", cell: u => <RoleBadge role={u.userType} /> },
    {
      key: "age",
      header: "Age",
      cell: u => {
        const age = ageFrom(u.dateOfBirth);
        if (age === null) return <span className="text-ink-3">—</span>;
        return age < 18 ? <MinorBadge age={age} /> : <span className="tabular">{age}</span>;
      },
    },
    {
      key: "reports",
      header: "Open reports",
      align: "right",
      cell: u => {
        const n = u._count.reportsAgainst;
        return n > 0 ? (
          <Badge tone="info" icon={ShieldAlert} title={`${n} open ${n === 1 ? "report" : "reports"} about this person`}>
            {n.toLocaleString("en-IN")} open
          </Badge>
        ) : (
          <span className="tabular text-ink-3">0</span>
        );
      },
    },
    {
      key: "reputation",
      header: "Reputation",
      align: "right",
      hideOnMobile: true,
      className: "hidden 2xl:table-cell",
      cell: u =>
        u.profile ? (
          <span className="tabular" title={humanize(u.profile.reputationLevel)}>
            {u.profile.reputationScore.toLocaleString("en-IN")}
          </span>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    {
      key: "joined",
      header: "Joined",
      hideOnMobile: true,
      className: "hidden 2xl:table-cell",
      cell: u => <span className="text-meta text-ink-2">{formatDate(u.createdAt)}</span>,
    },
    {
      key: "seen",
      header: "Last seen",
      className: "hidden xl:table-cell",
      cell: u => (
        <span className="text-meta text-ink-2" title={formatDateTime(u.lastSeen)}>
          {timeAgo(u.lastSeen)}
        </span>
      ),
    },
  ];

  const filtered = Boolean(q) || role !== "ALL" || status !== "ALL";

  return (
    <>
      <PageHeader
        title="People"
        description="Every volunteer, organizer and admin. Open a person to see their activity, reports about them and admin history."
        actions={
          <Button
            icon={Download}
            disabled={list.items.length === 0}
            onClick={() =>
              exportToCsv(
                "voluntree_people",
                ["Name", "Email", "Role", "Age", "Under 18", "Suspended", "Open reports", "Reputation", "Level", "Joined", "Last seen"],
                list.items.map(u => {
                  const age = ageFrom(u.dateOfBirth);
                  return [
                    u.fullName,
                    u.email,
                    humanize(u.userType),
                    age ?? "",
                    age !== null && age < 18 ? "Yes" : "No",
                    u.isBanned ? "Yes" : "No",
                    u._count.reportsAgainst,
                    u.profile?.reputationScore ?? "",
                    u.profile ? humanize(u.profile.reputationLevel) : "",
                    formatDate(u.createdAt),
                    formatDateTime(u.lastSeen),
                  ];
                })
              )
            }
          >
            Export loaded rows
          </Button>
        }
      />

      <Toolbar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, email or phone"
          label="Search people"
        />
        <Segmented<RoleFilter>
          label="Role"
          value={role}
          onChange={setRole}
          options={[
            { value: "ALL", label: "All", count: stats?.users.total },
            { value: "VOLUNTEER", label: "Volunteers", count: stats?.users.volunteers },
            { value: "ORGANIZER", label: "Organizers", count: stats?.users.organizers },
            { value: "ADMIN", label: "Admins", count: stats?.users.admins },
          ]}
        />
        <Segmented<StatusFilter>
          label="Account status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "ALL", label: "Any status" },
            { value: "BANNED", label: "Suspended", count: stats?.users.banned },
          ]}
        />
      </Toolbar>

      <Panel bodyClassName="p-0">
        <DataTable
          caption="People"
          columns={columns}
          rows={list.items}
          rowKey={u => u.id}
          state={list.state}
          error={list.error}
          onRetry={list.reload}
          onRowClick={u => openUser(u.id)}
          hasMore={list.hasMore}
          loadingMore={list.loadingMore}
          onLoadMore={list.loadMore}
          empty={{
            icon: Users,
            title: filtered ? "No one matches" : "No one has joined yet",
            body: filtered
              ? status === "BANNED" && !q && role === "ALL"
                ? "No accounts are suspended."
                : "Try another name or email, or clear the filters."
              : undefined,
          }}
          actions={u => {
            if (actions.blockedReason(u)) return null;
            const target = {
              id: u.id,
              fullName: u.fullName,
              email: u.email,
              userType: u.userType,
              isBanned: u.isBanned,
              isMinor: (() => {
                const age = ageFrom(u.dateOfBirth);
                return age !== null && age < 18;
              })(),
              openReports: u._count.reportsAgainst,
            };
            return u.isBanned ? (
              <Button
                size="sm"
                variant="ghost"
                icon={RotateCcw}
                loading={actions.busy === u.id}
                onClick={() => actions.reinstate(target)}
                aria-label={`Reinstate ${u.fullName}`}
                title={`Reinstate ${u.fullName}`}
              >
                <span className="md:max-lg:sr-only">Reinstate</span>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                icon={Ban}
                loading={actions.busy === u.id}
                onClick={() => actions.suspend(target)}
                aria-label={`Suspend ${u.fullName}`}
                title={`Suspend ${u.fullName}`}
                className="text-ink-2 hover:text-forest"
              >
                <span className="md:max-lg:sr-only">Suspend</span>
              </Button>
            );
          }}
        />
      </Panel>
    </>
  );
}
