# Important Updates

Important Updates is a mobile-first daily task app with a discreet, PIN-gated private area for a two-person chat, journey link, and shared settings.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/important-updates` — installable React/Vite PWA with the decoy task surface and private routes.
- `artifacts/api-server` — Express API for auth, tasks, chat, sessions, settings, and journey data.
- `lib/api-spec/openapi.yaml` — source of truth for the generated API client and Zod validators.
- `lib/db/src/schema` — Drizzle schema for users, sessions, tasks, messages, and shared settings.

## Architecture decisions

- The private area is gated by a device-local PIN and session storage; the PIN never leaves the browser.
- The API uses secure, httpOnly session cookies and seeds exactly two trusted users for local development.
- Reveal bubbles are intentionally a client-side presentation effect; chat content remains normal server data.
- Shared data uses generated OpenAPI hooks so every UI mutation can invalidate or update the matching cache.

## Product

- Shared daily task list with assignment, due dates, status changes, editing, deletion, filtering, and summary counts.
- Hidden PIN-gated chat with sealed-to-reveal bubbles, message editing/deletion, timestamps, and delivery status.
- Shared settings for theme, reveal style, auto-lock preference, notifications, journey URL, devices, and logout.
- PWA manifest and service worker for installable mobile use.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml`.
- The Vite build config expects workflow-provided `PORT` and `BASE_PATH`; use the managed web workflow for preview verification.
- Development sign-in seed accounts are `alex@example.com` and `sam@example.com`, both using the shared development password shown in the build notes.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
