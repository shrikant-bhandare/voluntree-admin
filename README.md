# Voluntree Admin Console

Next.js 16 / React 19 admin dashboard for the Voluntree API (`../backend`). One
client page (`src/app/page.tsx`) holds the dashboard state; tabs live in
`src/components/tabs/`. Sign-in is the API's email/phone OTP flow, restricted to
`ADMIN` accounts.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | **Yes for production builds** | Absolute URL of the API, e.g. `https://api.example.com`. Trailing slashes are stripped. It is inlined into the client bundle **at build time** and also feeds the Content-Security-Policy (`connect-src`/`img-src`), so set it before `npm run build` — changing it later needs a rebuild. `next build` fails if it is unset. In `next dev` it falls back to `http://localhost:3000`. |

`next build` and `next dev` also read `.env.local` — make sure a local file does
not point a production build at `localhost`.

The 6-digit dev OTP box is only shown when the API is `localhost`/`127.0.0.1`
**and** the build is not a production build.

## Run locally

```bash
npm install
npm run dev -- -p 3001          # the API usually owns :3000
```

## Checks

```bash
npm run lint                    # CI gates on errors; `any` warnings are known debt
npx tsc --noEmit
npm test                        # Vitest unit tests (src/**/*.test.ts)
NEXT_PUBLIC_API_URL=https://api.example.com npm run build
```

## Deploy

```bash
NEXT_PUBLIC_API_URL=https://api.example.com npm run build
npm start -- -p 3001            # or any Node host that runs `next start`
```

- Serve the console over HTTPS: it sends `Strict-Transport-Security`, a CSP with
  `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy` and
  `Permissions-Policy` on every route (see `next.config.ts`).
- Add the console's origin to the API's `CORS_ORIGINS`.
