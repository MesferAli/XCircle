---
description: Run the full test suite - unit tests and E2E tests
---

You are running the test suite for XCircle/Atlas EAL.

Follow these steps:

1. **Unit tests**: Run `npm run test` and capture results.

2. **Analyze failures**: If any unit tests fail, identify the root cause and suggest fixes.

3. **E2E tests** (if requested with argument "e2e" or "all"):
   - Ensure Playwright browsers are installed: `npx playwright install chromium`
   - Run `npm run test:e2e`
   - Analyze any failures

4. **Coverage report** (if requested with argument "coverage"):
   - Run `npm run test:coverage`
   - Summarize coverage metrics

5. **Report**: Provide a summary of all test results, passing/failing counts, and any recommended fixes.

Arguments:
- No args: Run unit tests only
- `e2e`: Include E2E tests
- `coverage`: Include coverage report
- `all`: Run everything
