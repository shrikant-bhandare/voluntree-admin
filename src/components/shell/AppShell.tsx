"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Leaf, LogOut, Menu, X } from "lucide-react";
import { useSession } from "../../lib/session";
import { useFeedback } from "../../lib/feedback";
import { cn } from "../ui/primitives";
import { initialsOf } from "../../lib/format";
import { useConsole } from "./ConsoleContext";
import { NAV, SETTINGS_ITEM, viewLabel, type NavItem } from "./nav";

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", compact && "justify-center")}>
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-mint text-forest">
        <Leaf aria-hidden className="size-5" strokeWidth={2.25} />
      </span>
      {compact ? null : (
        <span className="leading-tight">
          <span className="block text-base font-bold text-white">Voluntree</span>
          <span className="block text-label font-medium text-forest-300">Admin console</span>
        </span>
      )}
    </div>
  );
}

function NavButton({ item, compact, onNavigate }: { item: NavItem; compact?: boolean; onNavigate?: () => void }) {
  const { view, go, stats } = useConsole();
  const active = view === item.id;
  const count = item.badge && stats ? item.badge(stats) : 0;
  const Icon = item.icon;
  const badgeLabel = count > 0 ? `, ${count} ${item.badgeNoun ?? ""}`.trimEnd() : "";

  return (
    <button
      type="button"
      onClick={() => {
        go(item.id);
        onNavigate?.();
      }}
      aria-current={active ? "page" : undefined}
      aria-label={compact ? `${item.label}${badgeLabel}` : undefined}
      title={compact ? item.label : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-md text-left text-meta font-medium transition-colors duration-150",
        compact ? "h-11 justify-center" : "h-10 px-3",
        active ? "bg-mint font-semibold text-forest" : "text-forest-200 hover:bg-forest-700 hover:text-white"
      )}
    >
      <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={active ? 2.25 : 2} />
      {compact ? null : <span className="flex-1 truncate">{item.label}</span>}
      {count > 0 ? (
        <span
          aria-hidden={compact ? true : undefined}
          className={cn(
            "tabular rounded-full text-label font-semibold",
            compact ? "absolute right-1.5 top-1 min-w-4 px-1 text-[0.6875rem] leading-4" : "px-2 py-px",
            active ? "bg-forest text-mint" : "bg-forest-700 text-mint group-hover:bg-forest"
          )}
        >
          {count > 99 ? "99+" : count}
          {compact ? null : <span className="sr-only"> {item.badgeNoun}</span>}
        </span>
      ) : null}
    </button>
  );
}

function NavList({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Console sections" className="flex flex-col gap-5">
      {NAV.map((group, i) => (
        <div key={group.label ?? i}>
          {group.label && !compact ? (
            <p className="mb-1.5 px-3 text-label font-semibold text-forest-300">{group.label}</p>
          ) : null}
          {group.label && compact ? <hr className="mx-3 mb-3 border-forest-700" /> : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map(item => (
              <li key={item.id}>
                <NavButton item={item} compact={compact} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function AccountBlock({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const { admin, signOut } = useSession();
  const { confirm } = useFeedback();

  const onSignOut = async () => {
    const r = await confirm({
      title: "Sign out of the console?",
      body: "You will need a new one-time code to sign back in.",
      confirmLabel: "Sign out",
    });
    if (r.confirmed) signOut();
  };

  return (
    <div className={cn("border-t border-forest-700 pt-4", compact && "flex flex-col items-center gap-1")}>
      <NavButton item={SETTINGS_ITEM} compact={compact} onNavigate={onNavigate} />
      {compact ? (
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          title="Sign out"
          className="flex h-11 w-full items-center justify-center rounded-md text-forest-200 hover:bg-forest-700 hover:text-white"
        >
          <LogOut aria-hidden className="size-[18px]" />
        </button>
      ) : (
        <div className="mt-3 flex items-center gap-3 rounded-md px-3 py-2">
          <span
            aria-hidden
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-forest-700 text-label font-semibold text-mint"
          >
            {initialsOf(admin?.fullName)}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-meta font-semibold text-white">{admin?.fullName ?? "Admin"}</span>
            <span className="block truncate text-label text-forest-300">{admin?.email}</span>
          </span>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-forest-200 hover:bg-forest-700 hover:text-white"
          >
            <LogOut aria-hidden className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Phone navigation: a sheet from the left. */
function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden">
      <div aria-hidden className="enter-fade absolute inset-0 bg-forest/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="enter-up absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col gap-6 overflow-y-auto bg-forest px-3 py-4"
      >
        <div className="flex items-center justify-between px-2">
          <Brand />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="inline-flex size-10 items-center justify-center rounded-md text-forest-200 hover:bg-forest-700 hover:text-white"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="flex-1">
          <NavList onNavigate={onClose} />
        </div>
        <AccountBlock onNavigate={onClose} />
      </div>
    </div>,
    document.body
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { view, stats } = useConsole();
  const [mobileOpen, setMobileOpen] = useState(false);
  const waiting = stats ? stats.reports.open + stats.ngos.pending + stats.payments.pending : 0;

  return (
    <div className="min-h-dvh md:pl-[72px] xl:pl-64">
      <a
        href="#main"
        className="sr-only z-[80] rounded-md bg-forest px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      {/* Desktop sidebar (xl+: below that it would squeeze tables) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 overflow-y-auto bg-forest px-3 py-5 xl:flex">
        <div className="px-2">
          <Brand />
        </div>
        <div className="flex-1">
          <NavList />
        </div>
        <AccountBlock />
      </aside>

      {/* Tablet rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col gap-5 overflow-y-auto bg-forest px-2 py-5 md:flex xl:hidden">
        <Brand compact />
        <div className="flex-1">
          <NavList compact />
        </div>
        <AccountBlock compact />
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-forest px-2 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={waiting > 0 ? `Open navigation, ${waiting} items waiting` : "Open navigation"}
          className="relative inline-flex size-11 items-center justify-center rounded-md text-white hover:bg-forest-700"
        >
          <Menu aria-hidden className="size-5" />
          {waiting > 0 ? <span aria-hidden className="absolute right-2 top-2 size-2 rounded-full bg-mint" /> : null}
        </button>
        <span className="flex-1 truncate text-base font-semibold text-white">{viewLabel(view)}</span>
        <span className="mr-2 inline-flex size-8 items-center justify-center rounded-lg bg-mint text-forest">
          <Leaf aria-hidden className="size-4" strokeWidth={2.25} />
        </span>
      </header>
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1280px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
