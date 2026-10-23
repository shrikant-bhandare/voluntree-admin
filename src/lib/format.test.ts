import { describe, expect, it } from "vitest";
import { formatDateTime, humanize, plural, timeAgo } from "./format";
import { query } from "./api";

describe("plural", () => {
  it("uses the singular only for exactly one", () => {
    expect(plural(1, "drive")).toBe("1 drive");
    expect(plural(0, "drive")).toBe("0 drives");
    expect(plural(3, "person", "people")).toBe("3 people");
  });

  it("groups large numbers the Indian way", () => {
    expect(plural(150000, "volunteer")).toBe("1,50,000 volunteers");
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-10-24T12:00:00Z").getTime();

  it("reads like a person would say it", () => {
    expect(timeAgo(new Date(now - 10_000), now)).toBe("just now");
    expect(timeAgo(new Date(now - 5 * 60_000), now)).toBe("5 min ago");
    expect(timeAgo(new Date(now - 3 * 3_600_000), now)).toBe("3 h ago");
    expect(timeAgo(new Date(now - 86_400_000), now)).toBe("1 day ago");
    expect(timeAgo(new Date(now - 2 * 86_400_000), now)).toBe("2 days ago");
  });

  it("falls back to a dash for missing or invalid dates", () => {
    expect(timeAgo(null, now)).toBe("—");
    expect(timeAgo("not a date", now)).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("never shows seconds", () => {
    expect(formatDateTime("2026-10-22T09:46:26Z")).not.toMatch(/:\d{2}:\d{2}/);
  });
});

describe("humanize", () => {
  it("turns enum values into sentence case", () => {
    expect(humanize("PREMIUM_SUBSCRIBER")).toBe("Premium subscriber");
    expect(humanize(null)).toBe("—");
  });
});

describe("query", () => {
  it("drops empty values and encodes the rest", () => {
    expect(query({ q: "a b", status: undefined, role: "", banned: false, limit: 25 })).toBe(
      "?q=a+b&banned=false&limit=25"
    );
    expect(query({})).toBe("");
  });
});
