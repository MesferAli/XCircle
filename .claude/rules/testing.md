---
description: Testing conventions for unit and E2E tests
globs: "**/*.test.ts,**/*.spec.ts,e2e/**/*"
---

# Testing Rules

## Unit Tests (Vitest)
- Use descriptive test names: `it("should return 404 when tenant not found")`
- Follow Arrange-Act-Assert pattern
- Mock external dependencies (database, APIs, services)
- Test edge cases and error paths
- Keep tests independent — no shared mutable state
- Use `vi.mock()` for module mocking
- Use `vi.spyOn()` for function spying

## E2E Tests (Playwright)
- Test complete user workflows, not individual components
- Use page object patterns for complex pages
- Use fixtures for test data setup
- Assert on user-visible outcomes, not implementation details
- Use `data-testid` attributes for stable selectors
- Wait for network idle before assertions when needed

## Coverage
- Focus coverage on business logic (engines, services)
- Don't chase 100% — cover critical paths and edge cases
- Server entry points are excluded from coverage metrics

## Test File Naming
- Unit: `*.test.ts` (colocated or in `tests/unit/`)
- E2E: `*.spec.ts` (in `e2e/`)
