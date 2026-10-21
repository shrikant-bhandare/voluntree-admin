/** Money in Indian grouping (₹1,00,000) honouring the row's currency. */
export function formatMoney(amount: number, currency = "INR"): string {
  const value = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Unknown currency code from the API — show the number and the code.
    return `${new Intl.NumberFormat("en-IN").format(value)} ${currency}`;
  }
}

/** Up to two initials from a full name ("Asha Rao" → "AR"). */
export function initialsOf(fullName: string | undefined | null): string {
  const parts = String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}
