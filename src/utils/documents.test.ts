import { describe, expect, it, vi } from "vitest";
import {
  UNTRUSTED_DOCUMENT_MESSAGE,
  isPreviewableType,
  isTrustedDocumentUrl,
  openDocument,
} from "./documents";

const API = "https://api.voluntree.example";

describe("isTrustedDocumentUrl", () => {
  it.each([
    [`${API}/files/private/abc123.pdf`, true],
    [`${API}/files/private/sub/x.png`, true],
    ["/files/private/abc123.pdf", true], // relative → resolved against the API
    [`${API}/files/public/abc.png`, false],
    [`${API}/uploads/abc.png`, false],
    [`${API}/files/private/../../auth/users`, false],
    [`${API}/files/private/%2e%2e/%2e%2e/auth/users`, false],
    [`${API}.evil.com/files/private/x.pdf`, false],
    ["https://evil.example/files/private/x.pdf", false],
    ["//evil.example/files/private/x.pdf", false],
    ["http://api.voluntree.example/files/private/x.pdf", false], // scheme differs
    ["https://api.voluntree.example:8443/files/private/x.pdf", false], // port differs
    [`https://user:pw@api.voluntree.example/files/private/x.pdf`, false],
    ["javascript:alert(1)", false],
    ["", false],
  ])("%s → %s", (url, expected) => {
    expect(isTrustedDocumentUrl(url, API)).toBe(expected);
  });
});

describe("isPreviewableType", () => {
  it.each([
    ["application/pdf", true],
    ["image/png", true],
    ["image/jpeg; charset=binary", true],
    ["image/svg+xml", false],
    ["text/html", false],
    ["application/octet-stream", false],
    ["", false],
  ])("%s → %s", (mime, expected) => {
    expect(isPreviewableType(mime)).toBe(expected);
  });
});

function fakeTab() {
  return {
    opener: {} as unknown,
    location: { href: "about:blank" },
    close: vi.fn(),
  };
}

function deps(blobType: string, status = 200) {
  const tab = fakeTab();
  const d = {
    fetch: vi.fn(async () =>
      new Response(new Blob(["x"], { type: blobType }), { status })
    ),
    open: vi.fn(() => tab as unknown as Window),
    createObjectURL: vi.fn(() => "blob:dashboard/1"),
    revokeObjectURL: vi.fn(),
    download: vi.fn(),
    setTimeout: vi.fn(),
  };
  return { d, tab };
}

describe("openDocument", () => {
  it("refuses a foreign origin without fetching or opening anything", async () => {
    const { d } = deps("application/pdf");
    const result = await openDocument(
      "admin-jwt",
      "https://evil.example/files/private/x.pdf",
      API,
      d as never
    );
    expect(result).toEqual({
      ok: false,
      reason: "untrusted",
      message: UNTRUSTED_DOCUMENT_MESSAGE,
    });
    expect(d.fetch).not.toHaveBeenCalled();
    expect(d.open).not.toHaveBeenCalled();
  });

  it("refuses an API URL outside /files/private/", async () => {
    const { d } = deps("application/pdf");
    const result = await openDocument("admin-jwt", `${API}/auth/users`, API, d as never);
    expect(result.ok).toBe(false);
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("sends the token only to the API and previews a PDF in an opener-less tab", async () => {
    const { d, tab } = deps("application/pdf");
    const url = `${API}/files/private/abc.pdf`;
    const result = await openDocument("admin-jwt", url, API, d as never);

    expect(result).toEqual({ ok: true, mode: "preview" });
    expect(d.fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = d.fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(calledUrl).origin).toBe(API);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer admin-jwt");
    expect(init.redirect).toBe("error");
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe("blob:dashboard/1");
    expect(d.download).not.toHaveBeenCalled();
  });

  it("downloads (never navigates to) a non-allow-listed type such as SVG or HTML", async () => {
    for (const type of ["image/svg+xml", "text/html"]) {
      const { d, tab } = deps(type);
      const result = await openDocument(
        "admin-jwt",
        `${API}/files/private/doc.bin`,
        API,
        d as never
      );
      expect(result).toEqual({ ok: true, mode: "download" });
      expect(tab.close).toHaveBeenCalled();
      expect(tab.location.href).toBe("about:blank");
      expect(d.download).toHaveBeenCalledWith("blob:dashboard/1", "doc.bin");
    }
  });

  it("reports the HTTP status and closes the tab on failure", async () => {
    const { d, tab } = deps("application/pdf", 401);
    const result = await openDocument(
      "admin-jwt",
      `${API}/files/private/abc.pdf`,
      API,
      d as never
    );
    expect(result).toMatchObject({ ok: false, reason: "http", status: 401 });
    expect(tab.close).toHaveBeenCalled();
  });
});
