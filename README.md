# Accounting Ledger Client

React + TypeScript + Vite front end for the Accounting Ledger API. This project was split out of the
`accounting-ledger-api` repository, where the API source lives alongside it.

## Entry points

The build produces two apps from one project:

| Route | Source | Purpose |
| --- | --- | --- |
| `/` | `index.html` → `src/main.tsx` | Company workspace (ledger, reports, customers, expenses, administration) |
| `/platform/` | `platform/index.html` → `src/platform-main.tsx` | Platform operator portal (company onboarding, tenant management) |

## Development

```bash
npm install
npm run dev          # Vite dev server
```

By default the dev server proxies `/api` to `http://localhost:3000`, so run the API locally and leave
`VITE_API_URL` unset. Requests then stay same-origin and no CORS configuration is needed.

To proxy somewhere else (a preview deployment, for example) set `VITE_API_PROXY_TARGET`.

## Environment

Copy `.env.example` to `.env.local` and adjust as needed.

| Variable | Used by | Effect |
| --- | --- | --- |
| `VITE_API_URL` | `src/api-url.ts` | API origin for built/deployed bundles. Empty keeps requests same-origin (`/api/v1/...`). |
| `VITE_API_PROXY_TARGET` | `vite.config.ts` | Where the dev-server `/api` proxy points. Defaults to `http://localhost:3000`. |

Every request goes through `API_PREFIX` in `src/api-url.ts`, which resolves to
`${VITE_API_URL}/api/v1`. Set it to the API's origin, **without** a trailing slash and **without**
`/api/v1` — for example `https://api.example.com`.

`VITE_API_URL` is read at build time, not at runtime, so changing it requires a rebuild.

Setting `VITE_API_URL` to a different origin than the page makes the browser enforce CORS on every
call. The NestJS API does not currently send CORS headers, so a split-origin deployment needs
`app.enableCors({ origin: [...] })` on the server first.

## Build and check

```bash
npm run build        # tsc -b && vite build -> dist/
npm run preview      # serve dist/ locally
npm run lint         # oxlint
```
