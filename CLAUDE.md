# XCircle / Atlas Enterprise AI Layer (EAL)

## Project Overview

Enterprise SaaS platform for AI-powered inventory, supply chain, HR, sales, and operations management. Multi-tenant B2B application with human-in-the-loop approval workflows.

## Tech Stack

- **Frontend:** React 18 + TypeScript 5.6 + Vite 7 + Tailwind CSS 3.4
- **Backend:** Express 4.21 + Node.js 20
- **Database:** PostgreSQL 15 + Drizzle ORM 0.39
- **Testing:** Vitest (unit) + Playwright (E2E)
- **UI:** shadcn/ui (Radix primitives) + custom Atlas design system
- **Auth:** Passport.js (Google OAuth + Local)
- **Payments:** Moyasar (SAR gateway)
- **AI:** Z.ai GLM models

## Project Structure

```
client/src/       → React frontend (pages, components, hooks, lib)
server/           → Express backend (routes, engines, auth, mlops)
shared/           → Shared schemas (Drizzle ORM + Zod)
e2e/              → Playwright E2E tests
tests/unit/       → Vitest unit tests
deploy/           → Docker + deployment configs
nginx/            → Reverse proxy configuration
```

## Path Aliases

- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`
- `@assets/*` → `./attached_assets/*`

## Key Commands

```bash
npm run dev            # Start dev server (port 5000)
npm run build          # Production build (Vite + esbuild)
npm run check          # TypeScript type checking
npm run test           # Unit tests (Vitest)
npm run test:coverage  # Unit tests with coverage
npm run test:e2e       # E2E tests (Playwright)
npm run db:push        # Push schema changes to DB
```

## Architecture Patterns

### Backend Engines
- `ai-engine.ts` — AI recommendation orchestration
- `connector-engine.ts` — ERP/external system connectors
- `mapping-engine.ts` — Data field mapping
- `policy-engine.ts` — Policy evaluation & enforcement
- `capability-guard.ts` — Feature flag management
- `audit-guard.ts` — Audit logging & compliance
- `execution-lock.ts` — Draft mode & approval workflows

### Frontend Patterns
- Pages use TanStack Query for server state
- Forms use React Hook Form + Zod validation
- Routing via Wouter (lightweight client-side router)
- Atlas branded components in `client/src/components/atlas/`
- Theme toggle with dark/light mode support

### Database
- Multi-tenant with tenant isolation
- RBAC roles: `admin`, `operator`, `viewer`, `platform_admin`
- Schema in `shared/schema.ts` and `shared/mlops-schema.ts`
- Migrations via Drizzle Kit

## Conventions

- TypeScript strict mode enabled
- Zod for runtime validation at API boundaries
- All API routes in `server/routes.ts`
- Environment variables defined in `.env.example`
- Draft-only execution mode for production safety (`EXECUTION_MODE=DRAFT_ONLY`)
- Sentry for error tracking in production

## Testing Guidelines

- Unit tests: `tests/**/*.test.ts` and `server/**/*.test.ts`
- E2E tests: `e2e/*.spec.ts` with fixtures in `e2e/fixtures/`
- Run `npm run check` before committing to catch type errors
- E2E tests use Chromium only, auto-start dev server

## Security

- Never commit `.env` files
- Use parameterized queries (Drizzle ORM handles this)
- Input validation with Zod schemas at API boundaries
- Rate limiting configured in nginx
- Session-based auth with PostgreSQL store
- Non-root Docker containers in production

## Workflow

- Start with plan mode for complex tasks
- Commit after each completed subtask
- Use `/compact` at ~50% context usage
- Break tasks into units completable within 50% context budget
