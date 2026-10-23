"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, apiRequest, type RequestOptions } from "./api";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  userType: string;
}

interface SessionValue {
  /** null until the stored session has been read on mount. */
  ready: boolean;
  token: string | null;
  admin: AdminUser | null;
  /** Why the last session ended, shown on the sign-in screen. */
  notice: string | null;
  signIn: (token: string, admin: AdminUser) => void;
  signOut: (notice?: string) => void;
  /** Authenticated request; a 401/403 ends the session instead of retrying forever. */
  api: <T>(path: string, opts?: Omit<RequestOptions, "token">) => Promise<T>;
}

const SessionContext = createContext<SessionValue | null>(null);

const TOKEN_KEY = "admin_token";
const USER_KEY = "admin_user";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  // localStorage is unavailable while the static shell prerenders, so the
  // stored session is read after mount. A corrupt entry drops the session.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const t = localStorage.getItem(TOKEN_KEY);
        const u = localStorage.getItem(USER_KEY);
        if (t && u) {
          const parsed = JSON.parse(u) as AdminUser;
          tokenRef.current = t;
          setToken(t);
          setAdmin(parsed);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const signIn = useCallback((t: string, user: AdminUser) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    tokenRef.current = t;
    setToken(t);
    setAdmin(user);
    setNotice(null);
  }, []);

  const signOut = useCallback((message?: string) => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    tokenRef.current = null;
    setToken(null);
    setAdmin(null);
    setNotice(message ?? null);
  }, []);

  const api = useCallback(
    async <T,>(path: string, opts: Omit<RequestOptions, "token"> = {}) => {
      const current = tokenRef.current;
      try {
        return await apiRequest<T>(path, { ...opts, token: current });
      } catch (err) {
        // Only end the session the request was made with; a stale request
        // from before a re-login must not sign the new session out.
        if (err instanceof ApiError && current && current === tokenRef.current) {
          if (err.status === 401) signOut("Your session has expired. Sign in again.");
          if (err.status === 403 && path.startsWith("/admin/stats")) {
            signOut("This account does not have administrator access.");
          }
        }
        throw err;
      }
    },
    [signOut]
  );

  const value = useMemo(
    () => ({ ready, token, admin, notice, signIn, signOut, api }),
    [ready, token, admin, notice, signIn, signOut, api]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

/** Shorthand for views: the authenticated request function. */
export function useApi() {
  return useSession().api;
}
