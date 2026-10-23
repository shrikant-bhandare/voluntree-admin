export { formatMoney, initialsOf } from "../utils/format";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "24 Oct 2026" */
export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? dateFmt.format(d) : "—";
}

/** "24 Oct 2026, 3:16 pm" — never seconds. */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : "—";
}

export function formatTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? timeFmt.format(d) : "—";
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then a date. */
export function timeAgo(value: string | Date | null | undefined, now = Date.now()): string {
  const d = toDate(value);
  if (!d) return "—";
  const s = Math.round((now - d.getTime()) / 1000);
  if (s < 0) return formatDateTime(d);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return formatDate(d);
}

/** plural(1, "drive") → "1 drive"; plural(3, "person", "people") → "3 people". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
}

/** UPPER_SNAKE enum → "Upper snake". */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const words = value.toLowerCase().split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function hours(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return `${Math.round(v * 10) / 10} h`;
}
