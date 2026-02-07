# Technical Debt Inventory Report

**Repository**: XCircle / Atlas Enterprise AI Layer
**Analysis Date**: 2026-02-07
**Codebase Size**: ~38,000 LOC (163 TypeScript files)
**Total Debt Items**: 42

---

## Executive Summary

| Severity | Count | Action |
|----------|-------|--------|
| **Critical** | 6 | Requires immediate action |
| **High** | 14 | Next sprint |
| **Medium** | 15 | Next quarter |
| **Low** | 7 | Backlog |

The XCircle codebase has a well-organized top-level structure with clear separation between client, server, and shared layers. However, it carries significant technical debt concentrated in three areas: **monolithic server files** (routes.ts at 3,680 lines with a single ~3,000-line function), **critically low test coverage** (7.6% test-to-production ratio, 57 TypeScript errors blocking the type-check gate), and **performance-impacting query patterns** (N+1 queries, no pagination, no caching). Addressing the critical items will stabilize the codebase for safe feature development.

---

## Debt by Category

| Category | Items | Severity | Estimated Effort |
|----------|-------|----------|------------------|
| Code Quality | 7 | Critical/High | 8-12 days |
| Test Coverage | 9 | Critical/High | 10-15 days |
| Dependencies | 5 | High/Medium | 2-3 days |
| Design | 8 | High/Medium | 12-18 days |
| Performance | 8 | Critical/High | 6-10 days |
| Documentation | 3 | Medium/Low | 2-3 days |
| Infrastructure | 2 | Low | 1-2 days |

---

## Top 10 Highest Impact Items

### 1. [CRITICAL] Monolithic `routes.ts` — 3,680 lines, 97 routes, ~3,000-line function

- **File**: `server/routes.ts`
- **Impact**: Unmaintainable, untestable, blocks parallelized development. All 97 API endpoints live in a single `registerRoutes()` function.
- **Effort**: 5-8 days
- **Fix**: Split into domain-specific route modules: `routes/auth.ts`, `routes/inventory.ts`, `routes/recommendations.ts`, `routes/policies.ts`, `routes/connectors.ts`, `routes/mlops.ts`, `routes/payments.ts`, `routes/admin.ts`. Extract helper functions (`getSecureTenantId`, `buildPolicyContext`, `deriveQuantityFromRecommendation`) into a shared middleware or service layer.

### 2. [CRITICAL] 57 TypeScript errors — `npm run check` fails

- **Files**: `server/mlops/models/advanced/ml-models.ts` (~20 errors), `client/src/pages/mlops-dashboard.tsx` (5), `client/src/pages/audit.tsx` (3), `client/src/pages/productivity-skills.tsx` (4), others
- **Impact**: The pre-commit type-check gate (`npm run check`) is broken. No type safety validation before deployments. Silent regressions can ship.
- **Effort**: 2-3 days
- **Fix**: Resolve type errors by category — missing type exports in MLOps models, `unknown` vs `ReactNode` casting in client pages, missing `downlevelIteration` flag for Map/Set iterators.

### 3. [CRITICAL] N+1 query patterns in AI engine

- **Files**: `server/ai-engine.ts:90-97`, `server/ai-engine.ts:486-613`, `server/storage.ts:1021-1033`
- **Impact**: `generateRecommendations()` performs O(items × locations) database queries. With 100 items and 5 locations, this is 500+ queries per analysis run. `analyzeDemand()` and `predictStockoutRisk()` re-fetch the entire tenant's data on every call inside nested loops.
- **Effort**: 3-4 days
- **Fix**: Pre-fetch all tenant data once before the loop. Replace `getMappingHistoryByTenant()` loop with a single JOIN/IN query. Pass pre-fetched data as parameters instead of re-querying.

### 4. [CRITICAL] `xlsx` dependency has unpatched high-severity CVEs

- **File**: `package.json` — `xlsx: ^0.18.5`
- **Impact**: Known prototype pollution and ReDoS vulnerabilities with no upstream fix. The SheetJS maintainer moved to a commercial model. This affects any spreadsheet import/export flow.
- **Effort**: 1-2 days
- **Fix**: Replace `xlsx` with `exceljs` (actively maintained, MIT licensed). Update import/export code in `client/src/lib/export-utils.ts`.

### 5. [CRITICAL] No pagination on any API endpoint — 8+ endpoints return unbounded results

- **Files**: `server/routes.ts` — `/api/items` (line 1532), `/api/recommendations` (line 1045), `/api/anomalies` (line 1153), `/api/audit-logs` (line 1519), `/api/connectors` (line 744), and others
- **Impact**: As data grows, endpoints serialize and transmit thousands of records per request. This causes memory pressure on the server, bandwidth waste, and slow client rendering.
- **Effort**: 2-3 days
- **Fix**: Add cursor-based or offset pagination to all list endpoints. Add `limit` and `offset` query parameters with defaults (e.g., limit=50). Update `storage.ts` methods to accept pagination parameters.

### 6. [CRITICAL] Dashboard stats endpoint makes 6 sequential COUNT queries

- **File**: `server/storage.ts:1053-1076`
- **Impact**: Every dashboard load fires 6 separate `SELECT COUNT(*)` queries sequentially. Under load, this multiplies database round-trips unnecessarily.
- **Effort**: 0.5 days
- **Fix**: Consolidate into a single query using `Promise.all()` for parallel execution, or a single aggregated SQL query.

### 7. [HIGH] `storage.ts` is a God Object — 1,232 lines, 40+ methods

- **File**: `server/storage.ts`
- **Impact**: All engines depend on this single class. Any change risks breaking unrelated domains. Cannot test engines in isolation without mocking the entire storage interface.
- **Effort**: 5-8 days
- **Fix**: Split into domain-specific repository classes: `ItemRepository`, `ConnectorRepository`, `RecommendationRepository`, `PolicyRepository`, `AuditRepository`, `UserRepository`. Each implements a focused interface.

### 8. [HIGH] Zero test coverage on payment processing

- **File**: `server/moyasar.ts` (322 lines) — 0% test coverage
- **Impact**: Payment flows (Moyasar SAR gateway) have no automated verification. Regressions in payment processing directly impact revenue.
- **Effort**: 2-3 days
- **Fix**: Add unit tests mocking the Moyasar API. Cover success flows, failure flows, webhook handling, and edge cases (timeouts, invalid amounts, duplicate payments).

### 9. [HIGH] Business logic embedded in routes.ts

- **File**: `server/routes.ts` — lines 209-595 (helper functions) + inline logic in handlers
- **Impact**: Business logic (policy context building, quantity derivation, tenant resolution) cannot be reused or tested independently. 440 lines have 10+ spaces of indentation indicating complex nested logic.
- **Effort**: 3-4 days
- **Fix**: Extract `buildPolicyContext()`, `deriveQuantityFromRecommendation()`, `getSecureTenantId()`, and `lookupResourceForAction()` into dedicated service modules.

### 10. [HIGH] Inconsistent error handling across API routes

- **File**: `server/routes.ts` — various handlers
- **Impact**: Some routes return `{ error: "..." }`, others `{ success: false, error: "..." }`. No centralized error handler. Error logging is scattered and inconsistent.
- **Effort**: 2-3 days
- **Fix**: Implement Express error handling middleware. Define a standard `ApiError` class and consistent response envelope. Replace per-route try-catch blocks with middleware.

---

## Full Debt Inventory by Category

### Code Quality Debt

| ID | Severity | Item | File | Lines |
|----|----------|------|------|-------|
| CQ-1 | Critical | Monolithic routes.ts (97 routes in one function) | `server/routes.ts` | 3,680 |
| CQ-2 | Critical | 57 TypeScript errors blocking type-check gate | Multiple files | — |
| CQ-3 | High | God Object storage.ts (40+ methods) | `server/storage.ts` | 1,232 |
| CQ-4 | High | Business logic in route handlers | `server/routes.ts:209-595` | ~400 |
| CQ-5 | Medium | Large engine files (connector, ai, mapping) | `server/connector-engine.ts`, `ai-engine.ts`, `mapping-engine.ts` | 2,832 combined |
| CQ-6 | Medium | Deep nesting (440 lines with 10+ indent levels) | `server/routes.ts` | — |
| CQ-7 | Medium | Large schema file without domain separation | `shared/schema.ts` | 933 |

### Test Debt

| ID | Severity | Item | File | Coverage |
|----|----------|------|------|----------|
| TD-1 | Critical | Test-to-code ratio is 7.6% (target: 40%+) | System-wide | 7.6% |
| TD-2 | High | routes.ts has zero test coverage (3,680 lines) | `server/routes.ts` | 0% |
| TD-3 | High | storage.ts has zero test coverage (1,232 lines) | `server/storage.ts` | 0% |
| TD-4 | High | Payment processing has zero tests | `server/moyasar.ts` | 0% |
| TD-5 | High | connector-engine has zero tests | `server/connector-engine.ts` | 0% |
| TD-6 | High | zai-service has zero tests | `server/zai-service.ts` | 0% |
| TD-7 | High | Client-side has zero unit/component tests (18,552 LOC) | `client/src/` | 0% |
| TD-8 | Medium | E2E covers only 3 of 17+ pages | `e2e/` | ~18% |
| TD-9 | Medium | 7 MLOps modules have no tests | `server/mlops/` | Partial |

### Dependency Debt

| ID | Severity | Item | Details |
|----|----------|------|---------|
| DD-1 | Critical | `xlsx` has unpatched high CVEs (no fix available) | Prototype pollution, ReDoS |
| DD-2 | High | 5 high-severity CVEs via `qs`/`body-parser`/`express` chain | Fix: `npm audit fix` |
| DD-3 | Medium | `@hookform/resolvers` is 2 major versions behind (v3 → v5) | Breaking changes expected |
| DD-4 | Medium | `@types/*` packages in `dependencies` instead of `devDependencies` | `@types/bcryptjs`, `@types/memoizee`, `@types/passport-google-oauth20` |
| DD-5 | Low | `memorystore` may be redundant with `connect-pg-simple` | Audit for removal |

### Design Debt

| ID | Severity | Item | File |
|----|----------|------|------|
| DS-1 | High | All engines tightly coupled to `storage.ts` singleton | `server/*.ts` |
| DS-2 | High | Inconsistent error response formats | `server/routes.ts` |
| DS-3 | High | No centralized error handling middleware | `server/routes.ts` |
| DS-4 | Medium | Client pages use magic string URLs for API calls | `client/src/pages/*.tsx` |
| DS-5 | Medium | No client-side API abstraction layer (hooks/services) | `client/src/` |
| DS-6 | Medium | Missing foreign key constraints in schema | `shared/schema.ts` |
| DS-7 | Medium | Policy conditions stored as JSONB (not queryable) | `shared/schema.ts:398-441` |
| DS-8 | Low | Potential circular dependency risk between engines | `server/*.ts` |

### Performance Debt

| ID | Severity | Item | File |
|----|----------|------|------|
| PF-1 | Critical | N+1 queries in AI engine (O(items × locations) DB calls) | `server/ai-engine.ts:486-613` |
| PF-2 | Critical | No pagination on any list endpoint (8+ endpoints) | `server/routes.ts` |
| PF-3 | Critical | Dashboard stats: 6 sequential COUNT queries | `server/storage.ts:1053-1076` |
| PF-4 | High | `analyzeDemand()` re-fetches entire dataset per item | `server/ai-engine.ts:90-97` |
| PF-5 | High | O(n²) enrichment in anomalies endpoint (`.find()` in `.map()`) | `server/routes.ts:1702-1706` |
| PF-6 | Medium | Missing database indexes on tenant isolation columns | `shared/schema.ts` |
| PF-7 | Medium | `memoizee` installed but unused — no caching strategy | System-wide |
| PF-8 | Medium | Response body serialization in request logging middleware | `server/index.ts:36-60` |

### Documentation Debt

| ID | Severity | Item | File |
|----|----------|------|------|
| DC-1 | Medium | 4 TODO comments without issue tracking | `client/src/pages/mlops-dashboard.tsx:358-391` |
| DC-2 | Medium | No API documentation (OpenAPI/Swagger spec) | — |
| DC-3 | Low | `CLAUDE.md` documents Node.js 20 but runtime is v22 | `CLAUDE.md` |

### Infrastructure Debt

| ID | Severity | Item | Details |
|----|----------|------|---------|
| IF-1 | Low | Duplicate icon libraries (`lucide-react` + `react-icons`) | Bundle size overhead |
| IF-2 | Low | No dynamic imports for heavy client libraries | `recharts`, `jspdf`, `xlsx` loaded eagerly |

---

## Sprint-Ready Work Items

### Epic: Technical Debt Reduction — Q1 2026

#### Sprint 1: Stabilize Type Safety and Fix Security CVEs

**Story 1: Fix 57 TypeScript errors to restore type-check gate**
- Priority: Critical
- Effort: 3 story points
- Acceptance Criteria:
  - [ ] Fix ~20 type errors in `server/mlops/models/advanced/ml-models.ts`
  - [ ] Fix 5 type errors in `client/src/pages/mlops-dashboard.tsx`
  - [ ] Fix `unknown` to `ReactNode` errors in `audit.tsx`, `capabilities.tsx`, `recommendations.tsx`
  - [ ] Fix `downlevelIteration` issues in `productivity-skills.tsx` and MLOps governance
  - [ ] `npm run check` passes with 0 errors

**Story 2: Patch dependency vulnerabilities**
- Priority: Critical
- Effort: 2 story points
- Acceptance Criteria:
  - [ ] Run `npm audit fix` to resolve `qs`/`body-parser`/`express` CVEs
  - [ ] Replace `xlsx` with `exceljs` and update import/export code
  - [ ] `npm audit` shows 0 high/critical vulnerabilities
  - [ ] Move `@types/*` packages to `devDependencies`

#### Sprint 2: Performance Critical Path

**Story 3: Fix N+1 query patterns in AI engine**
- Priority: Critical
- Effort: 5 story points
- Acceptance Criteria:
  - [ ] Pre-fetch tenant data once before recommendation loop in `ai-engine.ts`
  - [ ] Pass pre-fetched data to `analyzeDemand()` and `predictStockoutRisk()`
  - [ ] Replace `getMappingHistoryByTenant()` loop with single IN-clause query
  - [ ] Verify recommendation generation completes in < 5s for 100 items

**Story 4: Add pagination to all list endpoints**
- Priority: Critical
- Effort: 3 story points
- Acceptance Criteria:
  - [ ] Add `limit` and `offset` query parameters to 8 list endpoints
  - [ ] Default limit of 50, max limit of 200
  - [ ] Return `total` count in response metadata
  - [ ] Update client to handle paginated responses

**Story 5: Consolidate dashboard stats query**
- Priority: High
- Effort: 1 story point
- Acceptance Criteria:
  - [ ] Replace 6 sequential COUNT queries with `Promise.all()` or single query
  - [ ] Dashboard loads in < 500ms

#### Sprint 3: Route Decomposition (Phase 1)

**Story 6: Split routes.ts into domain modules**
- Priority: High
- Effort: 8 story points
- Acceptance Criteria:
  - [ ] Create `server/routes/auth.ts` for authentication endpoints
  - [ ] Create `server/routes/inventory.ts` for items, locations, stock endpoints
  - [ ] Create `server/routes/recommendations.ts` for AI/recommendation endpoints
  - [ ] Create `server/routes/policies.ts` for policy endpoints
  - [ ] Create `server/routes/connectors.ts` for connector endpoints
  - [ ] Create `server/routes/admin.ts` for admin endpoints
  - [ ] Extract shared middleware to `server/middleware/`
  - [ ] All existing E2E tests still pass

**Story 7: Extract business logic from routes**
- Priority: High
- Effort: 3 story points
- Acceptance Criteria:
  - [ ] Extract `buildPolicyContext()` to `server/services/policy-context.ts`
  - [ ] Extract `deriveQuantityFromRecommendation()` to `server/services/recommendation.ts`
  - [ ] Extract `getSecureTenantId()` to `server/middleware/tenant.ts`
  - [ ] Add unit tests for extracted functions

#### Sprint 4: Test Coverage Foundation

**Story 8: Add API integration tests for critical routes**
- Priority: High
- Effort: 5 story points
- Acceptance Criteria:
  - [ ] Add tests for authentication routes (login, register, session)
  - [ ] Add tests for recommendation CRUD endpoints
  - [ ] Add tests for connector management endpoints
  - [ ] Add tests for policy evaluation endpoints
  - [ ] Test coverage on routes increases to > 40%

**Story 9: Add payment processing tests**
- Priority: High
- Effort: 3 story points
- Acceptance Criteria:
  - [ ] Unit tests for Moyasar integration (mock external API)
  - [ ] Test success flows, failure flows, webhooks
  - [ ] Test edge cases (timeouts, duplicates, invalid amounts)
  - [ ] 80%+ coverage on `moyasar.ts`

**Story 10: Implement centralized error handling**
- Priority: High
- Effort: 2 story points
- Acceptance Criteria:
  - [ ] Create `ApiError` class with status code and user-safe messages
  - [ ] Implement Express error handling middleware
  - [ ] Standardize all error responses to `{ success, error, message }` format
  - [ ] Add request ID to error responses for debugging

---

## Refactoring Roadmap (Quarterly Plan)

### Weeks 1-2: Stabilize and Secure
- [ ] Fix 57 TypeScript errors (CQ-2)
- [ ] Patch all CVEs — replace `xlsx`, run `npm audit fix` (DD-1, DD-2)
- [ ] Consolidate dashboard stats query (PF-3)

### Weeks 3-4: Performance Critical Path
- [ ] Fix N+1 queries in AI engine (PF-1, PF-4)
- [ ] Add pagination to all list endpoints (PF-2)
- [ ] Add database indexes on `tenantId` columns (PF-6)

### Weeks 5-6: Route Decomposition
- [ ] Split `routes.ts` into domain modules (CQ-1)
- [ ] Extract business logic to services (CQ-4)
- [ ] Implement centralized error handling (DS-2, DS-3)

### Weeks 7-8: Storage Refactoring
- [ ] Split `storage.ts` into domain repositories (CQ-3)
- [ ] Add unit tests for each repository (TD-3)
- [ ] Add foreign key constraints and indexes (DS-6, PF-6)

### Weeks 9-10: Test Coverage Push
- [ ] Add API integration tests for routes (TD-2)
- [ ] Add payment processing tests (TD-4)
- [ ] Add connector-engine and zai-service tests (TD-5, TD-6)
- [ ] Set up client-side component testing (TD-7)

### Weeks 11-12: Polish and Prevent
- [ ] Implement caching strategy using `memoizee` (PF-7)
- [ ] Add lazy loading for heavy client dependencies (IF-2)
- [ ] Create API documentation (DC-2)
- [ ] Add E2E tests for remaining pages (TD-8)
- [ ] Resolve remaining medium/low items

### Success Metrics
- `npm run check` passes with 0 errors
- `npm audit` shows 0 high/critical vulnerabilities
- Test-to-production ratio increases from 7.6% to 30%+
- AI recommendation generation < 5s for 100 items
- All list endpoints paginated with < 200ms response time
- `routes.ts` reduced from 3,680 lines to < 200 (routing shell)
- `storage.ts` reduced from 1,232 lines to < 100 (facade only)

---

## Metrics Dashboard

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| TypeScript Errors | 57 | 0 | Critical |
| Test-to-Code Ratio | 7.6% | 40%+ | Critical |
| Server Coverage (unit tests) | 31% of modules | 100% of modules | High |
| Client Coverage (unit tests) | 0% | 60%+ | High |
| E2E Page Coverage | 3/17 (18%) | 12/17 (70%) | Medium |
| High/Critical CVEs | 6 | 0 | Critical |
| Largest File (LOC) | 3,680 | < 500 | Critical |
| Largest Function (LOC) | ~3,000 | < 100 | Critical |
| Routes per File | 97 | < 15 | High |
| API Endpoints with Pagination | 0/8 | 8/8 | Critical |
| Caching Strategy | None | Redis/memoizee | Medium |
| API Documentation | None | OpenAPI spec | Medium |

---

## Fowler Debt Quadrant Classification

### Reckless + Deliberate
- No pagination on endpoints (shipped fast, skipped scalability)
- `xlsx` kept despite known CVEs (business need overrode security)

### Reckless + Inadvertent
- N+1 query patterns in AI engine (performance not profiled)
- 57 TypeScript errors accumulated (type-check gate not enforced in CI)

### Prudent + Deliberate
- Monolithic `routes.ts` (consolidated early for rapid prototyping)
- JSONB policy storage (flexible schema for evolving requirements)

### Prudent + Inadvertent
- `storage.ts` growing into God Object (organic growth as domains expanded)
- Client API magic strings (TanStack Query convention, not abstracted yet)

---

## Proactive Debt Prevention Recommendations

1. **CI Quality Gate**: Add `npm run check` to CI pipeline as a blocking step
2. **Coverage Threshold**: Configure vitest to fail if coverage drops below 30%
3. **File Size Lint**: Add ESLint rule to warn on files > 500 lines
4. **Function Size Lint**: Add ESLint rule to warn on functions > 50 lines
5. **Dependency Audit**: Add `npm audit --audit-level=high` to CI pipeline
6. **PR Template**: Add technical debt impact checkbox to pull request template
7. **Sprint Allocation**: Reserve 20% of sprint capacity for debt reduction

---

*Report generated by Technical Debt Analyzer — XCircle/Atlas Enterprise AI Layer*
