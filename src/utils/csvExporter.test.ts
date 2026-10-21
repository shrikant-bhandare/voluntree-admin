import { describe, expect, it } from "vitest";
import { csvCell } from "./csvExporter";
import { formatMoney, initialsOf } from "./format";

describe("csvCell", () => {
  it.each<[string | number, string]>([
    ["plain", '"plain"'],
    ['say "hi"', '"say ""hi"""'],
    ["=1+1", `"'=1+1"`],
    ["+91 98765", `"'+91 98765"`],
    ["-cmd", `"'-cmd"`],
    ["@SUM(A1)", `"'@SUM(A1)"`],
    ["\tTab", `"'\tTab"`],
    [-5, '"-5"'], // a real number is data, not a formula
    [42, '"42"'],
    ["", '""'],
  ])("%j → %s", (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });
});

describe("formatMoney / initialsOf", () => {
  it("uses Indian digit grouping and the row currency", () => {
    expect(formatMoney(100000, "INR")).toBe("₹1,00,000");
    expect(formatMoney(1234.5, "USD")).toContain("1,234.5");
  });

  it("derives initials from the full name", () => {
    expect(initialsOf("Asha Rao")).toBe("AR");
    expect(initialsOf("  priya  k  sharma ")).toBe("PS");
    expect(initialsOf("Madonna")).toBe("M");
    expect(initialsOf(undefined)).toBe("?");
  });
});
