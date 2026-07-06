# نظام تدقيق الحوالات (Hawala Audit System)

Arabic RTL accounting system for auditing sales-agent transfers (Bankak receipts + cash payments) with a web app, an Expo mobile app, and a main/sub account hierarchy.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Workflows: `artifacts/api-server: API Server`, `artifacts/hawala-audit: web`, `artifacts/hawala-mobile: expo`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Clerk auth
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Web: React + Vite (artifacts/hawala-audit)
- Mobile: Expo / expo-router (artifacts/hawala-mobile), Cairo font, explicit RTL styling
- OCR: offline Tesseract via Python subprocess (`/api/scan`)

## Where things live

- `artifacts/api-server/src/routes/` — API routes (transfers, agents, scan, messages, accounts)
- `artifacts/api-server/src/middlewares/resolveTenant.ts` — multi-tenant + sub-account permission enforcement
- `lib/db/src/schema.ts` — Drizzle DB schema (source of truth)
- `lib/api-spec/` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/` — generated React Query hooks + Zod schemas
- `artifacts/hawala-audit/` — web app (React + Vite)
- `artifacts/hawala-mobile/` — Expo mobile app; shared UI in `components/ui.tsx`, transfer upload flow in `components/TransferForm.tsx`, helpers in `lib/format.ts`

## Architecture decisions

- Single-DB logical multi-tenancy: every query filters by `ownerId`; sub accounts are mapped to their owner's tenant via `resolveTenant` middleware which rewrites `req.userId` → owner and enforces a sub-account route allowlist (upload/scan/list-own/statement only).
- Account roles: `main` (audits/approves, manages agents and sub requests) and `sub` (مندوب — uploads transfers for their linked agent only). Sub signup requires the main account's email and approval; pending/rejected subs get 403 on data routes.
- `operationNumber` is unique per owner via a PARTIAL unique index that excludes rejected transfers (so numbers free up after rejection).
- Mobile app uses explicit RTL styling (`row-reverse`, `textAlign: "right"`) — never `I18nManager`.
- Generated Orval hooks return data directly; API errors are `ApiError` with `.data.error` (Arabic messages) — mobile uses `errMsg()` from `lib/format.ts`.

## Product

- Main account (web + mobile): dashboard stats, transfer list w/ filters and search, OCR receipt scan + manual entry + cash payments, approve/reject (with reason)/change agent/delete transfers, agent management + statements + inactive-agent alerts, WhatsApp message viewer, sub-account request approval (link to existing agent or create new).
- Sub account (mobile): upload transfers (scan/manual) under their fixed linked agent, view own statement, settings. Blocked states for pending/rejected requests and deleted agents.
- Currency: ج.س (Sudanese pound). Theme: beige/gold/black (#FAF4E3, #A6791E, #1C1A17).

## User preferences

- Arabic UI, full RTL, Cairo font, no emojis in UI.
- Theme: beige background, gold accents, black text.

## Gotchas

- Never add query params to a path-param endpoint in the OpenAPI spec (Orval emits colliding `<Op>Params` types → TS2308).
- `drizzle-kit push` ignores partial index `.where()` predicates — apply partial indexes manually via SQL.
- Transfer response objects are built in two places: `transfers.ts` (`buildTransferResponse`) and `agents.ts` (statement map) — new fields go in both.
- Generated hooks require an explicit `queryKey` when passing `query: { enabled }` options.
- Verify artifacts with `pnpm --filter @workspace/<slug> run typecheck`, not `build`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
