import { describe, expect, it } from "vitest";
import {
  DEV_API_FALLBACK,
  apiOrigins,
  normalizeApiBaseUrl,
  shouldShowDevOtp,
} from "./apiBase";

describe("normalizeApiBaseUrl", () => {
  it("strips trailing slashes and whitespace", () => {
    expect(normalizeApiBaseUrl("https://api.example.com/", "production")).toBe(
      "https://api.example.com"
    );
    expect(normalizeApiBaseUrl(" https://api.example.com/v1/// ", "production")).toBe(
      "https://api.example.com/v1"
    );
  });

  it("falls back to localhost outside production", () => {
    expect(normalizeApiBaseUrl(undefined, "development")).toBe(DEV_API_FALLBACK);
    expect(normalizeApiBaseUrl("", "test")).toBe(DEV_API_FALLBACK);
  });

  it("fails loudly in production when unset", () => {
    expect(() => normalizeApiBaseUrl(undefined, "production")).toThrow(
      /NEXT_PUBLIC_API_URL is not set/
    );
    expect(() => normalizeApiBaseUrl("   ", "production")).toThrow();
  });

  it("rejects values that are not absolute http(s) URLs", () => {
    expect(() => normalizeApiBaseUrl("api.example.com", "production")).toThrow();
    expect(() => normalizeApiBaseUrl("ftp://api.example.com", "development")).toThrow();
  });

  it("derives the http and ws origins for the CSP", () => {
    expect(apiOrigins("https://api.example.com/v1")).toEqual({
      http: "https://api.example.com",
      ws: "wss://api.example.com",
    });
    expect(apiOrigins("http://localhost:3000")).toEqual({
      http: "http://localhost:3000",
      ws: "ws://localhost:3000",
    });
  });
});

describe("shouldShowDevOtp", () => {
  it.each([
    ["http://localhost:3000", "development", true],
    ["http://127.0.0.1:3000", "development", true],
    ["http://localhost:3000", "production", false],
    ["https://api.example.com", "development", false],
    ["https://staging-api.example.com", "test", false],
    ["https://localhost.evil.com", "development", false],
    ["not a url", "development", false],
  ])("%s with NODE_ENV=%s → %s", (url, env, expected) => {
    expect(shouldShowDevOtp(url, env)).toBe(expected);
  });
});
