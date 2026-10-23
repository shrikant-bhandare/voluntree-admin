"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useResource } from "../../lib/hooks";
import type { AdminEvent, AdminStats, SafetyReport } from "../../types/admin";
import { ALL_VIEWS, type ViewId } from "./nav";

/** What the shared inspector drawer is showing. */
export type Inspecting =
  | { kind: "user"; id: string }
  | { kind: "event"; id: string; row?: AdminEvent }
  | { kind: "report"; report: SafetyReport }
  | null;

interface ConsoleValue {
  view: ViewId;
  /** Navigate to a screen; optional params land in the URL (e.g. a filter). */
  go: (view: ViewId, params?: Record<string, string>) => void;
  /** Extra URL params for the current view (read once on arrival). */
  params: URLSearchParams;

  stats: AdminStats | null;
  statsError: string | null;
  /** Re-read the counts after a mutation so badges stay true. */
  refreshStats: () => void;

  inspecting: Inspecting;
  openUser: (id: string) => void;
  openEvent: (id: string, row?: AdminEvent) => void;
  openReport: (report: SafetyReport) => void;
  closeInspector: () => void;
}

const ConsoleContext = createContext<ConsoleValue | null>(null);

function readView(): { view: ViewId; params: URLSearchParams } {
  const params = new URLSearchParams(window.location.search);
  const v = params.get("view") as ViewId | null;
  params.delete("view");
  return { view: v && ALL_VIEWS.includes(v) ? v : "overview", params };
}

const STATS_INTERVAL_MS = 30_000;

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewId>("overview");
  const [params, setParams] = useState(() => new URLSearchParams());
  const [inspecting, setInspecting] = useState<Inspecting>(null);
  const stats = useResource<AdminStats>("/admin/stats");
  const { reload: reloadStats } = stats;

  // The screen lives in the URL (?view=reports), so reload, Back and shared
  // links land on the same place instead of always on the dashboard.
  useEffect(() => {
    const sync = () => {
      const next = readView();
      setView(next.view);
      setParams(next.params);
      setInspecting(null);
    };
    const id = window.setTimeout(sync, 0);
    window.addEventListener("popstate", sync);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const go = useCallback((next: ViewId, extra: Record<string, string> = {}) => {
    const search = new URLSearchParams({ view: next, ...extra });
    if (next === "overview" && Object.keys(extra).length === 0) search.delete("view");
    const url = `${window.location.pathname}${search.toString() ? `?${search}` : ""}`;
    window.history.pushState(null, "", url);
    setView(next);
    setParams(new URLSearchParams(extra));
    setInspecting(null);
    window.scrollTo({ top: 0 });
  }, []);

  // Badge counts stay current while the console is open and in view.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") reloadStats();
    };
    const id = window.setInterval(tick, STATS_INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [reloadStats]);

  const openUser = useCallback((id: string) => setInspecting({ kind: "user", id }), []);
  const openEvent = useCallback((id: string, row?: AdminEvent) => setInspecting({ kind: "event", id, row }), []);
  const openReport = useCallback((report: SafetyReport) => setInspecting({ kind: "report", report }), []);
  const closeInspector = useCallback(() => setInspecting(null), []);

  const value = useMemo<ConsoleValue>(
    () => ({
      view,
      go,
      params,
      stats: stats.data,
      statsError: stats.error,
      refreshStats: reloadStats,
      inspecting,
      openUser,
      openEvent,
      openReport,
      closeInspector,
    }),
    [view, go, params, stats.data, stats.error, reloadStats, inspecting, openUser, openEvent, openReport, closeInspector]
  );

  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
}

export function useConsole(): ConsoleValue {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error("useConsole must be used inside <ConsoleProvider>");
  return ctx;
}
