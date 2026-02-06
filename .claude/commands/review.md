---
description: Review code changes - check for issues, security, and best practices
---

You are reviewing code changes in XCircle/Atlas EAL.

Follow these steps:

1. **Identify changes**: Run `git diff` to see unstaged changes and `git diff --cached` for staged changes.

2. **Type check**: Run `npm run check` to verify no type errors were introduced.

3. **Security review**: Check for:
   - Hardcoded secrets or credentials
   - SQL injection vulnerabilities (should use Drizzle ORM)
   - XSS vectors in React components
   - Missing input validation at API boundaries
   - Unsafe file operations

4. **Code quality**: Check for:
   - Proper error handling
   - Consistent TypeScript usage (no `any` types)
   - Zod validation on API inputs
   - Proper tenant isolation in queries
   - RBAC enforcement on protected routes

5. **Test coverage**: Verify related tests exist or suggest new ones.

6. **Report**: Provide a structured review with findings categorized as critical, warning, or suggestion.
