"use client";

import type { KeyboardEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { LoadState } from "../../lib/hooks";
import { Button, EmptyState, ErrorState, Skeleton, cn } from "./primitives";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Shown as the card heading on phones (one column should set this). */
  primary?: boolean;
  /** Hidden in the phone card layout (keep it to secondary detail). */
  hideOnMobile?: boolean;
  align?: "left" | "right";
  className?: string;
}

export interface DataTableProps<T> {
  /** Accessible table name. */
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  state: LoadState;
  error?: string | null;
  onRetry?: () => void;
  /** Opens the row (usually a detail drawer). Rows become keyboard-focusable. */
  onRowClick?: (row: T) => void;
  /** Visually flag a row (e.g. involves a minor). */
  rowTone?: (row: T) => "default" | "attention";
  empty: { icon: LucideIcon; title: string; body?: ReactNode; action?: ReactNode };
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** Row actions, rendered last on desktop and at the foot of each phone card. */
  actions?: (row: T) => ReactNode;
}

/**
 * The console's one table. At md+ it is a real <table>; below md every row
 * becomes a card with labelled values, so nothing scrolls off-screen on a
 * phone or a tablet in portrait.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  state,
  error,
  onRetry,
  onRowClick,
  rowTone,
  empty,
  hasMore,
  loadingMore,
  onLoadMore,
  actions,
}: DataTableProps<T>) {
  if (state === "loading" && rows.length === 0) {
    return (
      <div aria-busy className="divide-y divide-line-soft" role="status" aria-label={`Loading ${caption}`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="hidden h-6 w-20 sm:block" />
          </div>
        ))}
      </div>
    );
  }

  if (state === "error" && rows.length === 0) {
    return <ErrorState message={error ?? "Something went wrong."} onRetry={onRetry} />;
  }

  if (rows.length === 0) {
    return <EmptyState icon={empty.icon} title={empty.title} body={empty.body} action={empty.action} />;
  }

  const open = (row: T) => onRowClick?.(row);
  const onKey = (e: KeyboardEvent, row: T) => {
    if (!onRowClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(row);
    }
  };
  const primary = columns.find(c => c.primary) ?? columns[0];
  const rest = columns.filter(c => c !== primary && !c.hideOnMobile);

  return (
    <div>
      {/* Desktop and landscape tablet */}
      {/* Views hide low-priority columns per breakpoint; the scroll is a safety net.
          relative: keeps the absolutely positioned sr-only caption inside it. */}
      <div className="relative hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line-soft">
              {columns.map(col => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-label lg:px-5 font-semibold uppercase tracking-[0.04em] text-ink-3",
                    col.align === "right" && "text-right",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
              {actions ? (
                <th scope="col" className="px-4 py-3 text-right lg:px-5">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const tone = rowTone?.(row) ?? "default";
              return (
                <tr
                  key={rowKey(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => open(row) : undefined}
                  onKeyDown={e => onKey(e, row)}
                  className={cn(
                    "border-b border-line-soft last:border-0 transition-colors duration-150",
                    onRowClick && "cursor-pointer hover:bg-canvas focus-visible:bg-canvas",
                    tone === "attention" && "bg-mint-soft/40"
                  )}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3.5 align-middle text-row lg:px-5",
                        col.align === "right" && "text-right",
                        col.className
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                  {actions ? (
                    <td className="px-4 py-3 text-right lg:px-5" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">{actions(row)}</div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phones and portrait tablets */}
      <ul className="divide-y divide-line-soft md:hidden" aria-label={caption}>
        {rows.map(row => {
          const tone = rowTone?.(row) ?? "default";
          return (
            <li key={rowKey(row)} className={cn(tone === "attention" && "bg-mint-soft/40")}>
              <div
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => open(row) : undefined}
                onKeyDown={e => onKey(e, row)}
                className={cn("block px-4 py-4", onRowClick && "cursor-pointer active:bg-canvas")}
              >
                <div className="min-w-0 text-row">{primary.cell(row)}</div>
                {rest.length > 0 ? (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {rest.map(col => (
                      <div key={col.key} className="min-w-0">
                        <dt className="text-label font-semibold uppercase tracking-[0.04em] text-ink-3">{col.header}</dt>
                        <dd className="mt-0.5 break-words text-meta text-ink">{col.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
              {actions ? <div className="flex flex-wrap gap-2 px-4 pb-4">{actions(row)}</div> : null}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3 text-meta text-ink-3">
        <span className="tabular">
          Showing {rows.length.toLocaleString("en-IN")}
          {hasMore ? " so far" : rows.length === 1 ? " row" : " rows"}
        </span>
        {hasMore ? (
          <Button size="sm" onClick={onLoadMore} loading={loadingMore}>
            Load more
          </Button>
        ) : null}
        {state === "error" && error ? <span className="text-danger">{error}</span> : null}
      </div>
    </div>
  );
}
