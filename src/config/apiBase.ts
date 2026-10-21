/**
 * Pure helpers for the API base URL. Kept free of Next/React imports so that
 * next.config.ts (CSP) and the unit tests can use the same rules as the app.
 */

export const DEV_API_FALLBACK = "http://localhost:3000";

/**
 * Normalises NEXT_PUBLIC_API_URL: trims it and strips trailing slashes so
 * `${API_BASE_URL}/path` never produces `//path`.
 *
 * A production build with the variable unset used to inline
 * http://localhost:3000 silently — the console shipped and could not log in.
 * In production it now throws instead, which fails `next build`.
 */
export function normalizeApiBaseUrl(
  raw: string | undefined,
  nodeEnv: string | undefined
): string {
  const value = (raw ?? "").trim().replace(/\/+$/, "");
  if (!value) {
    if (nodeEnv === "production") {
      throw new Error(
        "NEXT_PUBLIC_API_URL is not set. Production builds of the admin console must be pointed at the API explicitly, e.g. NEXT_PUBLIC_API_URL=https://api.example.com npm run build"
      );
    }
    return DEV_API_FALLBACK;
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`NEXT_PUBLIC_API_URL is not a valid absolute URL: "${value}"`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`NEXT_PUBLIC_API_URL must be http(s): "${value}"`);
  }
  return value;
}

/** Origin of the API, plus its WebSocket form, for the CSP. */
export function apiOrigins(apiBaseUrl: string): { http: string; ws: string } {
  const origin = new URL(apiBaseUrl).origin;
  const ws = origin.replace(/^http/, "ws");
  return { http: origin, ws };
}

/** True when the API is on this machine (localhost / 127.0.0.1). */
export function isLocalApi(apiBaseUrl: string): boolean {
  try {
    const host = new URL(apiBaseUrl).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * The API returns `otpInDev` only outside production, but a misconfigured
 * staging/prod API would hand the code to whoever typed the admin's email.
 * The console shows it only for a local API in a non-production build.
 */
export function shouldShowDevOtp(
  apiBaseUrl: string,
  nodeEnv: string | undefined
): boolean {
  return nodeEnv !== "production" && isLocalApi(apiBaseUrl);
}
