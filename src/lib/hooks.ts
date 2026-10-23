"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, query, type Page } from "./api";
import { useApi } from "./session";

export type LoadState = "loading" | "ready" | "error";

type Params = Record<string, string | number | boolean | null | undefined>;

export interface PagedList<T> {
  items: T[];
  state: LoadState;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  /** Re-fetch from the first page, keeping the current rows on screen. */
  reload: () => void;
  /** Replace one row in place after a mutation (matched by id). */
  updateItem: (id: string, patch: Partial<T> | ((row: T) => T)) => void;
  removeItem: (id: string) => void;
}

/**
 * A cursor-paginated admin list (`{ data, nextCursor }`). Filters and search
 * go to the server as query params, so results cover every row, not just the
 * page already loaded. A response for an outdated filter is discarded.
 */
export function usePagedList<T extends { id: string }>(
  path: string | null,
  params: Params = {},
  pageSize = 25
): PagedList<T> {
  const api = useApi();
  const [items, setItems] = useState<T[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const seq = useRef(0);
  const key = path ? path + query({ ...params, limit: pageSize }) : null;

  const fetchFirst = useCallback(
    async (keepRows: boolean) => {
      if (!key) return;
      const mine = ++seq.current;
      if (!keepRows) setState("loading");
      setError(null);
      try {
        const page = await api<Page<T>>(key);
        if (mine !== seq.current) return;
        setItems(page.data);
        setCursor(page.nextCursor);
        setState("ready");
      } catch (err) {
        if (mine !== seq.current) return;
        setError(err instanceof ApiError ? err.message : "Could not load this list.");
        setState("error");
      }
    },
    [api, key]
  );

  useEffect(() => {
    // Deferred a tick so the effect does not set state synchronously.
    const id = window.setTimeout(() => void fetchFirst(false), 0);
    return () => window.clearTimeout(id);
  }, [fetchFirst]);

  const loadMore = useCallback(async () => {
    if (!key || !cursor || loadingMore) return;
    const mine = seq.current;
    setLoadingMore(true);
    try {
      const sep = key.includes("?") ? "&" : "?";
      const page = await api<Page<T>>(`${key}${sep}cursor=${encodeURIComponent(cursor)}`);
      if (mine !== seq.current) return;
      setItems(prev => {
        const seen = new Set(prev.map(r => r.id));
        return [...prev, ...page.data.filter(r => !seen.has(r.id))];
      });
      setCursor(page.nextCursor);
    } catch (err) {
      if (mine !== seq.current) return;
      setError(err instanceof ApiError ? err.message : "Could not load more rows.");
    } finally {
      setLoadingMore(false);
    }
  }, [api, key, cursor, loadingMore]);

  const updateItem = useCallback((id: string, patch: Partial<T> | ((row: T) => T)) => {
    setItems(prev =>
      prev.map(row =>
        row.id === id ? (typeof patch === "function" ? patch(row) : { ...row, ...patch }) : row
      )
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(row => row.id !== id));
  }, []);

  return {
    items,
    state,
    error,
    hasMore: Boolean(cursor),
    loadingMore,
    loadMore: () => void loadMore(),
    reload: () => void fetchFirst(true),
    updateItem,
    removeItem,
  };
}

export interface Resource<T> {
  data: T | null;
  state: LoadState;
  error: string | null;
  reload: () => void;
  setData: (next: T | null | ((prev: T | null) => T | null)) => void;
}

/** One GET resource (a detail record, the stats summary). null path = idle. */
export function useResource<T>(path: string | null): Resource<T> {
  const api = useApi();
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(
    async (keep: boolean) => {
      if (!path) return;
      const mine = ++seq.current;
      if (!keep) setState("loading");
      setError(null);
      try {
        const result = await api<T>(path);
        if (mine !== seq.current) return;
        setData(result);
        setState("ready");
      } catch (err) {
        if (mine !== seq.current) return;
        setError(err instanceof ApiError ? err.message : "Could not load this.");
        setState("error");
      }
    },
    [api, path]
  );

  useEffect(() => {
    const id = window.setTimeout(() => void load(false), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  return { data, state, error, reload: () => void load(true), setData };
}

/** The value after it has stopped changing for `ms` (for search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/**
 * Runs a mutation once at a time per key, so a double click cannot send two
 * requests. Returns [run, busyKey].
 */
export function useMutation() {
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(new Set<string>());
  const run = useCallback(async <R,>(key: string, fn: () => Promise<R>): Promise<R | undefined> => {
    if (busyRef.current.has(key)) return undefined;
    busyRef.current.add(key);
    setBusy(key);
    try {
      return await fn();
    } finally {
      busyRef.current.delete(key);
      setBusy(prev => (prev === key ? null : prev));
    }
  }, []);
  return [run, busy] as const;
}
