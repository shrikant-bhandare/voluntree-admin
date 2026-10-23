"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton, cn } from "./primitives";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared behaviour for drawers and dialogs: portal, Escape to close, focus
 * moved in on open and returned on close, Tab kept inside, page scroll locked.
 */
function useModal(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const id = window.setTimeout(() => {
      const panel = panelRef.current;
      const target =
        panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? panel)?.focus();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        n => n.offsetParent !== null
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  return panelRef;
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Badges or status next to the title. */
  meta?: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
  children: ReactNode;
}

/** Side panel for one record. Full screen on phones. */
export function Drawer({ open, onClose, title, subtitle, meta, footer, size = "md", children }: DrawerProps) {
  const panelRef = useModal(open, onClose);
  const titleId = useId();
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div aria-hidden className="enter-fade absolute inset-0 bg-forest/30" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "enter-right relative flex h-full w-full flex-col bg-canvas shadow-overlay outline-none",
          size === "md" ? "sm:max-w-xl" : "sm:max-w-3xl"
        )}
      >
        <div className="flex items-start gap-3 border-b border-line-soft bg-surface px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-xl font-bold text-forest">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 truncate text-meta text-ink-2">{subtitle}</p> : null}
            {meta ? <div className="mt-2 flex flex-wrap gap-1.5">{meta}</div> : null}
          </div>
          <IconButton icon={X} label="Close panel" onClick={onClose} className="-mr-2 -mt-1" />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft bg-surface px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer: ReactNode;
  tone?: "default" | "danger";
}

/** Centered dialog, reserved for decisions that must interrupt. */
export function Dialog({ open, onClose, title, children, footer, tone = "default" }: DialogProps) {
  const panelRef = useModal(open, onClose);
  const titleId = useId();
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div aria-hidden className="enter-fade absolute inset-0 bg-forest/40" onClick={onClose} />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="enter-up relative w-full max-w-lg rounded-t-xl bg-surface shadow-overlay outline-none ring-1 ring-forest/10 sm:rounded-xl"
      >
        <div className="px-6 pb-2 pt-5">
          <h2 id={titleId} className={cn("text-lg font-bold", tone === "danger" ? "text-danger-ink" : "text-forest")}>
            {title}
          </h2>
        </div>
        <div className="px-6 pb-5 text-row text-ink-2">{children}</div>
        <div className="flex flex-col-reverse gap-2 border-t border-line-soft px-6 py-4 sm:flex-row sm:justify-end">
          {footer}
        </div>
      </div>
    </div>,
    document.body
  );
}
