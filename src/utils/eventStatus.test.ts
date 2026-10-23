import { describe, expect, it } from "vitest";
import type { EventStatus as EventStatusValue } from "../types/admin";
import {
  ALL_EVENT_STATUSES,
  adminEventActions,
  oneLine,
} from "./eventStatus";

// Admin transitions from the API contract (PATCH /events/:id/status).
const EXPECTED: Record<EventStatusValue, [string, EventStatusValue][]> = {
  DRAFT: [["CANCEL", "CANCELLED"]],
  ACTIVE: [
    ["FEATURE", "FEATURED"],
    ["SUSPEND", "SUSPENDED"],
    ["CANCEL", "CANCELLED"],
  ],
  FULL: [
    ["FEATURE", "FEATURED"],
    ["SUSPEND", "SUSPENDED"],
    ["CANCEL", "CANCELLED"],
  ],
  FEATURED: [
    ["UNFEATURE", "ACTIVE"],
    ["SUSPEND", "SUSPENDED"],
    ["CANCEL", "CANCELLED"],
  ],
  CLOSED: [
    ["SUSPEND", "SUSPENDED"],
    ["CANCEL", "CANCELLED"],
  ],
  SUSPENDED: [
    ["REINSTATE", "ACTIVE"],
    ["CANCEL", "CANCELLED"],
  ],
  COMPLETED: [],
  CANCELLED: [],
};

describe("adminEventActions", () => {
  it("covers all 8 statuses", () => {
    expect(ALL_EVENT_STATUSES).toHaveLength(8);
    expect(Object.keys(EXPECTED).sort()).toEqual([...ALL_EVENT_STATUSES].sort());
  });

  it.each(ALL_EVENT_STATUSES)("%s → allowed actions", status => {
    const actual = adminEventActions(status).map(d => [d.action, d.next]);
    expect(actual).toEqual(EXPECTED[status]);
  });

  it("requires confirmation for Feature (fee waiver), Suspend and Cancel only", () => {
    const confirmed = new Set<string>();
    for (const status of ALL_EVENT_STATUSES) {
      for (const def of adminEventActions(status)) {
        if (def.confirm) confirmed.add(def.action);
      }
    }
    expect([...confirmed].sort()).toEqual(["CANCEL", "FEATURE", "SUSPEND"]);
    const feature = adminEventActions("ACTIVE").find(d => d.action === "FEATURE");
    expect(feature?.confirm?.("Beach clean-up")).toContain("₹999 promotion fee");
  });

  it("keeps a crafted name on one line inside the confirm text", () => {
    const suspend = adminEventActions("ACTIVE").find(d => d.action === "SUSPEND");
    const text = suspend?.confirm?.("Drive\n\nOK to proceed — click OK") ?? "";
    expect(text.split("\n")[0]).toBe('Suspend "Drive OK to proceed — click OK"?');
    expect(oneLine("a".repeat(200)).length).toBe(80);
  });

});
