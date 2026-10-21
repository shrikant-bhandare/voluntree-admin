/**
 * Opening NGO verification documents.
 *
 * The document URLs are supplied by the applicant. The console used to fetch
 * whatever URL was stored with `Authorization: Bearer <admin JWT>`, so any
 * user could submit a link to their own host and harvest an admin token
 * (WEB-14). The token now only ever goes to the API's own private-file route.
 */

export const PRIVATE_FILES_PREFIX = "/files/private/";
export const UNTRUSTED_DOCUMENT_MESSAGE = "Untrusted document link — not opened.";

/**
 * True only for URLs on the API's own origin under /files/private/.
 * Relative URLs are resolved against the API; `..` segments are normalised by
 * the URL parser before the prefix check.
 */
export function isTrustedDocumentUrl(url: string, apiBaseUrl: string): boolean {
  if (typeof url !== "string" || !url.trim()) return false;
  let api: URL;
  let target: URL;
  try {
    api = new URL(apiBaseUrl);
    target = new URL(url.trim(), api);
  } catch {
    return false;
  }
  if (target.origin !== api.origin) return false;
  if (target.username || target.password) return false;
  return target.pathname.startsWith(PRIVATE_FILES_PREFIX);
}

/**
 * Blob types the dashboard will navigate a tab to. Anything else (including
 * SVG, which can run script) is downloaded instead, because a blob: URL is
 * same-origin with the dashboard (WEB-37).
 */
export function isPreviewableType(mime: string): boolean {
  const type = (mime || "").split(";")[0].trim().toLowerCase();
  if (type === "application/pdf") return true;
  if (type === "image/svg+xml") return false;
  return /^image\/[a-z0-9.+-]+$/.test(type);
}

export type OpenDocumentResult =
  | { ok: true; mode: "preview" | "download" }
  | { ok: false; reason: "untrusted" | "http" | "network"; status?: number; message: string };

interface OpenDocumentDeps {
  fetch: typeof fetch;
  open: (url: string, target: string, features?: string) => Window | null;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  download: (objectUrl: string, filename: string) => void;
  setTimeout: (fn: () => void, ms: number) => unknown;
  timeoutMs: number;
}

function defaultDeps(): OpenDocumentDeps {
  return {
    fetch: (...args) => fetch(...args),
    open: (url, target, features) => window.open(url, target, features),
    createObjectURL: blob => URL.createObjectURL(blob),
    revokeObjectURL: url => URL.revokeObjectURL(url),
    download: (objectUrl, filename) => {
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    timeoutMs: 10_000,
  };
}

/**
 * Fetches a private document with the admin token and shows it.
 *
 * The tab is opened synchronously inside the click so pop-up blockers allow
 * it, its `opener` is cut, and it is only navigated to the blob when the type
 * is a PDF or a raster image; otherwise the tab is closed and the file is
 * downloaded.
 */
export async function openDocument(
  token: string,
  url: string,
  apiBaseUrl: string,
  overrides: Partial<OpenDocumentDeps> = {}
): Promise<OpenDocumentResult> {
  if (!isTrustedDocumentUrl(url, apiBaseUrl)) {
    return { ok: false, reason: "untrusted", message: UNTRUSTED_DOCUMENT_MESSAGE };
  }
  const deps = { ...defaultDeps(), ...overrides };
  const target = new URL(url.trim(), apiBaseUrl);

  const tab = deps.open("", "_blank");
  if (tab) {
    try {
      tab.opener = null;
    } catch {
      // Some browsers make opener read-only; the tab is still ours to drive.
    }
  }

  try {
    const res = await deps.fetch(target.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      // Never follow a redirect with the token attached.
      redirect: "error",
      signal: AbortSignal.timeout(deps.timeoutMs),
    });
    if (!res.ok) {
      tab?.close();
      return {
        ok: false,
        reason: "http",
        status: res.status,
        message: `Could not open the document (HTTP ${res.status}).`,
      };
    }
    const blob = await res.blob();
    const objectUrl = deps.createObjectURL(blob);
    // Give the new tab / download time to start before releasing the blob.
    deps.setTimeout(() => deps.revokeObjectURL(objectUrl), 60_000);

    if (isPreviewableType(blob.type)) {
      if (tab) {
        tab.location.href = objectUrl;
      } else {
        deps.open(objectUrl, "_blank", "noopener,noreferrer");
      }
      return { ok: true, mode: "preview" };
    }

    tab?.close();
    const filename = target.pathname.split("/").pop() || "document";
    deps.download(objectUrl, filename);
    return { ok: true, mode: "download" };
  } catch (err) {
    tab?.close();
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return {
      ok: false,
      reason: "network",
      message: timedOut
        ? "Could not open the document — the request timed out."
        : "Could not open the document — network error.",
    };
  }
}
