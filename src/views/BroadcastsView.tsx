"use client";

import { useId, useState, type FormEvent } from "react";
import { Megaphone, Send, Sprout } from "lucide-react";
import { ApiError } from "../lib/api";
import { useMutation, usePagedList } from "../lib/hooks";
import { useApi, useSession } from "../lib/session";
import { useFeedback } from "../lib/feedback";
import { formatDateTime, plural } from "../lib/format";
import type { BroadcastRow } from "../types/admin";
import { useConsole } from "../components/shell/ConsoleContext";
import { DataTable, type Column } from "../components/ui/DataTable";
import { Button, Label, PageHeader, Panel, Segmented, TextArea, TextInput, cn } from "../components/ui/primitives";

type Audience = "ALL" | "VOLUNTEER" | "ORGANIZER";

const TITLE_MAX = 120;
const BODY_MAX = 500;
const MIN_LENGTH = 3;

const AUDIENCE_LABEL: Record<BroadcastRow["targetRole"], string> = {
  ALL: "Everyone",
  VOLUNTEER: "Volunteers",
  ORGANIZER: "Organizers",
  ADMIN: "Admins",
};

/** "12 / 120" under a field; darker near the limit, never red (it cannot be exceeded). */
function Counter({ id, length, max }: { id: string; length: number; max: number }) {
  return (
    <span id={id} className={cn("tabular text-label", length >= max * 0.9 ? "font-semibold text-ink" : "text-ink-3")}>
      {length.toLocaleString("en-IN")} / {max.toLocaleString("en-IN")}
      <span className="sr-only"> characters</span>
    </span>
  );
}

/** How the push lands on a phone. Text only; nothing here is sent. */
function NotificationPreview({ title, body }: { title: string; body: string }) {
  return (
    <figure className="m-0">
      <figcaption className="mb-2 text-meta font-semibold text-ink">Preview on a phone</figcaption>
      <div className="rounded-xl bg-sunken p-3 sm:p-4">
        <div className="rounded-lg bg-surface p-3.5 shadow-card ring-1 ring-line-soft">
          <div className="flex items-center gap-2 text-label text-ink-3">
            <span aria-hidden className="inline-flex size-5 items-center justify-center rounded-sm bg-forest text-white">
              <Sprout className="size-3.5" strokeWidth={2.25} />
            </span>
            <span className="font-semibold text-ink-2">Voluntree</span>
            <span aria-hidden>·</span>
            <span>now</span>
          </div>
          <p className={cn("mt-2 break-words text-meta font-semibold", title ? "text-ink" : "text-ink-3")}>
            {title || "Your title"}
          </p>
          <p className={cn("mt-0.5 line-clamp-4 break-words text-meta", body ? "text-ink-2" : "text-ink-3")}>
            {body || "Your message appears here."}
          </p>
        </div>
      </div>
      <p className="mt-2 text-label text-ink-3">
        Phones may shorten long messages until they are opened. The full text is always in the in-app notifications.
      </p>
    </figure>
  );
}

export default function BroadcastsView() {
  const api = useApi();
  const { admin } = useSession();
  const { toast, confirm } = useFeedback();
  const { stats } = useConsole();
  const [run, busy] = useMutation();
  const [audience, setAudience] = useState<Audience>("ALL");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState<BroadcastRow[]>([]);
  const ids = { title: useId(), body: useId(), titleCount: useId(), bodyCount: useId() };

  const history = usePagedList<BroadcastRow>("/notifications/history");
  const seen = new Set(sent.map(r => r.id));
  const rows = [...sent, ...history.items.filter(r => !seen.has(r.id))];

  // Suspended accounts are skipped when sending. Stats count them across all
  // roles, so "Everyone" is exact and a single role is an upper bound.
  const reach = (a: Audience): { count: number; exact: boolean } | null => {
    if (!stats) return null;
    if (a === "ALL") return { count: Math.max(0, stats.users.total - stats.users.banned), exact: true };
    const n = a === "VOLUNTEER" ? stats.users.volunteers : stats.users.organizers;
    return { count: n, exact: stats.users.banned === 0 };
  };
  const target = reach(audience);
  const people = (r: { count: number; exact: boolean }) =>
    `${r.exact ? "" : "up to "}${plural(r.count, "person", "people")}`;
  const audienceNoun =
    audience === "ALL" ? "everyone on Voluntree" : audience === "VOLUNTEER" ? "all volunteers" : "all organizers";

  const t = title.trim();
  const b = body.trim();
  const valid = t.length >= MIN_LENGTH && b.length >= MIN_LENGTH;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const r = await confirm({
      title: "Send this broadcast?",
      confirmLabel: target ? `Send to ${people(target)}` : "Send broadcast",
      body: (
        <>
          <p>
            “{t}” goes to {audienceNoun}
            {target ? ` (${people(target)})` : ""} as a push notification and an in-app notification.
          </p>
          <p>A broadcast cannot be edited or recalled once it is sent. Suspended accounts do not receive it.</p>
        </>
      ),
    });
    if (!r.confirmed) return;

    await run("send", async () => {
      try {
        const row = await api<BroadcastRow>("/notifications/broadcast", {
          method: "POST",
          body: { title: t, body: b, targetRole: audience },
        });
        setSent(prev => [
          { ...row, sentBy: row.sentBy ?? (admin ? { fullName: admin.fullName, email: admin.email } : null) },
          ...prev,
        ]);
        setTitle("");
        setBody("");
        toast({
          title: "Broadcast sent",
          description: `Delivered to ${plural(row.recipientCount, "person", "people")}.`,
        });
      } catch (err) {
        toast({
          tone: "error",
          title: "The broadcast was not sent",
          description: err instanceof ApiError ? err.message : undefined,
        });
      }
    });
  };

  const columns: Column<BroadcastRow>[] = [
    {
      key: "message",
      header: "Message",
      primary: true,
      cell: r => (
        <span className="block min-w-0 max-w-md">
          <span className="block break-words font-semibold text-ink">{r.title}</span>
          <span className="mt-0.5 line-clamp-2 break-words text-meta text-ink-2">{r.body}</span>
        </span>
      ),
    },
    { key: "audience", header: "Audience", cell: r => AUDIENCE_LABEL[r.targetRole] ?? r.targetRole },
    {
      key: "recipients",
      header: "Recipients",
      align: "right",
      cell: r => <span className="tabular whitespace-nowrap">{plural(r.recipientCount, "person", "people")}</span>,
    },
    {
      key: "by",
      header: "Sent by",
      hideOnMobile: true,
      className: "hidden lg:table-cell",
      cell: r => (r.sentBy ? r.sentBy.fullName : <span className="text-ink-3">Removed admin</span>),
    },
    {
      key: "when",
      header: "Sent",
      cell: r => <span className="whitespace-nowrap text-meta text-ink-2">{formatDateTime(r.createdAt)}</span>,
    },
  ];

  const count = (a: Audience) => reach(a)?.count;

  return (
    <>
      <PageHeader
        title="Broadcasts"
        description="Send one announcement to everyone, or to all volunteers or all organizers. It arrives as a push notification and in each person's in-app notifications."
      />

      <Panel title="New broadcast" className="mb-6">
        <form onSubmit={send} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
          <div className="min-w-0 space-y-5">
            <div>
              <span className="mb-1.5 block text-meta font-semibold text-ink">
                Audience
              </span>
              <Segmented<Audience>
                label="Audience"
                value={audience}
                onChange={setAudience}
                options={[
                  { value: "ALL", label: "Everyone", count: count("ALL") },
                  { value: "VOLUNTEER", label: "Volunteers", count: count("VOLUNTEER") },
                  { value: "ORGANIZER", label: "Organizers", count: count("ORGANIZER") },
                ]}
              />
              <p className="mt-1.5 text-meta text-ink-2">
                {target
                  ? `Reaches ${people(target)}${audience === "ALL" ? ", including admins" : ""}. Suspended accounts are skipped.`
                  : "Recipient counts appear once the platform counts load."}
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor={ids.title}>Title</Label>
                <Counter id={ids.titleCount} length={title.length} max={TITLE_MAX} />
              </div>
              <TextInput
                id={ids.title}
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={TITLE_MAX}
                required
                minLength={MIN_LENGTH}
                aria-describedby={ids.titleCount}
                placeholder="e.g. New drives near you this weekend"
                autoComplete="off"
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor={ids.body}>Message</Label>
                <Counter id={ids.bodyCount} length={body.length} max={BODY_MAX} />
              </div>
              <TextArea
                id={ids.body}
                value={body}
                onChange={e => setBody(e.target.value)}
                maxLength={BODY_MAX}
                required
                minLength={MIN_LENGTH}
                rows={5}
                aria-describedby={ids.bodyCount}
                placeholder="Say what is happening and what people should do."
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="primary" icon={Send} disabled={!valid} loading={busy === "send"}>
                Review and send
              </Button>
              {!valid ? (
                <span className="text-meta text-ink-3">Title and message need at least 3 characters each.</span>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 lg:border-l lg:border-line-soft lg:pl-8">
            <NotificationPreview title={t} body={b} />
          </div>
        </form>
      </Panel>

      <Panel title="Sent broadcasts" description="Newest first." bodyClassName="p-0">
        <DataTable
          caption="Sent broadcasts"
          columns={columns}
          rows={rows}
          rowKey={r => r.id}
          state={history.state}
          error={history.error}
          onRetry={history.reload}
          hasMore={history.hasMore}
          loadingMore={history.loadingMore}
          onLoadMore={history.loadMore}
          empty={{
            icon: Megaphone,
            title: "No broadcasts yet",
            body: "Announcements you send appear here with who sent them and how many people they reached.",
          }}
        />
      </Panel>
    </>
  );
}
