---
description: Run automated security audit on codebase for vulnerabilities and compliance
---

You are performing a security audit on XCircle/Atlas EAL.

Target: $ARGUMENTS (specific file, directory, or "all" for full scan)

Follow these steps:

1. **Dependency audit**: Run `npm audit` to check for known vulnerabilities in dependencies.

2. **Secrets scan**: Search the codebase for:
   - Hardcoded API keys, tokens, or passwords (patterns: `sk-`, `pk_`, `bearer`, `ghp_`)
   - Database connection strings with embedded credentials
   - Private key blocks (`-----BEGIN`)
   - `.env` files accidentally committed

3. **Input validation audit**: Check API routes in `server/routes.ts` for:
   - Missing Zod validation on request body/params/query
   - Unvalidated file uploads
   - Missing Content-Type checks

4. **Tenant isolation audit**: Verify all database queries include tenant filtering:
   - Scan for `db.select()`, `db.insert()`, `db.update()`, `db.delete()` calls
   - Verify `tenantId` is present in WHERE clauses
   - Flag queries that access data without tenant scoping

5. **Auth enforcement**: Check routes for:
   - Missing authentication middleware
   - Missing RBAC role checks
   - Direct tenant ID from request body (should come from session)

6. **XSS prevention**: Scan React components for:
   - `dangerouslySetInnerHTML` usage
   - Unescaped user content rendering
   - Script injection vectors

7. **Report**: Categorize findings as:
   - **Critical**: Immediate fix required (data exposure, injection, auth bypass)
   - **High**: Fix before next release (missing validation, weak auth)
   - **Medium**: Schedule fix (best practice violations)
   - **Low**: Informational (minor improvements)
