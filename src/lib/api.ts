import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../config/constants";

/** An API failure with the server's own message and the HTTP status. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

/** Nest returns `message` as a string or, for validation errors, a list. */
async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    const msg = data?.message;
    if (Array.isArray(msg) && msg.length > 0) return msg.join(". ");
    if (typeof msg === "string" && msg) return msg;
  } catch {
    // Not JSON — fall through to a status-based message.
  }
  if (res.status === 429) return "Too many requests. Wait a moment and try again.";
  if (res.status >= 500) return "The server had a problem. Try again in a moment.";
  return `Request failed (HTTP ${res.status}).`;
}

function timeoutSignal(outer?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return outer ? AbortSignal.any([outer, timeout]) : timeout;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeoutSignal(signal),
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new ApiError(
      timedOut
        ? "The API did not respond in time. Check your connection and try again."
        : "Could not reach the API. Check your connection and try again.",
      0
    );
  }

  if (!res.ok) throw new ApiError(await readError(res), res.status);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Builds `?a=1&b=2`, dropping empty values. */
export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}
