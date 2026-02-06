---
description: "RPI Implement phase - execute the implementation plan for a feature"
---

You are performing the Implement phase of the RPI (Research-Plan-Implement) workflow.

**Input:** Feature slug provided as argument (e.g., `oauth2-sso`)

**Prerequisite:** Plan phase must be completed.

## Steps

1. **Read context**:
   - Read `workflow/rpi/$ARGUMENTS/REQUEST.md`
   - Read `workflow/rpi/$ARGUMENTS/RESEARCH.md`
   - Read `workflow/rpi/$ARGUMENTS/PLAN.md`

2. **Execute the plan**:
   - Follow the implementation steps from PLAN.md in order
   - Commit after each completed step
   - Run `npm run check` after code changes
   - Run `npm run test` after adding/modifying tests

3. **Track progress**: Use the TodoWrite tool to track each step

4. **Verify**:
   - Run type checking: `npm run check`
   - Run unit tests: `npm run test`
   - Verify no regressions

5. **Write output**: Save execution record to `workflow/rpi/$ARGUMENTS/IMPLEMENT.md` with:
   - Completed steps
   - Commit references
   - Test results
   - Any deviations from the plan
   - Status: COMPLETE / PARTIAL / BLOCKED
