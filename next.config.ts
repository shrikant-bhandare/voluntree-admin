import type { NextConfig } from "next";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
} from "next/constants";
import { apiOrigins, normalizeApiBaseUrl } from "./src/config/apiBase";

/**
 * Static CSP (no nonces — the dashboard is a statically prerendered page).
 * - script-src needs 'unsafe-inline' because the App Router inlines its
 *   bootstrap/flight scripts; 'unsafe-eval' only in `next dev` (React uses
 *   eval for debugging there). See
 *   node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
 * - style-src needs 'unsafe-inline': the components use inline style props.
 * - connect-src: the API plus its ws/wss origin (Socket.IO).
 * - img-src: blob:/data: plus API-hosted uploads.
 */
function contentSecurityPolicy(apiBaseUrl: string, isDev: boolean): string {
  const api = apiOrigins(apiBaseUrl);
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${api.http}`,
    "font-src 'self'",
    `connect-src 'self' ${api.http} ${api.ws}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export default function config(phase: string): NextConfig {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  // `next build` applies the production rule: NEXT_PUBLIC_API_URL must be set
  // (the client bundle inlines it at build time). Other phases, e.g.
  // `next start`, read the headers compiled at build time and must not crash
  // just because the build-time variable is absent from the runtime env.
  const apiBaseUrl = normalizeApiBaseUrl(
    process.env.NEXT_PUBLIC_API_URL,
    phase === PHASE_PRODUCTION_BUILD ? "production" : "development"
  );

  const securityHeaders = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(apiBaseUrl, isDev) },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    // Legacy clickjacking guard for browsers without frame-ancestors.
    { key: "X-Frame-Options", value: "DENY" },
  ];

  return {
    poweredByHeader: false,
    async headers() {
      return [
        {
          source: "/:path*",
          headers: securityHeaders,
        },
      ];
    },
  };
}
