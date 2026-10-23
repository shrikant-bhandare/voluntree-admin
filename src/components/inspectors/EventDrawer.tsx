"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Check,
  Clock,
  Flag,
  Globe,
  MapPin,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { ApiError } from "../../lib/api";
import { useMutation, usePagedList, useResource } from "../../lib/hooks";
import { useApi } from "../../lib/session";
import { useFeedback } from "../../lib/feedback";
import { formatDate, formatDateTime, formatTime, hours, humanize, plural, timeAgo } from "../../lib/format";
import { adminEventActions, type AdminEventAction, type EventActionDef } from "../../utils/eventStatus";
import type { AdminEvent, Applicant, ApplicationStatus, EventStatus } from "../../types/admin";
import { useConsole } from "../shell/ConsoleContext";
import { Drawer } from "../ui/Overlay";
import {
  Avatar,
  Badge,
  Button,
  Details,
  ErrorState,
  Label,
  SectionTitle,
  Select,
  Skeleton,
  TextArea,
  TextInput,
  cn,
} from "../ui/primitives";
import { ApplicationStatusBadge, EventStatusBadge, PersonLink } from "../common/bits";

/** DrivesView listens for this and re-reads its list. */
const EVENTS_CHANGED = "voluntree:events-changed";

/** GET /events/:id lacks the organizer email and hour totals the list row carries. */
type DriveRecord = Omit<AdminEvent, "hoursLoggedTotal"> & { hoursLoggedTotal?: number; spotsRemaining?: number };

/** Approvals are accepted only on these, and only before the drive ends. */
const APPROVABLE: EventStatus[] = ["ACTIVE", "FEATURED", "FULL"];

const SUCCESS: Record<AdminEventAction, string> = {
  FEATURE: "Drive featured",
  UNFEATURE: "Drive no longer featured",
  SUSPEND: "Drive suspended",
  REINSTATE: "Drive reinstated",
  CANCEL: "Drive cancelled",
};

function errorText(err: unknown): string | undefined {
  return err instanceof ApiError ? err.message : undefined;
}

function announce() {
  window.dispatchEvent(new CustomEvent(EVENTS_CHANGED));
}

/** The list row has the richer shape; the fresh GET has the current values. */
function merge(initial: AdminEvent | undefined, fresh: DriveRecord | null): DriveRecord | null {
  if (!fresh) return initial ?? null;
  if (!initial) return fresh;
  return {
    ...initial,
    ...fresh,
    organizer: { ...initial.organizer, ...fresh.organizer },
    hoursLoggedTotal: fresh.hoursLoggedTotal ?? initial.hoursLoggedTotal,
  };
}

/** ISO → value for <input type="datetime-local"> in the admin's own time zone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function sameDay(a: string, b: string): boolean {
  return formatDate(a) === formatDate(b);
}

function whenText(e: DriveRecord): string {
  return sameDay(e.startTime, e.endTime)
    ? `${formatDate(e.startTime)}, ${formatTime(e.startTime)} to ${formatTime(e.endTime)}`
    : `${formatDateTime(e.startTime)} to ${formatDateTime(e.endTime)}`;
}

export function EventDrawer(props: { eventId: string; initial?: AdminEvent; onClose: () => void }) {
  // Keyed so opening another drive starts with fresh edit/applicant state.
  return <DriveDrawer key={props.eventId} {...props} />;
}

function DriveDrawer({ eventId, initial, onClose }: { eventId: string; initial?: AdminEvent; onClose: () => void }) {
  const api = useApi();
  const { toast, confirm } = useFeedback();
  const { refreshStats, go } = useConsole();
  const res = useResource<DriveRecord>(`/events/${eventId}`);
  const [run, busy] = useMutation();
  const [editing, setEditing] = useState(false);
  const formId = useId();
  const event = merge(initial, res.data);

  const patchLocal = (changes: Partial<DriveRecord>) =>
    res.setData(prev => {
      const base = prev ?? (initial as DriveRecord | undefined) ?? null;
      return base ? { ...base, ...changes } : base;
    });

  const changeStatus = async (def: EventActionDef) => {
    if (!event) return;
    if (def.confirm) {
      const [question, ...paragraphs] = def.confirm(event.title).split("\n\n");
      const r = await confirm({
        title: question,
        tone: def.tone === "danger" ? "danger" : def.tone === "positive" ? "positive" : "default",
        confirmLabel: def.label,
        // "Cancel" beside "Cancel drive" reads as the same action.
        cancelLabel: def.action === "CANCEL" ? "Keep drive" : undefined,
        body: (
          <>
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </>
        ),
      });
      if (!r.confirmed) return;
    }
    await run(`status:${def.action}`, async () => {
      try {
        const updated = await api<Partial<DriveRecord> | undefined>(`/events/${event.id}/status`, {
          method: "PATCH",
          body: { status: def.next },
        });
        patchLocal({ status: updated?.status ?? def.next });
        res.reload();
        announce();
        refreshStats();
        toast({ title: SUCCESS[def.action], description: event.title });
      } catch (err) {
        toast({ tone: "error", title: "Could not change the drive's status", description: errorText(err) });
      }
    });
  };

  const remove = async () => {
    if (!event) return;
    const r = await confirm({
      title: "Delete this drive permanently?",
      tone: "danger",
      confirmLabel: "Delete drive",
      body: (
        <>
          <p>&ldquo;{event.title}&rdquo; is removed for good. Nobody has applied or checked in, so no volunteer is affected.</p>
          <p>This cannot be undone. To keep a record, cancel the drive instead.</p>
        </>
      ),
    });
    if (!r.confirmed) return;
    await run("delete", async () => {
      try {
        await api(`/events/${event.id}`, { method: "DELETE" });
        announce();
        refreshStats();
        toast({ title: "Drive deleted", description: event.title });
        onClose();
      } catch (err) {
        toast({ tone: "error", title: "Could not delete the drive", description: errorText(err) });
      }
    });
  };

  if (!event) {
    return (
      <Drawer open onClose={onClose} title={res.state === "error" ? "Drive" : "Loading drive"}>
        {res.state === "error" ? (
          <ErrorState message={res.error ?? "Could not load this drive."} onRetry={res.reload} />
        ) : (
          <div role="status" aria-label="Loading drive" className="space-y-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </Drawer>
    );
  }

  const actions = adminEventActions(event.status);
  const deletable = event.applicationCount === 0 && event.attendanceCount === 0;

  const footer = editing ? (
    <>
      <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy === "edit"}>
        Discard changes
      </Button>
      <Button variant="primary" type="submit" form={formId} loading={busy === "edit"}>
        Save changes
      </Button>
    </>
  ) : (
    <>
      <div className="mr-auto flex flex-wrap gap-2">
        <Button variant="ghost" icon={Pencil} onClick={() => setEditing(true)}>
          Edit details
        </Button>
        {deletable ? (
          <Button variant="danger-quiet" icon={Trash2} onClick={remove} loading={busy === "delete"}>
            Delete drive
          </Button>
        ) : null}
      </div>
      {actions.map(def => (
        <Button
          key={def.action}
          variant={def.tone === "danger" ? "danger-quiet" : def.tone === "positive" ? "positive" : "secondary"}
          disabled={Boolean(busy?.startsWith("status:")) && busy !== `status:${def.action}`}
          loading={busy === `status:${def.action}`}
          onClick={() => changeStatus(def)}
        >
          {def.label}
        </Button>
      ))}
    </>
  );

  return (
    <Drawer
      open
      onClose={onClose}
      title={event.title}
      subtitle={`${event.category} · ${formatDate(event.startTime)}`}
      meta={
        <>
          <EventStatusBadge status={event.status} />
          {event.isOrganizerVerified ? (
            <Badge tone="success" icon={ShieldCheck}>
              Verified organizer
            </Badge>
          ) : (
            <Badge tone="outline" icon={ShieldAlert}>
              Organizer not verified
            </Badge>
          )}
        </>
      }
      footer={footer}
    >
      {res.state === "error" && res.data === null ? (
        <p role="alert" className="mb-4 rounded-md bg-sunken px-3 py-2 text-meta text-ink-2">
          Showing the list values. The latest copy could not be loaded: {res.error}{" "}
          <button type="button" onClick={res.reload} className="font-semibold text-forest underline underline-offset-[3px]">
            Try again
          </button>
        </p>
      ) : null}

      {editing ? (
        <EditForm
          formId={formId}
          event={event}
          onSubmit={(changes, setErrors) =>
            run("edit", async () => {
              try {
                const updated = await api<Partial<DriveRecord> | undefined>(`/events/${event.id}`, {
                  method: "PATCH",
                  body: changes,
                });
                patchLocal({ ...(changes as Partial<DriveRecord>), ...(updated?.status ? { status: updated.status } : {}) });
                res.reload();
                announce();
                setEditing(false);
                toast({
                  title: "Drive details saved",
                  description: `Updated ${Object.keys(changes).map(k => FIELD_LABEL[k] ?? k).join(", ")}.`,
                });
              } catch (err) {
                setErrors(apiFieldErrors(err));
                toast({ tone: "error", title: "Could not save the drive", description: errorText(err) });
              }
            })
          }
          onNothingChanged={() => {
            setEditing(false);
            toast({ tone: "info", title: "Nothing changed" });
          }}
        />
      ) : (
        <>
          <div className="rounded-lg bg-surface p-4 ring-1 ring-line-soft">
            <p className="text-label font-semibold uppercase tracking-[0.04em] text-ink-3">Organizer</p>
            <PersonLink
              id={event.organizer.id}
              name={event.organizer.fullName}
              secondary={event.organizer.email}
              className="mt-1 block"
            />
          </div>

          <SectionTitle>Numbers</SectionTitle>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Approved" value={`${event.approvedCount.toLocaleString("en-IN")} of ${event.volunteersNeeded.toLocaleString("en-IN")}`} />
            <Stat label="Applications" value={event.applicationCount.toLocaleString("en-IN")} />
            <Stat label="Check-ins" value={event.attendanceCount.toLocaleString("en-IN")} />
            <Stat label="Hours logged" value={event.hoursLoggedTotal !== undefined ? hours(event.hoursLoggedTotal) : "—"} />
          </dl>

          <SectionTitle>Details</SectionTitle>
          <Details
            items={[
              { label: "When", value: whenText(event) },
              {
                label: "Where",
                value: event.isOnline ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Globe aria-hidden className="size-4 text-ink-3" /> Online
                  </span>
                ) : (
                  <span className="inline-flex items-start gap-1.5">
                    <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" /> {event.address || "—"}
                  </span>
                ),
              },
              {
                label: "Capacity",
                value: `${plural(event.volunteersNeeded, "place")}, ${event.approvedCount.toLocaleString("en-IN")} filled`,
              },
              { label: "Minimum age", value: event.minAge > 0 ? `${event.minAge} and over` : "No minimum" },
              {
                label: "Paid",
                value: event.isPaid ? `Yes${event.compensationDetails ? ` · ${event.compensationDetails}` : ""}` : "No, unpaid",
              },
              { label: "Created", value: formatDateTime(event.createdAt) },
              {
                label: "Open positions",
                value: event.openPositions.length > 0 ? <ChipList items={event.openPositions} /> : "None listed",
              },
              { label: "Perks", value: event.perks.length > 0 ? <ChipList items={event.perks} /> : "None listed" },
            ]}
          />
          <p className="mt-5 text-label font-semibold uppercase tracking-[0.04em] text-ink-3">Description</p>
          <p className="mt-1 whitespace-pre-line break-words text-row text-ink">{event.description}</p>

          {!deletable ? (
            <p className="mt-6 text-meta text-ink-3">
              This drive has applications or check-ins, so it cannot be deleted. Cancel it instead to keep the record.
            </p>
          ) : null}
          <p className="mt-2 text-meta text-ink-3">
            Reports about this drive are handled in the safety queue.{" "}
            <button
              type="button"
              onClick={() => go("reports")}
              className="inline-flex items-center gap-1 font-semibold text-forest underline decoration-forest/30 underline-offset-[3px] hover:decoration-forest"
            >
              <Flag aria-hidden className="size-3.5" /> Open reports
            </button>
          </p>

          <Applicants
            event={event}
            onChanged={() => {
              res.reload();
              announce();
            }}
          />
        </>
      )}
    </Drawer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-3 ring-1 ring-line-soft">
      <dt className="text-label font-semibold uppercase tracking-[0.04em] text-ink-3">{label}</dt>
      <dd className="tabular mt-1 text-lg font-semibold text-forest">{value}</dd>
    </div>
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map(item => (
        <Badge key={item} tone="neutral">
          {item}
        </Badge>
      ))}
    </span>
  );
}

/* --------------------------------------------------------------- Editing */

type FieldKey = "title" | "description" | "category" | "address" | "startTime" | "endTime" | "volunteersNeeded" | "minAge" | "isOnline";
type FieldErrors = Partial<Record<FieldKey | "form", string>>;

const FIELD_LABEL: Record<string, string> = {
  title: "title",
  description: "description",
  category: "category",
  address: "address",
  startTime: "start time",
  endTime: "end time",
  volunteersNeeded: "places",
  minAge: "minimum age",
  isOnline: "online setting",
};

const FIELD_KEYS = Object.keys(FIELD_LABEL) as FieldKey[];

/** Nest joins validation messages with ". "; each starts with the field name. */
function apiFieldErrors(err: unknown): FieldErrors {
  if (!(err instanceof ApiError) || err.status !== 400) return { form: errorText(err) ?? "Could not save the drive." };
  const out: FieldErrors = {};
  const general: string[] = [];
  for (const part of err.message.split(/\.\s+/)) {
    const text = part.trim();
    if (!text) continue;
    const key = FIELD_KEYS.find(k => text.startsWith(k));
    if (key) {
      const readable = text.replace(key, FIELD_LABEL[key].charAt(0).toUpperCase() + FIELD_LABEL[key].slice(1));
      out[key] = out[key] ? `${out[key]}. ${readable}` : readable;
    } else general.push(text);
  }
  if (general.length > 0) out.form = general.join(". ");
  return out;
}

interface FormValues {
  title: string;
  description: string;
  category: string;
  address: string;
  startTime: string;
  endTime: string;
  volunteersNeeded: string;
  minAge: string;
  isOnline: boolean;
}

function EditForm({
  formId,
  event,
  onSubmit,
  onNothingChanged,
}: {
  formId: string;
  event: DriveRecord;
  onSubmit: (changes: Record<string, unknown>, setErrors: (e: FieldErrors) => void) => void;
  onNothingChanged: () => void;
}) {
  const categories = useResource<{ data: string[] }>("/events/categories");
  const [v, setV] = useState<FormValues>(() => ({
    title: event.title,
    description: event.description,
    category: event.category,
    address: event.address ?? "",
    startTime: toLocalInput(event.startTime),
    endTime: toLocalInput(event.endTime),
    volunteersNeeded: String(event.volunteersNeeded),
    minAge: String(event.minAge),
    isOnline: event.isOnline,
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);

  // The drawer keeps its scroll position; bring the form's first field into view.
  useEffect(() => {
    formRef.current?.scrollIntoView({ block: "start" });
    formRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }, []);
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setV(prev => ({ ...prev, [key]: value }));

  const categoryOptions = categories.data?.data ?? [];
  const options = categoryOptions.includes(event.category) ? categoryOptions : [event.category, ...categoryOptions];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: FieldErrors = {};
    const title = v.title.trim();
    const description = v.description.trim();
    const address = v.address.trim();
    const needed = Number(v.volunteersNeeded);
    const minAge = Number(v.minAge);
    const start = new Date(v.startTime);
    const end = new Date(v.endTime);

    if (title.length < 3 || title.length > 200) errs.title = "Use 3 to 200 characters.";
    if (description.length < 10) errs.description = "Write at least 10 characters.";
    if (!v.isOnline && !address) errs.address = "Add where volunteers should go, or mark the drive as online.";
    if (!v.startTime || Number.isNaN(start.getTime())) errs.startTime = "Choose a start date and time.";
    if (!v.endTime || Number.isNaN(end.getTime())) errs.endTime = "Choose an end date and time.";
    else if (!errs.startTime && end <= start) errs.endTime = "The drive must end after it starts.";
    if (!Number.isInteger(needed) || needed < 1 || needed > 100000) errs.volunteersNeeded = "Enter a whole number from 1 to 100,000.";
    if (!Number.isInteger(minAge) || minAge < 0 || minAge > 120) errs.minAge = "Enter a whole number from 0 to 120.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const changes: Record<string, unknown> = {};
    if (title !== event.title) changes.title = title;
    if (description !== event.description.trim()) changes.description = description;
    if (v.category !== event.category) changes.category = v.category;
    if (address !== (event.address ?? "")) changes.address = address;
    if (v.startTime !== toLocalInput(event.startTime)) changes.startTime = start.toISOString();
    if (v.endTime !== toLocalInput(event.endTime)) changes.endTime = end.toISOString();
    if (needed !== event.volunteersNeeded) changes.volunteersNeeded = needed;
    if (minAge !== event.minAge) changes.minAge = minAge;
    if (v.isOnline !== event.isOnline) changes.isOnline = v.isOnline;

    if (Object.keys(changes).length === 0) {
      onNothingChanged();
      return;
    }
    onSubmit(changes, setErrors);
  };

  const field = (key: FieldKey) => ({
    id: `${id}-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
  });
  const err = (key: FieldKey): ReactNode =>
    errors[key] ? (
      <p id={`${id}-${key}-error`} className="mt-1.5 text-meta text-danger">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form ref={formRef} id={formId} onSubmit={submit} noValidate className="scroll-mt-5 space-y-5">
      <p className="text-meta text-ink-2">
        Only the fields you change are saved. The edit is recorded in the audit log under your name.
      </p>
      {errors.form ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-meta text-danger-ink">
          {errors.form}
        </p>
      ) : null}

      <div>
        <Label htmlFor={`${id}-title`}>Title</Label>
        <TextInput {...field("title")} value={v.title} maxLength={200} onChange={e => set("title", e.target.value)} />
        {err("title")}
      </div>

      <div>
        <Label htmlFor={`${id}-description`}>Description</Label>
        <TextArea
          {...field("description")}
          value={v.description}
          maxLength={10000}
          rows={6}
          onChange={e => set("description", e.target.value)}
        />
        {err("description")}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-category`}>Category</Label>
          <Select {...field("category")} value={v.category} onChange={e => set("category", e.target.value)} className="w-full">
            {options.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          {err("category")}
        </div>
        <div className="flex items-end">
          <label htmlFor={`${id}-isOnline`} className="flex h-10 cursor-pointer items-center gap-2.5 text-row text-ink">
            <input
              id={`${id}-isOnline`}
              type="checkbox"
              checked={v.isOnline}
              onChange={e => set("isOnline", e.target.checked)}
              className="size-4 accent-forest"
            />
            Online drive
          </label>
        </div>
      </div>

      <div>
        <Label htmlFor={`${id}-address`} hint={v.isOnline ? "(optional for online drives)" : undefined}>
          Address
        </Label>
        <TextInput {...field("address")} value={v.address} maxLength={500} onChange={e => set("address", e.target.value)} />
        {err("address")}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-startTime`}>Starts</Label>
          <TextInput
            {...field("startTime")}
            type="datetime-local"
            value={v.startTime}
            onChange={e => set("startTime", e.target.value)}
          />
          {err("startTime")}
        </div>
        <div>
          <Label htmlFor={`${id}-endTime`}>Ends</Label>
          <TextInput {...field("endTime")} type="datetime-local" value={v.endTime} onChange={e => set("endTime", e.target.value)} />
          {err("endTime")}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-volunteersNeeded`}>Volunteers needed</Label>
          <TextInput
            {...field("volunteersNeeded")}
            type="number"
            inputMode="numeric"
            min={1}
            max={100000}
            value={v.volunteersNeeded}
            onChange={e => set("volunteersNeeded", e.target.value)}
          />
          {err("volunteersNeeded")}
        </div>
        <div>
          <Label htmlFor={`${id}-minAge`}>Minimum age</Label>
          <TextInput
            {...field("minAge")}
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={v.minAge}
            onChange={e => set("minAge", e.target.value)}
          />
          {err("minAge")}
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------ Applicants */

function Applicants({ event, onChanged }: { event: DriveRecord; onChanged: () => void }) {
  const api = useApi();
  const { toast, confirm } = useFeedback();
  const [run, busy] = useMutation();
  const list = usePagedList<Applicant>(`/applications/event/${event.id}`, {}, 20);
  const [openedAt] = useState(() => Date.now());
  const canApprove = APPROVABLE.includes(event.status) && new Date(event.endTime).getTime() > openedAt;

  const setStatus = async (a: Applicant, status: ApplicationStatus) => {
    const name = a.volunteer.fullName;
    if (status === "REJECTED") {
      const r = await confirm({
        title: `Reject ${name}?`,
        tone: "danger",
        confirmLabel: "Reject",
        body: (
          <>
            <p>
              {name} is told their application for &ldquo;{event.title}&rdquo; was not accepted.
              {a.status === "APPROVED" ? " They lose their place and their entry pass stops working." : ""}
            </p>
            <p>You can change this later from the same list.</p>
          </>
        ),
      });
      if (!r.confirmed) return;
    }
    await run(a.id, async () => {
      try {
        await api(`/applications/${a.id}/status`, { method: "PATCH", body: { status } });
        list.updateItem(a.id, { status });
        onChanged();
        toast({
          title:
            status === "APPROVED" ? `${name} approved` : status === "REJECTED" ? `${name} rejected` : `${name} waitlisted`,
          description: "They have been notified.",
        });
      } catch (err) {
        toast({ tone: "error", title: "Could not update the application", description: errorText(err) });
      }
    });
  };

  return (
    <section aria-label="Applicants" className="mt-7">
      <SectionTitle aside={plural(event.applicationCount, "application")}>Applicants</SectionTitle>
      {!canApprove && list.items.length > 0 ? (
        <p className="mb-3 text-meta text-ink-3">
          New approvals are closed: this drive is {humanize(event.status).toLowerCase()}
          {APPROVABLE.includes(event.status) ? " and has already ended" : ""}.
        </p>
      ) : null}

      {list.state === "loading" && list.items.length === 0 ? (
        <div role="status" aria-label="Loading applicants" className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : list.state === "error" && list.items.length === 0 ? (
        <ErrorState message={list.error ?? "Could not load applicants."} onRetry={list.reload} />
      ) : list.items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg bg-surface px-4 py-4 text-meta text-ink-2 ring-1 ring-line-soft">
          <UsersRound aria-hidden className="size-5 text-ink-3" />
          No volunteer has applied yet.
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line-soft rounded-lg bg-surface ring-1 ring-line-soft">
            {list.items.map(a => (
              <li key={a.id} className="flex gap-3 px-4 py-4">
                <Avatar name={a.volunteer.fullName} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <PersonLink id={a.volunteer.id} name={a.volunteer.fullName} secondary={a.volunteer.email} className="min-w-0" />
                    <ApplicationStatusBadge status={a.status} />
                  </div>
                  <p className="mt-1 text-meta text-ink-3">
                    <span title={formatDateTime(a.createdAt)}>Applied {timeAgo(a.createdAt)}</span>
                    {a.roleRequested ? ` · for ${a.roleRequested}` : ""}
                    {a.volunteer.phoneNumber ? ` · ${a.volunteer.phoneNumber}` : ""}
                  </p>
                  {a.message ? (
                    <p className="mt-2 whitespace-pre-line break-words rounded-md bg-sunken px-3 py-2 text-meta text-ink-2">
                      {a.message}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {a.status !== "APPROVED" && canApprove ? (
                      <Button size="sm" variant="positive" icon={Check} loading={busy === a.id} onClick={() => setStatus(a, "APPROVED")}>
                        Approve
                      </Button>
                    ) : null}
                    {a.status !== "WAITLISTED" ? (
                      <Button size="sm" icon={Clock} disabled={busy === a.id} onClick={() => setStatus(a, "WAITLISTED")}>
                        Waitlist
                      </Button>
                    ) : null}
                    {a.status !== "REJECTED" ? (
                      <Button size="sm" variant="danger-quiet" icon={X} disabled={busy === a.id} onClick={() => setStatus(a, "REJECTED")}>
                        Reject
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className={cn("mt-3 flex flex-wrap items-center justify-between gap-3 text-meta text-ink-3")}>
            <span className="tabular">
              Showing {list.items.length.toLocaleString("en-IN")}
              {list.hasMore ? " so far" : ""}
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
    </section>
  );
}
