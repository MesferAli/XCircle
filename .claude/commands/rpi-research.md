---
description: "RPI Research phase - analyze feasibility of a feature request"
---

You are performing the Research phase of the RPI (Research-Plan-Implement) workflow.

**Input:** Feature slug provided as argument (e.g., `oauth2-sso`)

## Steps

1. **Read the request**: Read `workflow/rpi/$ARGUMENTS/REQUEST.md`

2. **Research feasibility** by analyzing:
   - Technical compatibility with current stack (React 18, Express 4, PostgreSQL, Drizzle ORM)
   - Impact on existing architecture and code
   - Required dependencies or infrastructure changes
   - Security implications
   - Performance considerations
   - Multi-tenant compatibility

3. **Assess effort**: Estimate complexity (low/medium/high)

4. **Identify risks**: List blockers, dependencies, and unknowns

5. **Verdict**: Provide a clear **GO** or **NO-GO** recommendation with justification

6. **Write output**: Save findings to `workflow/rpi/$ARGUMENTS/RESEARCH.md` with:
   - Feasibility analysis
   - Architecture impact
   - Dependencies
   - Risks
   - Effort estimate
   - GO/NO-GO verdict
