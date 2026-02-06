---
description: Auto-generate unit or E2E tests for specified files or modules
---

You are generating tests for XCircle/Atlas EAL.

Target: $ARGUMENTS

Follow these steps:

1. **Analyze target**: Read the specified file(s) or module to understand:
   - Exported functions and their signatures
   - Dependencies that need mocking
   - Edge cases and error paths
   - Business logic that needs coverage

2. **Determine test type**:
   - Server code (`server/**/*.ts`) → Vitest unit tests
   - Client components (`client/src/**/*.tsx`) → Vitest unit tests with React Testing patterns
   - Full workflows → Playwright E2E tests (only if explicitly requested)

3. **Generate tests** following project patterns:
   - Use Vitest globals (describe, it, expect, vi)
   - Mock external services (Z.ai, Moyasar, database) with `vi.mock()`
   - Follow Arrange-Act-Assert pattern
   - Use descriptive test names: `it("should return 404 when tenant not found")`
   - Test both success and error paths
   - Test tenant isolation where applicable

4. **Place test files**:
   - Unit tests: `tests/unit/` or colocated as `server/**/*.test.ts`
   - E2E tests: `e2e/*.spec.ts`

5. **Run tests**: Execute `npm run test` to verify generated tests pass.

6. **Report**: Summarize generated tests and coverage.
