---
description: Database operations - push schema, check migrations, or inspect tables
---

You are managing the database for XCircle/Atlas EAL.

Based on the argument provided:

**push** (default):
1. Run `npm run db:push` to push schema changes to the database
2. Report any errors or conflicts

**check**:
1. Read `shared/schema.ts` and `shared/mlops-schema.ts`
2. Verify schema consistency and relationships
3. Check for missing indexes or constraints
4. Report findings

**inspect**:
1. Review the current schema definitions
2. List all tables, their columns, and relationships
3. Identify any schema improvements

Arguments: `push`, `check`, `inspect`
