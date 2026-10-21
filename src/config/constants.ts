import { normalizeApiBaseUrl, shouldShowDevOtp } from "./apiBase";

// NEXT_PUBLIC_* and NODE_ENV are inlined at build time, so a production build
// with NEXT_PUBLIC_API_URL unset throws here while prerendering and fails.
export const API_BASE_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL,
  process.env.NODE_ENV
);

export const DEV_OTP_VISIBLE = shouldShowDevOtp(
  API_BASE_URL,
  process.env.NODE_ENV
);

/** Every request is bounded so one black-holed call cannot freeze polling. */
export const REQUEST_TIMEOUT_MS = 10_000;
