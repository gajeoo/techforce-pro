# TechForce Pro

Workforce management platform for Multicorp Fire Protection Services — scheduling, profit tracking, invoicing, and multi-role portals.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/techforce-pro run dev` — React frontend (Vite, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate Zod schemas + React Query hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` (Postgres), `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, pino logging (`req.log` in routes, `logger` elsewhere)
- DB: PostgreSQL + Drizzle ORM (`lib/db`)
- Validation: Zod via Orval codegen from OpenAPI spec (`lib/api-spec`, `lib/api-zod`)
- Frontend: React + Vite + Tailwind + shadcn/ui + React Query + Wouter
- Build: esbuild (API CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/api-zod/src/generated/api.ts` — generated Zod schemas (do not edit manually)
- `lib/db/src/schema/` — 5 schema files: employees, customers, jobs, invoices, timeoff
- `artifacts/api-server/src/routes/` — all Express routes (employees, customers, jobs, open-jobs, schedules, invoices, dashboard, timeoff)
- `artifacts/techforce-pro/src/pages/` — all frontend pages by portal
- `artifacts/techforce-pro/src/lib/utils.ts` — STATUS_ICONS, ROLE_LABELS, CERT_LABELS, formatCurrency

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → Zod schemas used in both server validation and frontend types
- No auth: localStorage role selector (manager/supervisor/tech/customer) with employee/customer ID picker
- Profit formula: `(salary × 1.3 + $10,000) / 260` = daily burden rate; shop days allowed by role (suppression=2, sprinkler=3, ext=5, helper=12, admin=0)
- Invoice auto-generation: completing a job via `PUT /api/jobs/:id` with `status: "completed"` auto-creates a draft invoice
- Employee `PUT` uses `UpdateEmployeeBody` (all fields optional, includes `shopDaysUsedYtd` + `utilizationPct`)

## Product

- **Manager/Admin portal**: Command center dashboard (KPIs, charts, ROI table), employees, customers, jobs, returns queue, reschedule queue, open jobs (priority kanban), AI scheduling (auto-assign, fill shop days, emergency), invoices, profit engine, time-off approval, job status config
- **Supervisor portal**: Today's schedule, live status updates, returns/reschedules overview
- **Technician portal**: Personal schedule, shop day tracker, time-off request submission
- **Customer portal**: Upcoming visits, open invoices, service history

## User preferences

- Company: Multicorp Fire Protection Services, 9693 Gerwig Lane, Columbia MD 21046, (410) 876-5000
- 5 employees seeded (IDs 1-5), 6 customers seeded (IDs 1-6), 6 jobs + 6 open jobs + 3 invoices

## Fleet / GPS Tracking

- `lib/db/src/schema/vans.ts` — vans table: id, name, licensePlate, make, model, year, color, assignedEmployeeId, gpsTrackerId, gpsTrackerSerial, gpsTrackerModel, gpsTrackerInstalledAt, lat, lng, speed, heading, lastLocationUpdate, status, notes
- `artifacts/api-server/src/routes/vans.ts` — CRUD + `GET /api/vans/locations` (polls & simulates movement), `POST /api/vans/:id/install-tracker`, `DELETE /api/vans/:id/tracker`
- `artifacts/techforce-pro/src/pages/GPSTrackingPage.tsx` — Leaflet map (react-leaflet), live polling every 5s, van sidebar, Add/Edit/Delete Van dialogs, Install/Remove Tracker dialogs
- Simulation: each poll call drifts lat/lng by a small random amount for vans with GPS trackers — simulates real movement
- Map center: Columbia MD 39.2037, -76.8610 (9693 Gerwig Lane area)
- 6 vans seeded: Van 1–3 & Van 5 have GPS trackers installed; Van 4 & Van 6 have no tracker yet
- Managers can: add vans, edit van details, install tracker (with serial + model), remove tracker, delete van from fleet
- Color coding: blue=moving (>5mph), amber=idle (<5mph), green=parked, gray=no tracker

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- `PUT /api/employees/:id` accepts partial body — do not send all fields, just what changed
- Routes `/jobs/returns` and `/jobs/reschedules` must be registered BEFORE `/jobs/:id` in Express
- Employee numeric fields (`salary`, `billableRate`, `utilizationPct`) stored as `text` in DB, cast to `Number()` on read

## Pointers

- `pnpm-workspace` skill — workspace structure, TypeScript setup, package details
- `lib/api-spec/openapi.yaml` — add new endpoints here first, then run codegen
