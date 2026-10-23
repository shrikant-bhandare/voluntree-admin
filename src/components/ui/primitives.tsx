"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown, Loader2, Search, X, type LucideIcon } from "lucide-react";
import { initialsOf } from "../../lib/format";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Button */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "positive" | "danger" | "danger-quiet";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-forest text-white hover:bg-forest-700 shadow-press",
  secondary: "bg-surface text-forest ring-1 ring-inset ring-forest/60 hover:bg-mint-soft",
  ghost: "text-forest hover:bg-sunken",
  positive: "bg-growth text-white hover:bg-growth-ink shadow-press",
  danger: "bg-danger text-white hover:bg-danger-ink shadow-press",
  "danger-quiet": "text-danger ring-1 ring-inset ring-danger/40 hover:bg-danger-soft",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon: Icon, className, children, disabled, type, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold tracking-[0.01em]",
        "transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "md" ? "h-10 px-4 text-meta" : "h-8 px-3 text-meta",
        VARIANT[variant],
        className
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : Icon ? (
        <Icon aria-hidden className="size-4 shrink-0" strokeWidth={2} />
      ) : null}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  tone?: "default" | "danger";
}

export function IconButton({ icon: Icon, label, tone = "default", className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
        tone === "danger" ? "text-danger hover:bg-danger-soft" : "text-ink-2 hover:bg-sunken hover:text-forest",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...rest}
    >
      <Icon aria-hidden className="size-[18px]" strokeWidth={2} />
    </button>
  );
}

/* ------------------------------------------------------------------- Badge */

export type BadgeTone = "neutral" | "success" | "forest" | "info" | "danger" | "outline";

const BADGE: Record<BadgeTone, string> = {
  neutral: "bg-sunken text-ink-2",
  success: "bg-mint-soft text-growth-ink",
  forest: "bg-forest text-white",
  info: "bg-forest-200/50 text-forest",
  danger: "bg-danger-soft text-danger-ink",
  outline: "ring-1 ring-inset ring-line text-ink-2",
};

export function Badge({
  tone = "neutral",
  icon: Icon,
  children,
  className,
  title,
}: {
  tone?: BadgeTone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-label font-semibold",
        BADGE[tone],
        className
      )}
    >
      {Icon ? <Icon aria-hidden className="size-3.5" strokeWidth={2.25} /> : null}
      {children}
    </span>
  );
}

/* ----------------------------------------------------------- Page & panels */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-3xl">
        <h1 className="text-2xl font-bold text-forest">{title}</h1>
        {description ? <p className="mt-1 text-meta text-ink-2 sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl bg-surface shadow-card ring-1 ring-line-soft", className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div className="min-w-0">
            {title ? <h2 className="text-lg font-semibold text-forest">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-meta text-ink-2">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** A filter/search row above a list. Wraps on narrow screens. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-4 flex flex-wrap items-center gap-3", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ Fields */

const FIELD =
  "w-full rounded-md bg-surface text-row text-ink ring-1 ring-inset ring-line transition-shadow duration-150 outline-none hover:ring-ink-3 focus:ring-2 focus:ring-forest disabled:bg-sunken disabled:text-ink-3";

export function Label({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-meta font-semibold text-ink">
      {children}
      {hint ? <span className="ml-1 font-normal text-ink-3">{hint}</span> : null}
    </label>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...rest },
  ref
) {
  return <input ref={ref} className={cn(FIELD, "h-10 px-3", className)} {...rest} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(FIELD, "min-h-24 px-3 py-2.5 leading-relaxed", className)} {...rest} />;
  }
);

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <select className={cn(FIELD, "h-10 w-full appearance-none pl-3 pr-9")} {...rest}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
    </span>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** Accessible name; defaults to the placeholder. */
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex w-full sm:w-80", className)}>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        className={cn(FIELD, "h-10 pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden")}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-ink-3 hover:bg-sunken hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}
    </span>
  );
}

/* --------------------------------------------------------------- Segmented */

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  count?: number;
}

/** A small set of mutually exclusive filters (≤5). */
export function Segmented<V extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: V;
  onChange: (v: V) => void;
  options: SegmentOption<V>[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-lg bg-sunken p-1">
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-meta font-semibold transition-colors duration-150",
              active ? "bg-surface text-forest shadow-press" : "text-ink-2 hover:text-forest"
            )}
          >
            {opt.label}
            {opt.count !== undefined ? (
              <span
                className={cn(
                  "tabular rounded-full px-1.5 text-label",
                  active ? "bg-mint-soft text-growth-ink" : "bg-sunken-2 text-ink-2"
                )}
              >
                {opt.count.toLocaleString("en-IN")}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ Misc pieces */

export function Avatar({ name, size = "md" }: { name: string | null | undefined; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-mint-soft font-semibold text-forest",
        size === "sm" && "size-7 text-label",
        size === "md" && "size-9 text-meta",
        size === "lg" && "size-14 text-lg"
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("skeleton block rounded-md", className)} />;
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-mint-soft text-growth">
        <Icon aria-hidden className="size-6" />
      </span>
      <p className="text-base font-semibold text-forest">{title}</p>
      {body ? <p className="mt-1 max-w-md text-meta text-ink-2">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
      <p className="text-base font-semibold text-danger-ink">This could not be loaded</p>
      <p className="mt-1 max-w-md text-meta text-ink-2">{message}</p>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Label/value pairs for detail panels. */
export function Details({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3"
      )}
    >
      {items.map(item => (
        <div key={item.label} className="min-w-0">
          <dt className="text-label font-semibold uppercase tracking-[0.04em] text-ink-3">{item.label}</dt>
          <dd className="mt-1 break-words text-row text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Small section heading inside drawers and panels. */
export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-baseline justify-between gap-3 first:mt-0">
      <h3 className="text-base font-semibold text-forest">{children}</h3>
      {aside ? <div className="text-meta text-ink-3">{aside}</div> : null}
    </div>
  );
}
