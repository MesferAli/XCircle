---
description: "RPI Plan phase - create detailed implementation plan for an approved feature"
---

You are performing the Plan phase of the RPI (Research-Plan-Implement) workflow.

**Input:** Feature slug provided as argument (e.g., `oauth2-sso`)

**Prerequisite:** Research phase must be completed with a GO verdict.

## Steps

1. **Read context**:
   - Read `workflow/rpi/$ARGUMENTS/REQUEST.md`
   - Read `workflow/rpi/$ARGUMENTS/RESEARCH.md`
   - Verify GO verdict exists

2. **Design the implementation**:
   - **UX/UI**: Component changes, new pages, user flow
   - **API**: New endpoints, request/response schemas
   - **Database**: Schema changes, migrations needed
   - **Business Logic**: Engine modifications, new services
   - **Security**: Auth changes, permission updates
   - **Testing**: Unit tests, E2E tests needed

3. **Create implementation roadmap**:
   - Break into ordered tasks
   - Identify dependencies between tasks
   - Note files that will be modified or created

4. **Write output**: Save plan to `workflow/rpi/$ARGUMENTS/PLAN.md` with:
   - Implementation steps (ordered)
   - Files to modify/create
   - Schema changes
   - API specifications
   - Test plan
   - Rollback strategy
